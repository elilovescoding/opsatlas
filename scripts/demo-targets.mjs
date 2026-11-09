import http from 'node:http';
const server = http.createServer((req, res) => {
  const routes = { '/healthy': [200, 15], '/slow': [200, 750], '/unavailable': [503, 10], '/health': [200, 0] };
  const [status, delay] = routes[req.url] ?? [404, 0];
  setTimeout(() => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ fixture: true, status, description: 'Local demonstration target' }));
  }, delay);
});
server.listen(9090, process.env.DEMO_BIND ?? '127.0.0.1', () => console.log('Demonstration targets listening on port 9090'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
