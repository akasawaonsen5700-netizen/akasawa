const { GoogleGenerativeAI } = require('@google/generative-ai');
const { PHILOSOPHY } = require('./_lib/endo-philosophy');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }) };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
あなたは「遠藤正俊」（元植林博士・赤沢温泉旅館オーナー）のSNSマーケティングを支援するAIプロデューサーです。

■ ターゲット顧客
【20代〜30代の女性】
（仕事、人間関係、SNS疲れ、タイパ重視社会での疲弊、自己肯定感の低さ、「ちゃんとしなきゃ」という焦りを抱え、自分へのご褒美・癒やし・ぬる湯温泉デトックス・肩の荷を下ろす言葉を求めている女性）

■ 指示
20〜30代女性が抱えるリアルな悩みやSNSトレンド（例：自分へのご褒美旅、チル、デジタルデトックス、ソロ活、セルフケア、何もしない贅沢、完璧主義からの解放など）と、以下の「遠藤正俊の思想・ビジョン」を掛け合わせ、Instagram/TikTok/Shortsでバズりやすく、強く共感を呼ぶ具体的な「SNS投稿テーマのアイデア」を3件生成してください。

■ 遠藤氏の思想コーパス:
${PHILOSOPHY}

■ 出力指示:
1. 20〜30代女性が検索・保存したくなるキーワード（例：#ご褒美旅、#自分を愛する時間、#心のデトックス、#肩の荷を下ろす等）をテーマ内に含めてください。
2. 遠藤氏の人生経験（世界を巡った植林博士・ぬる湯温泉の効能・自然の真理）が合わさることで、他にはない「独自の価値」を持つテーマにしてください。
3. 出力は必ず以下のJSON配列形式にしてください。Markdownの囲みは不要です。

[
  {
    "title": "テーマの短いタイトル（例：頑張りすぎる私への処方箋）",
    "theme": "具体的なテーマ案（例：『ちゃんとしなきゃ』と自分を追い詰めてしまう20-30代女性へ、世界を知る宿主が語る『完璧じゃなくていい』ぬる湯ご褒美旅の提案）",
    "reason": "このテーマがなぜ20〜30代女性の心に刺さり、SNSで検索・保存されやすいかの説明"
  }
]
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    let responseText = result.response.text().trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: responseText.trim()
    };
  } catch (error) {
    console.error('get-trend-suggestions Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
