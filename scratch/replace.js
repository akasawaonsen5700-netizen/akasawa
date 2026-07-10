const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\user\\Desktop\\akasawa\\apps\\akasawa-sns';

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  content = content.replace(/遠藤正俊 個人SNS配信ツール \(X \/ Instagram\)/g, '赤沢温泉旅館 SNS・GBP自動配信');
  content = content.replace(/遠藤正俊 個人SNS配信用ツール/g, '赤沢温泉旅館 SNS・GBP自動配信');
  content = content.replace(/遠藤正俊 個人SNS自動配信システム/g, '赤沢温泉旅館 SNS・GBP自動配信');
  content = content.replace(/遠藤正俊/g, '赤沢温泉旅館');
  content = content.replace(/endo-sns/g, 'akasawa-sns');
  
  if (original !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', filePath);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === '.next') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else {
      const ext = path.extname(fullPath);
      if (['.html', '.js', '.json', '.tsx', '.ts', '.css'].includes(ext)) {
        replaceInFile(fullPath);
      }
    }
  }
}

walk(dir);
