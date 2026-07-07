require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ .envファイルに GEMINI_API_KEY が見つかりません。');
    return;
  }

  console.log('Gemini API キーをテストしています...');
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent('こんにちは！テストメッセージです。');
    const text = result.response.text();
    
    console.log('✅ 成功！Gemini APIは正常に動作しています。');
    console.log('AIからの返答:', text);
  } catch (error) {
    console.error('❌ Gemini APIのエラーが発生しました:');
    console.error(error.message);
  }
}

testGemini();
