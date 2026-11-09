// Lightweight publication guard; complements, rather than replaces, a full secret scanner.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
const files = execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const signatures=[
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{50,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/,
  /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/:@]+:[^\s/@]+@/,
];
// Compare privately with local credentials; never print their values.
const privateValues=[];
try {
  for (const line of (await readFile('.env','utf8')).split(/\r?\n/)) {
    const match=line.match(/^([A-Z_]*(?:PASSWORD|TOKEN|SECRET|API_KEY)[A-Z_]*)=(.*)$/);
    if(match && match[2].trim().length>=12)privateValues.push(match[2].trim());
  }
} catch (error) { if(error.code!=='ENOENT')throw error; }
const privateEmail=execFileSync('git',['config','--default','','--get','user.email'],{encoding:'utf8'}).trim();
if(privateEmail)privateValues.push(privateEmail);
const findings=[];
for(const file of files){
  if(basename(file).startsWith('.env') || /(?:^|\/)pgdata\/|\.tfstate(?:\.|$)|\.(?:pgpass|pem|key|p12|pfx|jks|keystore|db(?:-wal|-shm)?|sqlite3?(?:-wal|-shm)?|dump|backup|sql\.gz|tfplan|hprof|har)$/.test(file))findings.push(`${file}: prohibited artifact`);
  const bytes=await readFile(file);if(bytes.includes(0))continue;
  const lines=bytes.toString('utf8').split(/\r?\n/);
  lines.forEach((line,index)=>{if(signatures.some(p=>p.test(line)))findings.push(`${file}:${index+1}: credential signature`);if(privateValues.some(v=>line.includes(v)))findings.push(`${file}:${index+1}: private local value`);});
}
for(const ignored of ['.env','.env.local','.env.production','.envrc','.runtime/postgres/PG_VERSION','pgdata/PG_VERSION','.pgpass','.tools/postgres.jar','backend/target/app.jar','frontend/node_modules/example','infrastructure/terraform/terraform.tfstate','infrastructure/terraform/terraform.tfvars','infrastructure/terraform/private.tfvars.json','infrastructure/terraform/reviewed.tfplan','local.db','local.sqlite-wal','backup.dump','backup.sql.gz','local.key','.npmrc','.review/archive.zip']){
  try{execFileSync('git',['check-ignore','--quiet',ignored]);}catch{findings.push(`${ignored}: missing ignore rule`);}
}
if(findings.length){console.error(findings.join('\n'));process.exitCode=1;}else console.log(`PASS: ${files.length} source/artifact paths checked; no credential signatures or prohibited runtime files found.`);
