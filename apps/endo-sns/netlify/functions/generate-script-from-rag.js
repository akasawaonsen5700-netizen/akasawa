const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 松下幸之助氏の「素直な心」と遠藤正俊氏の「自然の理」を手本にしたフォールバック台本
function buildFallbackScript(theme) {
  const fallbackMap = {
    '私を甘やかす、ご褒美時間': {
      hook: '「ずっと、力を入れすぎていませんか。」',
      script: '日々、一生懸命に生きていると、自分を後回しにしてしまいがちですね。時には立ち止まり、静かに心を休めてあげる。何もしない時間を持つことは、決して怠けではなく、明日を素直な心で迎えるための大切な調律なのだと思うのです。'
    },
    '「ちゃんとしなきゃ」を手放す言葉': {
      hook: '「完璧な姿など、どこにもありません。」',
      script: '自然の森を歩いていると、真っ直ぐ美しい木ばかりではないことに気づかされます。どれも曲がり、風に耐え、そのまま生きている。人も同じではないでしょうか。完璧であろうと肩を張らず、ありのままの自分を赦してあげたいものですね。'
    },
    '本当の豊かさと自分らしさ': {
      hook: '「他人のスピードに、惑わされなくていい。」',
      script: '周りの賑やかさと比べて、不安になる夜もあるかもしれません。しかし、本当の豊かさとは、静かな場所で自分の心を慈しめること。他人の基準ではなく、あなた自身の歩幅で一日一日を重ねていく。それこそが確かな生き方だと思うのです。'
    },
    '静寂と森に包まれる、五感の癒やし': {
      hook: '「静けさの中に、答えがあります。」',
      script: '風の音や水の流れにじっと耳を澄ませてみる。頭の中の雑音を静かに横へ置き、五感の感じるままに身を委ねる。静寂の中に身を置くだけで、失われかけていた心の調和が、すーっと戻ってくるのではないでしょうか。'
    },
    '自分を取り戻す、マインドリセット': {
      hook: '「心に、小さな余白を作りましょう。」',
      script: '誰かの期待に応えようと、自分をすり減らしていませんか。一日のうちわずかでもいい、自分の心のためだけに時間を使う。素直な心で静かに自分と向き合うことで、忘れていた大切な何かが見えてくる気がするのです。'
    }
  };

  return fallbackMap[theme] || {
    hook: '「立ち止まることを、恐れないで。」',
    script: '毎日懸命に歩むあなたへ。時には歩みを緩め、深く息を吸ってみてください。あなたがあなたらしく静かにいられる時間が、何よりも尊い宝物なのですから。'
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const theme = body.theme || '私を甘やかす、ご褒美時間';

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not found in process.env, returning fallback script');
      const fallback = buildFallbackScript(theme);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(fallback)
      };
    }

    let ragContent = '';
    try {
      const { PHILOSOPHY } = require('./_lib/endo-philosophy');
      ragContent = PHILOSOPHY;
    } catch (err) {
      console.warn('Failed to read RAG corpus:', err);
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `
あなたはTikTokやInstagramリールで数百万人の心に深く静かな感動を与える動画プロデューサーです。

【語り手の思想・ペルソナ（最重要手本: 松下幸之助の哲学 ✕ 遠藤正俊の自然観）】
・お手本: 経営の神様・松下幸之助氏のような「素直な心」「人間への深い温かさと尊敬」「謙虚で誇らない姿勢」。
・話者背景: 世界中で自然や森と向き合ってきた70歳手前の人生の先輩（遠藤正俊）。
・語り口: 上品、深み、静けさ。「〜ですね」「〜だと思うのです」「〜ではないでしょうか」「〜でありたいものですね」と、静かに心にともしびを灯すような、温かく語りかける口調。

【ターゲット視聴者】
日々の仕事や人間関係で気を張り、「もっと頑張らなきゃ」「ちゃんとしなきゃ」と心をすり減らしている現代人。

【動画テーマ】
${theme}

【絶対に守るべき厳格ルール】
❌ 1. 【宣伝・肩書きの完全禁止】: 「遠藤正俊」「赤沢温泉」「旅館」「オーナー」等の名前・施設名・肩書き・PR表現は絶対に1文字も入れないこと。
❌ 2. 【温泉・風呂用語の完全禁止】: 「ぬる湯」「温泉」「お風呂」等の文句は使用禁止。
❌ 3. 【軽々しい口調・オネエ調・若者言葉の完全禁止】: 「〜だよ」「〜だね」「甘やかしてね」「美しいんだから」といった年甲斐もない語りや軽々しい表現は厳禁。松下幸之助氏を手本とする上品で深みのある語りにすること。
❌ 4. 【ターゲット層の読み上げ禁止】: 「20代30代の女性の皆様」等のメタ言葉は絶対禁止。

【構成】
・冒頭3秒（hook）: スクリーンをなぞる手がピタッと止まる、静かで本質的な問いかけ・言葉（15文字以内）
・台本本文（script）: 聴くだけで胸のつかえが降り、素直な心を取り戻せるような人生の静かな洞察（130文字〜170文字程度）

【思想インプット】
${ragContent.substring(0, 1000)}

必ず以下のJSON形式のみを出力してください（JSON以外のテキストやMarkdown装飾は禁止）:
{"hook": "フック文", "script": "アバター用台本"}
`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { 
          responseMimeType: 'application/json',
          temperature: 0.65
        }
      });

      let responseText = result.response.text().trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
      }

      const data = JSON.parse(responseText.trim());
      if (data && data.hook && data.script) {
        // プロンプト違反ワードの自動強制除去フィルター
        data.script = data.script
          .replace(/皆さん、こんにちは[。！]?/g, '')
          .replace(/赤沢温泉旅館?オーナーの遠藤正俊です[。！]?/g, '')
          .replace(/赤沢温泉/g, '')
          .replace(/旅館/g, '')
          .replace(/オーナー/g, '')
          .replace(/ぬる湯/g, '静けさ')
          .replace(/温泉/g, '自然')
          .replace(/20代[〜~ー]?30代の?女?性?の?皆?様?さん?/g, '')
          .trim();

        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify(data)
        };
      }
    } catch (geminiError) {
      console.warn('Gemini generation failed, using fallback:', geminiError.message);
    }

    const fallback = buildFallbackScript(theme);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fallback)
    };

  } catch (error) {
    console.error('generate-script-from-rag Error:', error);
    const fallback = buildFallbackScript('私を甘やかす、ご褒美時間');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fallback)
    };
  }
};
