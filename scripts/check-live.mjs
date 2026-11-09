import assert from 'node:assert/strict';
const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
const cookies = new Map();
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { ...options.headers, Cookie: [...cookies].map(([k,v])=>`${k}=${v}`).join('; ') }, redirect: 'manual' });
  for (const cookie of response.headers.getSetCookie()) { const [pair] = cookie.split(';'); const at=pair.indexOf('='); cookies.set(pair.slice(0,at),pair.slice(at+1)); }
  return response;
}
const csrf = await (await request('/api/auth/csrf')).json();
const before = cookies.get('SESSION');
const login = await request('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json','X-CSRF-TOKEN':csrf.token}, body:JSON.stringify({email:process.env.BOOTSTRAP_EMAIL,password:process.env.BOOTSTRAP_PASSWORD}) });
assert.equal(login.status,200);assert.notEqual(cookies.get('SESSION'),before);
assert.equal((await request('/api/auth/me')).status,200);
const registry = await (await request('/api/services?size=100')).json();
for (const target of ['DEMO_API','DEMO_QUEUE','DEMO_STORAGE']) {
  const service=registry.items.find(s=>s.healthTarget===target);
  assert.ok(service?.checkedAt,`No observation for ${target}`);
  const expected={DEMO_API:'HEALTHY',DEMO_QUEUE:'DEGRADED',DEMO_STORAGE:'UNAVAILABLE'}[target];
  assert.equal(service.healthState,expected);
}
const dashboard=await(await request('/api/dashboard')).json();
assert.ok(dashboard.runtime.health_samples_24h>0);
assert.ok(dashboard.latency.length>0);
assert.ok(dashboard.trends.every(point => /^\d{4}-\d{2}-\d{2}$/.test(point.day)));
const openapi=await(await request('/v3/api-docs')).json();
for (const path of ['/api/services','/api/incidents','/api/deployments','/api/dashboard','/api/auth/login']) assert.ok(openapi.paths[path],`Missing OpenAPI path: ${path}`);
assert.equal((await request('/api/docs')).status,302);
const metrics=await fetch('http://127.0.0.1:8081/actuator/prometheus').then(r=>r.text());
assert.match(metrics,/opsatlas_health_checks_total/);
assert.match(metrics,/jvm_memory_used_bytes/);
assert.equal((await fetch('http://127.0.0.1:8081/actuator/health/readiness').then(r=>r.json())).status,'UP');
const logout=await request('/api/auth/logout',{method:'POST',headers:{'X-CSRF-TOKEN':csrf.token}});
assert.equal(logout.status,204);assert.equal((await request('/api/auth/me')).status,401);
console.log('PASS: live session rotation, persistence, all three observed health states, dashboard, OpenAPI, metrics, readiness, and logout.');
