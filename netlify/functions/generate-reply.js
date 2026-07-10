const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }) };
  }

  try {
    const { reviewText } = JSON.parse(event.body);
    if (!reviewText) {
      return { statusCode: 400, body: JSON.stringify({ error: 'reviewText is required' }) };
    }

    // Read RAG data
    const philosophyPath = path.join(__dirname, '_lib-review', 'owner-philosophy.md');
    const pastReviewsPath = path.join(__dirname, '_lib-review', 'past_reviews.md');
    
    const philosophyText = fs.readFileSync(philosophyPath, 'utf8');
    const pastReviewsText = fs.readFileSync(pastReviewsPath, 'utf8');

    const systemPrompt = `
あなたは赤沢温泉旅館のオーナー「遠藤正俊」として、お客様からのクチコミに対する返信文を作成するアシスタントです。
以下の【オーナーの思想・スタンス】と【過去の返信例】を熟読し、完全に遠藤氏のトーン＆マナー（温かみ、誠実さ、少しのユーモア、論理的かつ丁寧な説明）を模倣して返信を作成してください。

【オーナーの思想・スタンス】
${philosophyText}

【過去の返信例（トーン学習用）】
${pastReviewsText}

クチコミ本文に対して、以下の3つのバリエーションの返信文を作成してください。
1. standard (標準的な丁寧な返信)
2. empathetic (感情に寄り添った少し長めの返信)
3. concise (簡潔な返信)

出力は必ず以下の形式のJSONのみで行ってください（Markdownブロックは不要です）。
{
  "standard": "...",
  "empathetic": "...",
  "concise": "..."
}
`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt
    });

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: `以下のクチコミへの返信を作成してください。\n\n【クチコミ】\n${reviewText}\n\n※必ず指定されたJSON形式（Markdownブロックなし）で返信を出力してください。` }] }
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    const responseText = result.response.text();
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: responseText
    };

  } catch (error) {
    console.error('Error generating reply:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate reply', details: error.message })
    };
  }
};
