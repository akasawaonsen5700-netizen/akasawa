const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, 'dist');
const functionsDir = path.join(__dirname, 'netlify', 'functions');

// 1. クリーンアップと作成
console.log('Cleaning old build directories...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

if (fs.existsSync(functionsDir)) {
  fs.rmSync(functionsDir, { recursive: true, force: true });
}
fs.mkdirSync(functionsDir, { recursive: true });

// ディレクトリコピー用のヘルパー
function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      if (element === 'node_modules' || element === '.git' || element === '.netlify') return;
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

// 2. ルートの index.html コピー
console.log('Copying portal index.html...');
fs.copyFileSync(path.join(__dirname, 'index.html'), path.join(distDir, 'index.html'));

// 3. apps/akasawa-chat のコピー (静的)
console.log('Copying akasawa-chat...');
copyFolderSync(path.join(__dirname, 'apps', 'akasawa-chat'), path.join(distDir, 'akasawa-chat'));

// 4. apps/akasawa-ml のコピー (静的)
console.log('Copying akasawa-ml...');
copyFolderSync(path.join(__dirname, 'apps', 'akasawa-ml', 'public'), path.join(distDir, 'akasawa-ml'));

// 5. apps/akasawa-sns のコピー (静的)
console.log('Copying akasawa-sns...');
copyFolderSync(path.join(__dirname, 'apps', 'akasawa-sns', 'public'), path.join(distDir, 'akasawa-sns'));

// 6. apps/akasawa.dp のビルドとコピー
console.log('Building akasawa.dp React app...');
const dpPath = path.join(__dirname, 'apps', 'akasawa.dp');
const adminPath = path.join(dpPath, 'apps', 'admin');
try {
  console.log('Running npm install in apps/akasawa.dp (monorepo root)...');
  execSync('npm install', { cwd: dpPath, stdio: 'inherit' });
  console.log('Building apps/akasawa.dp/apps/admin...');
  execSync('npm run build', { cwd: adminPath, stdio: 'inherit' });
  console.log('Copying build files to dist/akasawa-dp...');
  copyFolderSync(path.join(adminPath, 'dist'), path.join(distDir, 'akasawa-dp'));
} catch (err) {
  console.error('Failed to build akasawa.dp:', err.message);
  process.exit(1);
}

// 7. Netlify Functions のマージ
console.log('Merging Netlify Functions...');
// akasawa-ml functions
const mlFuncs = path.join(__dirname, 'apps', 'akasawa-ml', 'netlify', 'functions');
if (fs.existsSync(mlFuncs)) {
  fs.readdirSync(mlFuncs).forEach(file => {
    fs.copyFileSync(path.join(mlFuncs, file), path.join(functionsDir, file));
  });
}

// akasawa-sns functions
const snsFuncs = path.join(__dirname, 'apps', 'akasawa-sns', 'netlify', 'functions');
if (fs.existsSync(snsFuncs)) {
  const copySNSFuncs = (src, dest) => {
    fs.readdirSync(src).forEach(item => {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      if (fs.lstatSync(srcPath).isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copySNSFuncs(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  };
  copySNSFuncs(snsFuncs, functionsDir);
}

// 8. APIキーの書き出し (akasawa-ml用)
console.log('Writing API Key to dist/akasawa-ml/key.txt...');
const apiKey = process.env.GEMINI_API_KEY || '';
fs.writeFileSync(path.join(distDir, 'akasawa-ml', 'key.txt'), apiKey);

console.log('All builds and merges completed successfully!');
