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

// 3.5. apps/endo-sns のコピーとAPIパス修正 (衝突回避)
console.log('Copying and preparing endo-sns...');
const endoSnsDest = path.join(distDir, 'endo-sns');
copyFolderSync(path.join(__dirname, 'apps', 'endo-sns', 'public'), endoSnsDest);

// endo.mp3 をコピー (ローカル開発/Remotionプレビューおよびデプロイビルドで利用するため)
const endoMp3Src = path.join(__dirname, 'endo.mp3');
if (fs.existsSync(endoMp3Src)) {
  fs.copyFileSync(endoMp3Src, path.join(__dirname, 'apps', 'endo-sns', 'public', 'endo.mp3'));
  fs.copyFileSync(endoMp3Src, path.join(endoSnsDest, 'endo.mp3'));
  console.log('Copied endo.mp3 to public and dist folders.');
}

const endoJsFiles = ['index.js', 'review.js'];
endoJsFiles.forEach(file => {
  const filePath = path.join(endoSnsDest, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/\/api\//g, '/api/endo-');
    fs.writeFileSync(filePath, content, 'utf8');
  }
});

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
  // npx が node_modules 階層を辿って正しい vite を見つけて実行する
  execSync('npx vite build', { cwd: adminPath, stdio: 'inherit' });
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

// endo-sns functions (置換マージで衝突回避)
const endoFuncsSrc = path.join(__dirname, 'apps', 'endo-sns', 'netlify', 'functions');
if (fs.existsSync(endoFuncsSrc)) {
  // _lib を _lib-endo としてコピー
  const libSrc = path.join(endoFuncsSrc, '_lib');
  const libDest = path.join(functionsDir, '_lib-endo');
  if (fs.existsSync(libSrc)) {
    fs.mkdirSync(libDest, { recursive: true });
    fs.readdirSync(libSrc).forEach(file => {
      fs.copyFileSync(path.join(libSrc, file), path.join(libDest, file));
    });
  }
  
  // 各関数ファイルを endo- プレフィックス付きでコピーし、require パスを置換
  fs.readdirSync(endoFuncsSrc).forEach(file => {
    const filePath = path.join(endoFuncsSrc, file);
    if (fs.lstatSync(filePath).isFile()) {
      const destPath = path.join(functionsDir, `endo-${file}`);
      let content = fs.readFileSync(filePath, 'utf8');
      content = content.replace(/\.\/_lib\//g, './_lib-endo/');
      fs.writeFileSync(destPath, content, 'utf8');

      // ローカル開発時の互換性のため、他アプリと名前が衝突しない関数は
      // プレフィックスなしのコピーも作成する
      const nonPrefixedPath = path.join(functionsDir, file);
      if (!fs.existsSync(nonPrefixedPath)) {
        fs.writeFileSync(nonPrefixedPath, content, 'utf8');
      }
    }
  });
}

// 8. APIキーの書き出し (akasawa-ml用)
console.log('Writing API Key to dist/akasawa-ml/key.txt...');
const apiKey = process.env.GEMINI_API_KEY || '';
fs.writeFileSync(path.join(distDir, 'akasawa-ml', 'key.txt'), apiKey);

console.log('All builds and merges completed successfully!');
