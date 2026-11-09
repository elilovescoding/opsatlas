// Free, read-only OSV lookup of public package coordinates; no credentials sent.
// First run: mvn -f backend/pom.xml dependency:list -DincludeScope=runtime -DoutputFile=target/runtime-dependencies.txt
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const text=await readFile('backend/target/runtime-dependencies.txt','utf8');
const packages=[...text.matchAll(/^\s+([^\s:]+):([^:]+):jar:([^:]+):(compile|runtime)/gm)].map(m=>({name:`${m[1]}:${m[2]}`,version:m[3]}));
if(!packages.length)throw new Error('No Maven runtime coordinates found. Generate dependency:list output first.');
const response=await fetch('https://api.osv.dev/v1/querybatch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({queries:packages.map(p=>({package:{ecosystem:'Maven',name:p.name},version:p.version}))}),signal:AbortSignal.timeout(60000)});
if(!response.ok)throw new Error(`OSV unavailable: ${response.status}`);
const data=await response.json();
if(!Array.isArray(data.results)||data.results.length!==packages.length)throw new Error('OSV returned an incomplete result set.');
const findings=data.results.flatMap((result,i)=>(result.vulns??[]).map(v=>({...packages[i],id:v.id})));
await mkdir('.runtime',{recursive:true});
await writeFile('.runtime/maven-osv-report.json',JSON.stringify({checkedAt:new Date().toISOString(),packages:packages.length,findings},null,2));
console.log(`OSV checked ${packages.length} runtime Maven coordinates; ${findings.length} advisory matches.`);
for(const finding of findings)console.log(`${finding.name}@${finding.version}: ${finding.id}`);
if(findings.length)process.exitCode=1;
