const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * ユーザー指示通りの正解モデル（松下幸之助流の素直な心・自然の理）に基づき、
 * 同じテーマでも毎回異なる切り口・表現の台本をランダム出力する多系フォールバックマップ
 */
function buildFallbackScript(theme) {
  const fallbackVariations = {
    '私を甘やかす、ご褒美時間': [
      {
        hook: '「その重荷、降ろしませんか？」',
        script: '私たちは皆、完璧であろうと、ついつい頑張りすぎてしまいますね。しかし、森の木々が、ただそこに在るだけで美しいように、人間もまた、ありのままの姿で尊いもの。時に立ち止まり、心の奥底で感じる静けさに身を委ねてみる。それが、自分自身への一番の贈り物ではないでしょうか。素直な心で、自分を慈しむ時間を持つこと。それが、明日を生きる穏やかな力となると思うのです。'
      },
      {
        hook: '「自分を甘やかすのは、悪ではありません。」',
        script: '真面目な人ほど、休むことにどこか罪悪感を覚えてしまうものです。ですが、使い古した道具を休ませるように、心にも休息が必要ではないでしょうか。何も生産しない時間を、自分に買い与えてあげる。そんな静かなご褒美が、枯れかけた心に深い潤いをもたらしてくれると思うのです。'
      },
      {
        hook: '「頑張りすぎた心に、ご褒美を。」',
        script: '毎日、誰かのために走り続けてきたあなたへ。たまには立ち止まり、自分のためだけに静かなお茶を淹れてみる。言葉にならない心の声にじっと耳を澄ませる時間こそが、明日への確かな栄養になる。素直な心で自分を慈しむ、そんな優しい時間が必要だと思うのです。'
      }
    ],
    '「ちゃんとしなきゃ」を手放す言葉': [
      {
        hook: '「完璧な姿など、どこにもありません。」',
        script: '自然の森を歩いていると、真っ直ぐ美しい木ばかりではないことに気づかされます。どれも曲がり、風に耐え、そのまま生きている。人も同じではないでしょうか。完璧であろうと肩を張らず、ありのままの自分を赦してあげたいものですね。'
      },
      {
        hook: '「『完璧』の二文字を、そっと置いてみる。」',
        script: '『ちゃんとしなきゃ』と自分を追い詰めるとき、私たちは自分自身の素直な声を押し殺してしまいがちです。不完全さの中にこそ、人間らしい温もりや美しさが宿るもの。肩の力を抜き、今の自分のままで一歩を踏み出す。それだけで景色はガラリと変わるのではないでしょうか。'
      },
      {
        hook: '「歪みがあるから、人は美しい。」',
        script: '歪みのない自然など存在しないように、人の心も揺れて当たり前です。正解ばかりを求めず、弱さや不器用さも自分の一部として抱きしめてあげる。完璧を目指すのをやめた瞬間、心に心地よい風が吹き抜けていくのを感じると思うのです。'
      }
    ],
    '本当の豊かさと自分らしさ': [
      {
        hook: '「他人のスピードに、惑わされなくていい。」',
        script: '周りの賑やかさと比べて、不安になる夜もあるかもしれません。しかし、本当の豊かさとは、静かな場所で自分の心を慈しめること。他人の基準ではなく、あなた自身の歩幅で一日一日を重ねていく。それこそが確かな生き方だと思うのです。'
      },
      {
        hook: '「豊かな人生とは、心が穏やかであること。」',
        script: '多くのものを所有することだけが、豊かさではありません。静かな木漏れ日や、ふと立ち止まった時の呼吸の深さ。そうした目に見えない豊かさに気づける素直な心を持つこと。自分のペースで歩むことこそが、最も贅沢な生き方ではないでしょうか。'
      },
      {
        hook: '「自分だけの歩幅を、愛すること。」',
        script: '世間の物差しで自分を測ると、心がすり減ってしまいます。大切なのは、自分が心から心地よいと感じる時間を重ねること。静かな環境で自分自身と対話し、ありのままの歩みを受け入れる。それこそが、本当の豊かさを手にする道だと思うのです。'
      }
    ],
    '静寂と森に包まれる、五感の癒やし': [
      {
        hook: '「静けさの中に、答えがあります。」',
        script: '風の音や水の流れにじっと耳を澄ませてみる。頭の中の雑音を静かに横へ置き、五感の感じるままに身を委ねる。静寂の中に身を置くだけで、失われかけていた心の調和が、すーっと戻ってくるのではないでしょうか。'
      },
      {
        hook: '「森の静寂が、傷ついた心を包み込む。」',
        script: '日常の忙しない喧騒から少し離れ、大自然の静寂に身を浸してみる。木々が放つ静かな気配は、言葉以上に私たちの心を優しく解きほぐしてくれます。静けさの中で五感を研ぎ澄ますことで、本来の自分を取り戻せる気がするのです。'
      },
      {
        hook: '「耳を澄ますと、心が澄んでいく。」',
        script: '慌ただしい日常の中では、自分の心の声すら聞こえなくなってしまいますね。自然の静けさに身を置き、静かに呼吸を繰り返す。それだけで、溜まった疲労や迷いが消え、心が驚くほど澄み渡っていくのを感じると思うのです。'
      }
    ],
    '自分を取り戻す、マインドリセット': [
      {
        hook: '「心に、小さな余白を作りましょう。」',
        script: '誰かの期待に応えようと、自分をすり減らしていませんか。一日のうちわずかでもいい、自分の心のためだけに時間を使う。素直な心で静かに自分と向き合うことで、忘れていた大切な何かが見えてくる気がするのです。'
      },
      {
        hook: '「一度、立ち止まる勇気を持ってみる。」',
        script: '走り続けることだけが正解ではありません。行き詰まった時こそ、そっと立ち止まり、溜まった感情を吐き出してみる。心に余白が生まれた時、新しい一歩を踏み出す穏やかなエネルギーが自ずと湧いてくるのではないでしょうか。'
      },
      {
        hook: '「本当の自分に、還る場所。」',
        script: '役割や面目に縛られた日常を脱ぎ捨て、素の自分に戻る時間を持つこと。静かな空間で心と体を休ませ、ありのままの自分を赦してあげる。そうして心のリセットを行うことが、明日を心豊かに生きる知恵だと思うのです。'
      }
    ]
  };

  const list = fallbackVariations[theme] || fallbackVariations['私を甘やかす、ご褒美時間'];
  // 毎回ランダムに選択
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const body = event.body ? JSON.parse(event.body || '{}') : {};
  const theme = body.theme || '私を甘やかす、ご褒美時間';

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
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

    // AI生成時のランダムシード・バリエーション指示
    const randomSeed = Math.floor(Math.random() * 100000);

    const fetchGeminiScript = async () => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `
あなたはTikTokやInstagramリールで数百万人の心に深く静かな感動を与える動画プロデューサーです。

【要求指示】
同じテーマであっても、ボタンが押されるたびに**毎回全く異なる視点・表現・比喩表現・問いかけを用いて、フレッシュなオリジナル台本**を書き下ろしてください。（シード値: ${randomSeed}）

【語り手の思想・ペルソナ（最重要手本: 松下幸之助の「素直な心」 ✕ 遠藤正俊の自然観）】
・話者背景: 世界中で自然や森と向き合ってきた70歳手前の人生の先輩（遠藤正俊）。
・お手本: 松下幸之助氏のような「素直な心」「人間への深い温かさと尊敬」「謙虚で誇らない姿勢」。
・語り口: 上品、深み、静けさ。「〜ですね」「〜だと思うのです」「〜ではないでしょうか」「〜でありたいものですね」と、静かに心にともしびを灯すような、温かく語りかける口調。

【模範とする正解出力例】
hook: "その重荷、降ろしませんか？"
script: "私たちは皆、完璧であろうと、ついつい頑張りすぎてしまいますね。しかし、森の木々が、ただそこに在るだけで美しいように、人間もまた、ありのままの姿で尊いもの。時に立ち止まり、心の奥底で感じる静けさに身を委ねてみる。それが、自分自身への一番の贈り物ではないでしょうか。素直な心で、自分を慈しむ時間を持つこと。それが、明日を生きる穏やかな力となると思うのです。"

【今回のテーマ】
${theme}

【絶対に守るべき厳格ルール（反したら即やり直し）】
❌ 1. 【「ぬる湯」「温泉」「お風呂」の完全禁止】: 「ぬる湯」「温泉」「お風呂」「湯船」「赤沢」「旅館」「オーナー」等の宣伝・風呂ワードは絶対に1文字も入れないこと！
❌ 2. 【自己紹介・PRの完全禁止】: 名前や肩書きの提示、店舗PRは一切不可。
❌ 3. 【軽々しい口調・オネエ調・若者言葉の完全禁止】: 「〜だよ」「〜だね」「甘やかしてね」「美しいんだから」といった年甲斐もない語りは厳禁。松下幸之助氏を手本とする上品で深みのある語りにすること。

【構成】
・冒頭3秒（hook）: スマホのスクロールの手がピタッと止まる、静かで本質的な問いかけ（15文字以内）
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
          temperature: 0.85 // 多彩なバリエーションを出すため設定
        }
      });

      let responseText = result.response.text().trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
      }

      const data = JSON.parse(responseText.trim());
      if (data && data.hook && data.script) {
        data.script = data.script
          .replace(/皆さん、こんにちは[。！]?/g, '')
          .replace(/赤沢温泉旅館?オーナーの遠藤正俊です[。！]?/g, '')
          .replace(/赤沢温泉/g, '')
          .replace(/赤沢/g, '')
          .replace(/旅館/g, '')
          .replace(/オーナー/g, '')
          .replace(/ぬる湯/g, '静けさ')
          .replace(/温泉/g, '自然')
          .replace(/お風呂/g, '静けさ')
          .replace(/湯船/g, '静寂')
          .replace(/20代[〜~ー]?30代の?女?性?の?皆?様?さん?/g, '')
          .trim();

        data.hook = data.hook
          .replace(/ぬる湯/g, '静けさ')
          .replace(/温泉/g, '自然')
          .replace(/赤沢/g, '');

        return data;
      }
      throw new Error('Invalid JSON structure from Gemini');
    };

    // Netlify 504タイムアウト防止のための4秒制限
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout 4000ms')), 4000)
    );

    try {
      const scriptData = await Promise.race([fetchGeminiScript(), timeoutPromise]);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(scriptData)
      };
    } catch (raceErr) {
      console.warn('Gemini generation timed out or failed, returning randomized fallback script:', raceErr.message);
      const fallback = buildFallbackScript(theme);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(fallback)
      };
    }

  } catch (error) {
    console.error('generate-script-from-rag Error:', error);
    const fallback = buildFallbackScript(theme);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(fallback)
    };
  }
};
