const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 対象データベースファイルのパス一覧
const DB_PATHS = [
  path.join(__dirname, '../netlify/functions/_lib-review/past_reviews.md'),
  path.join(__dirname, '../apps/akasawa-review/netlify/functions/_lib/past_reviews.md'),
  path.join(__dirname, '../apps/akasawa-chat/past_reviews.md')
];

// 楽天トラベル / じゃらんのターゲットURL
const RAKUTEN_URL = 'https://review.travel.rakuten.co.jp/hotel/voice/163353/';
const JALAN_URL = 'https://www.jalan.net/yad317076/kuchikomi/';

// フェッチ用共通ヘッダー (WAF対策として一般的なブラウザのUser-Agentを設定)
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
};

// コマンドライン引数のパース用ヘルパー
function getArgs() {
  const args = {};
  process.argv.slice(2).forEach(val => {
    if (val.startsWith('--')) {
      const parts = val.split('=');
      const key = parts[0].substring(2);
      const value = parts[1] || true;
      args[key] = value;
    }
  });
  return args;
}

// 既存事例の読み込みとパース
function readExistingReviews() {
  const primaryDbPath = DB_PATHS[0];
  if (!fs.existsSync(primaryDbPath)) {
    console.error(`Database not found: ${primaryDbPath}`);
    return { count: 0, reviews: [] };
  }

  const text = fs.readFileSync(primaryDbPath, 'utf8');
  const parts = text.split(/(## 事例\d+：[^\n]+)/);
  const reviews = [];
  
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i];
    const body = parts[i + 1] || "";
    
    // 事例番号の抽出
    const matchNum = heading.match(/## 事例(\d+)：/);
    const num = matchNum ? parseInt(matchNum[1], 10) : 0;
    
    // クチコミ本文と返信の抽出
    const cleanBody = body.trim();
    
    reviews.push({
      number: num,
      heading: heading.trim(),
      body: cleanBody
    });
  }

  // 番号でソート
  reviews.sort((a, b) => a.number - b.number);
  const maxNum = reviews.length > 0 ? reviews[reviews.length - 1].number : 0;

  return { count: reviews.length, maxNum, reviews };
}

// 重複チェック (クチコミ本文の最初の30文字程度で比較)
function isDuplicate(newReviewText, existingReviews) {
  if (!newReviewText) return true;
  const targetPrefix = newReviewText.replace(/\s+/g, '').substring(0, 30);
  
  return existingReviews.some(ext => {
    // クチコミ部分を抽出してプレフィックス比較
    const extClean = ext.body.replace(/\s+/g, '');
    return extClean.includes(targetPrefix) || targetPrefix.includes(extClean.substring(0, 30));
  });
}

// Gemini API を用いた要約タイトルの生成
async function generateTitle(reviewText, replyText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set. Cannot summarize review.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `以下のホテル宿泊客からのクチコミと宿からの返信を読んで、この事例の特徴を表す簡潔な日本語のタイトル（30文字〜50文字程度）を1つ生成してください。
形式は「事例[番号]：[要約タイトル]」ではなく、タイトル文（例：「〇〇の評価、〇〇への対応と〇〇について」）だけを出力してください。余計な説明やマークダウン装飾、ダブルクォーテーションなどは一切省き、純粋なタイトル文字列のみを1行で出力してください。

【クチコミ】
${reviewText}

【宿の返信】
${replyText}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim().replace(/["'「」]/g, '');
}

// データベースファイルへの追記更新
function appendToDatabases(newNum, title, reviewText, replyText) {
  const newEntry = `\n---\n\n## 事例${newNum}：${title}\n### クチコミ\n${reviewText}\n\n### 実際の返信\n${replyText}\n`;
  
  DB_PATHS.forEach(dbPath => {
    // フォルダの存在確認
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(dbPath)) {
      // 既存ファイルの末尾に追記
      let content = fs.readFileSync(dbPath, 'utf8');
      
      // 末尾の改行コードを調整してきれいに追記する
      content = content.trimEnd() + '\n' + newEntry;
      fs.writeFileSync(dbPath, content, 'utf8');
      console.log(`Updated database: ${dbPath}`);
    } else {
      // 新規作成
      fs.writeFileSync(dbPath, newEntry, 'utf8');
      console.log(`Created database: ${dbPath}`);
    }
  });
}

// 楽天トラベルのクチコミスクレイピング
async function fetchRakutenReviews() {
  const fetch = (await import('node-fetch')).default;
  const cheerio = require('cheerio');
  
  console.log(`Fetching Rakuten reviews from: ${RAKUTEN_URL}`);
  const response = await fetch(RAKUTEN_URL, { headers: FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch Rakuten reviews: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $('.commentComment').each((i, el) => {
    const reviewText = $(el).find('.commentWord').text().trim();
    const replyText = $(el).find('.commentReply').text().trim();
    if (reviewText) {
      results.push({
        source: '楽天トラベル',
        reviewText,
        replyText: replyText || 'ご宿泊ありがとうございました。またのお越しをお待ちしております。　館主'
      });
    }
  });

  return results;
}

// じゃらんのクチコミスクレイピング
async function fetchJalanReviews() {
  const fetch = (await import('node-fetch')).default;
  const cheerio = require('cheerio');
  
  console.log(`Fetching Jalan reviews from: ${JALAN_URL}`);
  const response = await fetch(JALAN_URL, { headers: FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(`Failed to fetch Jalan reviews: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  // じゃらんのレビューコンテナ要素 (一般的には .jlnpc-kuchikomi または .kuchikomiClass)
  $('.jlnpc-kuchikomi, .kuchikomiClass').each((i, el) => {
    // クチコミ本文と返信のセレクタ
    const reviewText = $(el).find('.jlnpc-kuchikomi__body, .kuchikomiComment').text().trim();
    const replyText = $(el).find('.jlnpc-kuchikomi__reply, .kuchikomiReply').text().trim();
    
    if (reviewText) {
      // 返信がある場合は「宿からの回答」などの見出しを取り除く
      const cleanReply = replyText.replace(/^返信：|^宿からの回答|^返信\s*/, '').trim();
      results.push({
        source: 'じゃらん',
        reviewText,
        replyText: cleanReply || 'ご宿泊ありがとうございました。またのお越しをお待ちしております。　館主'
      });
    }
  });

  return results;
}

// メイン実行関数
async function main() {
  const args = getArgs();
  
  // 既存データベースの読み込み
  const { maxNum, reviews: existingReviews } = readExistingReviews();
  let nextNum = maxNum + 1;
  let addedCount = 0;

  // 手動引数指定モード (--manual)
  if (args.manual) {
    const review = args.review;
    const reply = args.reply;
    
    if (!review || !reply) {
      console.error("Error: --manual mode requires both --review and --reply arguments.");
      process.exit(1);
    }
    
    console.log("Manual Insertion Mode Triggered.");
    if (isDuplicate(review, existingReviews)) {
      console.log("Warning: This review is already registered in the database. Skipping.");
      process.exit(0);
    }

    try {
      console.log("Summarizing review with Gemini AI...");
      const title = await generateTitle(review, reply);
      console.log(`Generated Title: "${title}"`);
      
      appendToDatabases(nextNum, title, review, reply);
      console.log(`Successfully added manual review as Case #${nextNum}`);
      process.exit(0);
    } catch (err) {
      console.error("Failed to insert manual review:", err.message);
      process.exit(1);
    }
  }

  // 自動スクレイピングモード
  console.log("Starting Automatic Review Synchronization...");
  let newReviews = [];

  // 1. 楽天トラベルのフェッチ
  try {
    const rakuten = await fetchRakutenReviews();
    console.log(`Fetched ${rakuten.length} reviews from Rakuten.`);
    newReviews = newReviews.concat(rakuten);
  } catch (err) {
    console.warn(`Could not scrape Rakuten reviews: ${err.message}. WAF block or selector change suspected.`);
  }

  // 2. じゃらんのフェッチ
  try {
    const jalan = await fetchJalanReviews();
    console.log(`Fetched ${jalan.length} reviews from Jalan.`);
    newReviews = newReviews.concat(jalan);
  } catch (err) {
    console.warn(`Could not scrape Jalan reviews: ${err.message}. WAF block or selector change suspected.`);
  }

  if (newReviews.length === 0) {
    console.log("No reviews fetched. If this is unexpected, check the target URLs or use --manual mode.");
    process.exit(0);
  }

  // 3. 重複判定と追加処理
  for (const item of newReviews) {
    if (isDuplicate(item.reviewText, existingReviews)) {
      console.log(`Duplicate detected for review from ${item.source}. Skipping.`);
      continue;
    }

    console.log(`New review detected from ${item.source}. Summarizing...`);
    try {
      const title = await generateTitle(item.reviewText, item.replyText);
      console.log(`Generated Title: "${title}"`);
      
      appendToDatabases(nextNum, title, item.reviewText, item.replyText);
      console.log(`Successfully added Case #${nextNum}`);
      
      // 連続でAPIを呼び出す際のレートリミットを考慮して少しウェイト
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      nextNum++;
      addedCount++;
    } catch (err) {
      console.error(`Failed to process review: ${err.message}`);
    }
  }

  console.log(`Synchronization finished. Added ${addedCount} new cases.`);
}

main().catch(err => {
  console.error("Fatal Error in sync process:", err);
  process.exit(1);
});
