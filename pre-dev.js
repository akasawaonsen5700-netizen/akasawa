const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Pre-development auto recovery script running ===');

// 1. .netlify キャッシュの強制削除 (utime エラーなどの完全回避)
const foldersToClean = [
  path.join(__dirname, 'apps', 'endo-sns', '.netlify'),
  path.join(__dirname, '.netlify')
];

foldersToClean.forEach(folder => {
  if (fs.existsSync(folder)) {
    try {
      console.log(`Clearing Netlify cache: ${folder}`);
      fs.rmSync(folder, { recursive: true, force: true });
      console.log(`Successfully deleted: ${folder}`);
    } catch (e) {
      console.error(`Failed to delete ${folder}:`, e.message);
    }
  }
});

// 2. ポート 8891 / 3996 を掴んでいるゾンビプロセスの自動キル
const portsToFree = [8891, 3996];
portsToFree.forEach(port => {
  try {
    console.log(`Checking port ${port} for zombie processes...`);
    // Windows の netstat コマンドを使用して、ポートを掴んでいる PID を検索
    const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' }).trim();
    if (output) {
      const lines = output.split('\n');
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        // 通常、行の末尾にPIDが含まれます (LISTENING の後ろなど)
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && !isNaN(pid)) {
          console.log(`Found zombie process PID ${pid} using port ${port}. Killing...`);
          execSync(`taskkill /F /PID ${pid}`);
          console.log(`Successfully killed zombie PID ${pid}`);
        }
      });
    } else {
      console.log(`Port ${port} is free.`);
    }
  } catch (e) {
    // findstr で見つからなかった場合は例外になるので無視
    console.log(`Port ${port} is clear (no zombie process found).`);
  }
});

console.log('=== Pre-dev recovery completed successfully. Starting Netlify Dev... ===');
