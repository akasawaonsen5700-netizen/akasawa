const fs = require('fs');
const path = require('path');

// グローバルfetchがない場合はnode-fetchを使用する
let myFetch = typeof fetch !== 'undefined' ? fetch : null;
if (!myFetch) {
  try {
    myFetch = require('node-fetch');
  } catch (e) {
    console.error('Error: fetch is not available. Please install node-fetch or use a newer Node.js version.');
    process.exit(1);
  }
}

// .env から環境変数をパースする
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found');
    process.exit(1);
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // ダブルクォートやシングルクォートで囲まれている場合は外す
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
        value = value.substring(1, value.length - 1);
      }
      env[key] = value;
    }
  });
  return env;
}

async function main() {
  const env = loadEnv();
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not defined in .env');
    process.exit(1);
  }

  console.log('Fetching email logs from Resend API...');
  
  let emails = [];
  let hasMore = true;
  let after = null;
  let page = 1;
  const maxEmails = 7500; // ユーザー要求(6,651件)に対応するため上限を引き上げ

  // Rate Limitを避けるためのスリープ関数
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  while (hasMore && emails.length < maxEmails) {
    let url = 'https://api.resend.com/emails?limit=100';
    if (after) {
      url += `&after=${after}`;
    }
    
    console.log(`Fetching page ${page}...`);
    const res = await myFetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch Resend logs: ${res.status} ${res.statusText} - ${text}`);
    }

    const result = await res.json();
    if (!result.data || !Array.isArray(result.data)) {
      console.log('No data returned or invalid format:', result);
      break;
    }

    emails = emails.concat(result.data);
    console.log(`Retrieved ${result.data.length} emails. Total: ${emails.length}`);

    hasMore = result.has_more;
    if (hasMore && result.data.length > 0) {
      after = result.data[result.data.length - 1].id;
      page++;
      // Rate Limit(通常10req/sec)対策で150msウェイトを入れる
      await sleep(150);
    } else {
      break;
    }
  }

  console.log(`Finished fetching. Total emails: ${emails.length}`);

  // アドレスごとに集計
  // Resend APIの to は配列形式
  const analysis = {};
  
  emails.forEach(email => {
    const toList = Array.isArray(email.to) ? email.to : [email.to];
    const subject = email.subject || '(件名なし)';
    const createdAt = email.created_at;

    toList.forEach(to => {
      if (!to) return;
      const cleanTo = to.trim().toLowerCase();
      if (!analysis[cleanTo]) {
        analysis[cleanTo] = {
          email: to,
          count: 0,
          details: []
        };
      }
      analysis[cleanTo].count++;
      analysis[cleanTo].details.push({
        subject,
        created_at: createdAt,
        id: email.id
      });
    });
  });

  const duplicateList = [];
  const singleList = [];

  Object.keys(analysis).forEach(key => {
    const record = analysis[key];
    if (record.count > 1) {
      duplicateList.push(record);
    } else {
      singleList.push(record);
    }
  });

  // 送信日時の降順（最新順）に並び替えるなどの調整
  duplicateList.sort((a, b) => b.count - a.count);

  // Markdown 生成
  let md = `# メール送信履歴 調査結果 (Resend API ログ解析)

本レポートは、Resend API から直近のメール送信履歴（最大 ${maxEmails} 件）を取得し、宛先メールアドレスごとの送信回数と送信日時を集計したものです。

## 概要
- **解析対象件数 (Resend ログ総数)**: ${emails.length} 件
- **ユニークな宛先アドレス数**: ${Object.keys(analysis).length} 件
- **二重送信が確認されたアドレス数**: ${duplicateList.length} 件
- **1通のみ送信されたアドレス数**: ${singleList.length} 件

---

## 1. 二重送信されたアドレス一覧 (${duplicateList.length} 件)

送信回数が2回以上の宛先リストです。送信回数が多い順に表示しています。

| 宛先メールアドレス | 送信回数 | 送信日時と件数の履歴 |
| :--- | :---: | :--- |
`;

  duplicateList.forEach(item => {
    const historyStr = item.details.map(d => {
      // 日時を見やすくフォーマット（UTCのままだが読みやすく）
      const dateStr = d.created_at.replace('T', ' ').substring(0, 19);
      return `・\`${dateStr}\` | 件名: 「${d.subject}」 (ID: \`${d.id}\`)`;
    }).join('<br>');
    
    md += `| \`${item.email}\` | **${item.count} 回** | ${historyStr} |\n`;
  });

  md += `
---

## 2. 1通のみ送信されたアドレス一覧 (${singleList.length} 件)

正常に1通のみ送信された宛先リストです。

| 宛先メールアドレス | 送信日時 | 件名 | Resend メールID |
| :--- | :--- | :--- | :--- |
`;

  singleList.forEach(item => {
    const d = item.details[0];
    const dateStr = d.created_at.replace('T', ' ').substring(0, 19);
    md += `| \`${item.email}\` | \`${dateStr}\` | ${d.subject} | \`${d.id}\` |\n`;
  });

  md += `
---
*解析実行日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} (JST)*
`;

  const outputPath = path.join(__dirname, 'email_analysis_result.md');
  fs.writeFileSync(outputPath, md, 'utf8');
  console.log(`Analysis report created at: ${outputPath}`);
}

main().catch(err => {
  console.error('Fatal error during analysis:', err);
  process.exit(1);
});
