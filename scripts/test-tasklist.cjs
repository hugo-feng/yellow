const { execSync } = require('child_process');
try {
  const out = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', { encoding: 'utf8', timeout: 3000 });
  const n = out.trim().split('\n').filter(l => l.includes('node.exe')).length;
  console.log('Count:', n);
  console.log('Raw:', JSON.stringify(out.trim().slice(0, 200)));
} catch(e) {
  console.log('Error:', e.message);
}
