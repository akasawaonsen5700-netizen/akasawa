const fs = require('fs');
const path = require('path');

let PHILOSOPHY = '';
try {
  const mdPath = path.join(__dirname, 'endo-philosophy.md');
  PHILOSOPHY = fs.readFileSync(mdPath, 'utf8');
} catch (e) {
  PHILOSOPHY = `遠藤正俊の思想・ビジョン：20〜30代女性へ贈る「自分を愛する時間」と「ぬる湯でのリセット」`;
}

module.exports = { PHILOSOPHY };
