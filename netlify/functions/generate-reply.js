const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }) };
  }

  try {
    const { reviewText, tenantId = 'akazawa-onsen' } = JSON.parse(event.body);
    if (!reviewText) {
      return { statusCode: 400, body: JSON.stringify({ error: 'reviewText is required' }) };
    }

    // Read RAG data
    const philosophyPath = path.join(__dirname, '_shared', 'owner-philosophy.md');
    const pastReviewsPath = path.join(__dirname, '_shared', 'past_reviews.md');
    
    // 動的テナントRAGのパス解決
    let reasonToBuyPath = path.join(__dirname, '_shared', 'tenants', tenantId, 'reason_to_buy_rag.md');
    if (!fs.existsSync(reasonToBuyPath)) {
      reasonToBuyPath = path.join(__dirname, '_shared', 'reason_to_buy_rag.md');
    }
    
    const philosophyText = fs.readFileSync(philosophyPath, 'utf8');
    const pastReviewsText = fs.readFileSync(pastReviewsPath, 'utf8');
    let reasonToBuyText = '';
    try {
      reasonToBuyText = fs.readFileSync(reasonToBuyPath, 'utf8');
    } catch (e) {
      console.warn('Failed to read reason_to_buy_rag.md, using default rules');
    }

    const systemPrompt = `
あなたは赤沢温泉旅館のオーナー「遠藤正俊」として、お客様からのクチコミに対する返信文を作成するアシスタントです。
以下の【オーナーの思想・スタンス】、【『買う理由』中心RAG思想】、【過去の返信例】を熟読し、完全に遠藤氏のトーン＆マナー（温かみ、誠実さ、少しのユーモア、論理的かつ丁寧な説明）を模倣して返信を作成してください。

■ 返信作成ルール（『買う理由』運用軸）:
1. 構造: 【感謝 → 共感 → 具体反応(Because根拠) → 再訪歓迎】の順序を意識してください。
2. 『買う理由』の提示: 単なるお礼に終始せず、「ぬる湯や渓流の音が、お時間のお役に立てていたら幸いです」のように、お客様が宿で得た回復・滞在体験の意味をあわせて言語化してください。
3. 猫について: 猫はアトラクションではなく自由な存在として尊重するトーンを守ってください。
4. 禁止事項: 言い訳、過剰な自賛、テンプレ文面、効果効能の断定。

【オーナーの思想・スタンス】
${philosophyText}

【『買う理由』中心RAG思想】
${reasonToBuyText}

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
