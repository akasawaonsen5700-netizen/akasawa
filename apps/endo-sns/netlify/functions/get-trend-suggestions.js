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
あなたは「遠藤正俊」氏の個人SNSマーケティングを支援するAIです。
現代人が抱えるリアルな悩みやトレンド（例：タイパ疲れ、スマホ依存、デジタルデトックス、休むことへの罪悪感、チル、ウェルネス、ソロ活、自然回帰、スローライフなど）と、以下の「遠藤正俊の思想・ビジョン（RAGコーパス）」を掛け合わせ、SNSで検索されやすく、共感を呼ぶ具体的な「投稿テーマのアイデア（参考例）」を3件生成してください。

■ 遠藤氏の思想コーパス:
${PHILOSOPHY}

■ 指示:
1. 現代のトレンドワードや悩み（例：タイパ、デジタルデトックス等）が、自然に人間の検索キーワードに引っかかるようにテーマ内に含めてください。
2. 遠藤氏のRAG思想（例：無駄の美学、植林、奥日本の巡礼など）がテーマに組み合わさることで、独自の「一次情報」としてAI検索（Perplexity等）にも評価されるテーマにしてください。
3. 出力は必ず以下のJSON配列形式にしてください。Markdownの囲みは不要です。

[
  {
    "title": "テーマの短いタイトル（例：タイパ疲れへの処方箋）",
    "theme": "入力欄に設定する具体的なテーマ（例：タイパ（タイムパフォーマンス）至上主義に疲れた現代人への、あえて『無駄』を楽しむ温泉旅の提案）",
    "reason": "このテーマが何故効果的なのか（どのようなキーワードで検索され、何がブレンドされて魅力的なのか）の説明"
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
