const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { theme } = JSON.parse(event.body || '{}');
    if (!theme) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Theme is required' }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }) };
    }

    let ragContent = '';
    try {
      const { PHILOSOPHY } = require('./_lib/endo-philosophy');
      ragContent = PHILOSOPHY;
    } catch (err) {
      console.error('Failed to read RAG corpus:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'RAGコーパスの読み込みに失敗しました。' }) };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
あなたは「遠藤正俊」（元植林博士・赤沢温泉旅館オーナー）のSNSショート動画（Instagramリール/TikTok/Shorts）台本を作成するAIプロデューサーです。

■ ターゲット顧客
【20代〜30代の女性】
（仕事やSNSの疲れ、「もっと頑張らなきゃ」という焦りを持つ女性たちへ、温かく寄り添い、心をゆるめるメッセージを届ける）

■ 遠藤氏の思想・ビジョン（RAGコーパス）
${ragContent}

■ 指定された動画テーマ
${theme}

■ 指示
1. 20〜30代女性がスクロールの手を止める「冒頭3秒の惹きつけフック（30文字以内）」を作成してください。（例: 「頑張りすぎている、あなたへ。」「『完璧じゃなくていい』って、知ってる？」等）
2. 遠藤正俊本人の口調（一人称は「私」、優しく包み込む語りかけ）で、AIアバターが喋るための「動画台本（150〜220文字程度）」を作成してください。
3. 遠藤氏の人生経験（世界中の自然を見てきた植林博士、ぬる湯温泉でのリセット）を織り交ぜ、20〜30代女性の心がすっと軽くなるようなメッセージにしてください。
4. 必ず以下のJSON形式で出力してください。Markdownの囲みは不要です。

{
  "hook": "動画冒頭の惹きつけフック（30文字以内）",
  "script": "AIアバター用動画台本（150〜220文字）"
}
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

    const data = JSON.parse(responseText.trim());

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('generate-script-from-rag Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
