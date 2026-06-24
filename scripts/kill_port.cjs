const { execSync } = require('child_process');
const PORT = 3078;
try {
  const out = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' });
  const pids = [...new Set(out.split('\n').map(l => l.trim().split(/\s+/).pop()).filter(p => p && p !== '0'))];
  pids.forEach(p => {
    try { execSync('taskkill /F /PID ' + p); console.log('killed', p); } catch (e) { }
  });
  if (!pids.length) console.log('no process on ' + PORT);
} catch (e) {
  console.log('no process on ' + PORT);
}
