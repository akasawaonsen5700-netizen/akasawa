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

// 2.5. 共通データ基盤(shared)のコピー
console.log('Copying shared data...');
copyFolderSync(path.join(__dirname, 'shared'), path.join(distDir, 'shared'));

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

// 6. apps/akasawa-dp のコピー（React版ダッシュボード）
console.log('Building akasawa-dp React dashboard...');
let dpPath = path.join(__dirname, 'apps', 'akasawa-dp');
if (!fs.existsSync(dpPath)) {
  dpPath = path.join(__dirname, 'apps', 'akasawa.dp');
}
const adminPath = path.join(dpPath, 'apps', 'admin');
try {
  if (fs.existsSync(dpPath)) {
    execSync('npm install --legacy-peer-deps', { cwd: dpPath, stdio: 'inherit', shell: true });
    execSync('npx vite build', { cwd: adminPath, stdio: 'inherit', shell: true });
    copyFolderSync(path.join(adminPath, 'dist'), path.join(distDir, 'akasawa-dp'));
  }
} catch (err) {
  console.error('Failed to build akasawa-dp:', err.message);
  process.exit(1);
}

// 7. Netlify Functions のマージ
console.log('Merging Netlify Functions...');

// shared を netlify/functions/_shared としてコピー
console.log('Copying shared to netlify/functions/_shared...');
copyFolderSync(path.join(__dirname, 'shared'), path.join(functionsDir, '_shared'));

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

// 7.5. apps/akasawa-review のコピー (静的)
console.log('Copying akasawa-review...');
copyFolderSync(path.join(__dirname, 'apps', 'akasawa-review', 'public'), path.join(distDir, 'akasawa-review'));

// 7.6. apps/nasumid-p のコピー (静的)
console.log('Copying nasumid-p...');
copyFolderSync(path.join(__dirname, 'apps', 'nasumid-p'), path.join(distDir, 'nasumid-p'));

// akasawa-review functions
const reviewFuncsSrc = path.join(__dirname, 'apps', 'akasawa-review', 'netlify', 'functions');
if (fs.existsSync(reviewFuncsSrc)) {
  // _lib を _lib-review としてコピー
  const libSrc = path.join(reviewFuncsSrc, '_lib');
  const libDest = path.join(functionsDir, '_lib-review');
  if (fs.existsSync(libSrc)) {
    fs.mkdirSync(libDest, { recursive: true });
    fs.readdirSync(libSrc).forEach(file => {
      fs.copyFileSync(path.join(libSrc, file), path.join(libDest, file));
    });
  }
  
  // 各関数ファイルをコピーし、require パスを置換
  fs.readdirSync(reviewFuncsSrc).forEach(file => {
    const filePath = path.join(reviewFuncsSrc, file);
    if (fs.lstatSync(filePath).isFile()) {
      const destPath = path.join(functionsDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      
      // パス置換
      content = content.replace(/\.\/_lib\//g, './_lib-review/');
      content = content.replace(/'_lib'/g, "'_lib-review'");
      content = content.replace(/"_lib"/g, '"_lib-review"');
      
      fs.writeFileSync(destPath, content, 'utf8');
    }
  });
}

// 7.7. apps/akasawa-blog のコピーと関数マージ
console.log('Copying akasawa-blog...');
copyFolderSync(path.join(__dirname, 'apps', 'akasawa-blog', 'public'), path.join(distDir, 'akasawa-blog'));

const blogFuncsSrc = path.join(__dirname, 'apps', 'akasawa-blog', 'netlify', 'functions');
if (fs.existsSync(blogFuncsSrc)) {
  fs.readdirSync(blogFuncsSrc).forEach(file => {
    const filePath = path.join(blogFuncsSrc, file);
    if (fs.lstatSync(filePath).isFile()) {
      fs.copyFileSync(filePath, path.join(functionsDir, file));
    }
  });
}

// 7.8. apps/akasawa-ota のコピーと関数マージ
console.log('Copying akasawa-ota...');
copyFolderSync(path.join(__dirname, 'apps', 'akasawa-ota', 'public'), path.join(distDir, 'akasawa-ota'));

const otaFuncsSrc = path.join(__dirname, 'apps', 'akasawa-ota', 'netlify', 'functions');
if (fs.existsSync(otaFuncsSrc)) {
  fs.readdirSync(otaFuncsSrc).forEach(file => {
    const filePath = path.join(otaFuncsSrc, file);
    if (fs.lstatSync(filePath).isFile()) {
      fs.copyFileSync(filePath, path.join(functionsDir, file));
    }
  });
}

// 7.9. apps/akasawa-plan のコピーと関数マージ
console.log('Copying akasawa-plan...');
copyFolderSync(path.join(__dirname, 'apps', 'akasawa-plan', 'public'), path.join(distDir, 'akasawa-plan'));

const planFuncsSrc = path.join(__dirname, 'apps', 'akasawa-plan', 'netlify', 'functions');
if (fs.existsSync(planFuncsSrc)) {
  fs.readdirSync(planFuncsSrc).forEach(file => {
    const filePath = path.join(planFuncsSrc, file);
    if (fs.lstatSync(filePath).isFile()) {
      fs.copyFileSync(filePath, path.join(functionsDir, file));
    }
  });
}

// 8. APIキーの書き出し (akasawa-ml用)
console.log('Writing API Key to dist/akasawa-ml/key.txt...');
const apiKey = process.env.GEMINI_API_KEY || '';
fs.writeFileSync(path.join(distDir, 'akasawa-ml', 'key.txt'), apiKey);

console.log('All builds and merges completed successfully!');
