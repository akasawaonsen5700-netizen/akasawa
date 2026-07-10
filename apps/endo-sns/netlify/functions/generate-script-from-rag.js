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

    const ragPath = path.join(__dirname, '_lib', 'endo-philosophy.md');
    let ragContent = '';
    try {
      ragContent = fs.readFileSync(ragPath, 'utf8');
    } catch (err) {
      console.error('Failed to read RAG corpus:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'RAGコーパスの読み込みに失敗しました。' }) };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
あなたは「遠藤正俊」氏のSNSアカウント発信をサポートする専属AIです。
以下の「遠藤氏の思想・ビジョン（RAGコーパス）」を読み込み、指定されたコンテンツクラスター（テーマ）に沿った動画台本を生成してください。

■ 遠藤氏の思想コーパス
${ragContent}

■ 指定されたテーマ
${theme}

■ 指示
1. 上記の思想コーパスから、指定されたテーマに最も関連する考え方やエピソードを抽出してください。
2. 動画の冒頭に表示する「3秒で関心を惹く短いフック（惹きつけ文）」を作成してください。「知らなかった」「なぜ？」「本当に？」と思わせる知的欲求を刺激する要素を含めてください。
3. 動画で本人が語る（またはテロップで流す）ための「動画台本（スクリプト）」を作成してください。
4. 台本は、本人の語り口調（一人称は「私」、です・ます調）で、長すぎないように（約150〜250文字程度）してください。
5. 「旅館の宣伝」ではなく、「日本の田舎の価値を伝える案内人」としての立ち位置を守ってください。
6. 必ず以下のJSON形式で出力してください。Markdownの囲みは不要です。

{
  "hook": "動画冒頭のフック文（30文字以内）",
  "script": "動画台本の本文（150〜250文字）"
}
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    let responseText = result.response.text().trim();
    if (responseText.startsWith('\`\`\`')) {
      responseText = responseText.replace(/^\`\`\`[a-zA-Z]*\n/, '').replace(/\n\`\`\`$/, '');
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
