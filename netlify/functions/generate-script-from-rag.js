const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * ユーザー指示通りの正解モデル（松下幸之助流の素直な心・自然の理）に基づき、
 * じっくり深く語りかける十分な長さ（230文字〜280文字・約35秒〜45秒尺）の台本をランダム出力する多系フォールバックマップ
 */
function buildFallbackScript(theme) {
  const fallbackVariations = {
    '私を甘やかす、ご褒美時間': [
      {
        hook: '「その重荷、降ろしませんか？」',
        script: '私たちは皆、完璧であろうと、ついつい頑張りすぎてしまいますね。しかし、森の木々がただそこに在るだけで美しいように、人間もまた、ありのままの姿で尊いもの。誰かの期待に応えようと走り続けてきた心に、そっと休息を与えてあげる。言葉にならない静けさに身を委ね、素直な心で自分自身を慈しむ時間を持つこと。それこそが、明日を心豊かに生きるための、何より大切な贈り物になると思うのです。'
      },
      {
        hook: '「自分を甘やかすのは、悪ではありません。」',
        script: '真面目な人ほど、休むことにどこか罪悪感を覚えてしまうものです。ですが、使い古した道具を休ませるように、心にも深い休息が必要ではないでしょうか。何も生産しない時間を、自分に惜しみなく買い与えてあげる。誰のためでもない、自分だけの静かな時間の中で素直な心を取り戻すこと。そんな優しさが、疲れ切った心に新しい温もりをもたらしてくれると思うのです。'
      },
      {
        hook: '「頑張りすぎた心に、静かなご褒美を。」',
        script: '毎日、誰かのために走り続けてきたあなたへ。たまには立ち止まり、自分のためだけに静かなお茶を淹れてみる。風の音や木の葉の揺れに耳を澄ませ、心の雑音を横に置いてみる。他人の基準ではなく、あなた自身の歩幅を優しく受け入れてあげること。素直な心で自分を慈しむ時間こそが、明日を生きる穏やかな力となると信じているのです。'
      }
    ],
    '「ちゃんとしなきゃ」を手放す言葉': [
      {
        hook: '「完璧な姿など、どこにもありません。」',
        script: '自然の森を歩いていると、真っ直ぐ美しい木ばかりではないことに気づかされます。どれも曲がり、風に耐え、そのままの姿で力強く生きている。人も全く同じではないでしょうか。完璧であろうと肩を張らず、不器用な自分もそっと赦してあげる。完璧を目指すのをやめた瞬間、心に心地よい風が吹き抜け、本来の伸びやかな自分が顔を出すと思うのです。'
      },
      {
        hook: '「『完璧』の二文字を、そっと置いてみる。」',
        script: '『ちゃんとしなきゃ』と自分を追い詰めるとき、私たちは自分自身の素直な声を押し殺してしまいがちです。不完全さの中にこそ、人間らしい温もりや美しさが宿るもの。肩の力を抜き、今のありのままの自分のままで一歩を踏み出してみる。正解ばかりを求めないしなやかな心を持つことで、景色は驚くほど優しく変わっていくのではないでしょうか。'
      },
      {
        hook: '「歪みがあるから、人は美しい。」',
        script: '風に揺れる木々にひとつとして同じ形がないように、人の心も揺れて当たり前です。自分の弱さや不器用さを隠そうとせず、そのまま抱きしめてあげること。素直な心で自分と向き合うとき、他人の目から解放された本当の静けさが戻ってきます。肩肘を張らずに生きることこそが、人生を深く豊かなものにしてくれると思うのです。'
      }
    ],
    '本当の豊かさと自分らしさ': [
      {
        hook: '「他人のスピードに、惑わされなくていい。」',
        script: '周りの賑やかさと比べて、焦りや不安を覚える夜もあるかもしれません。しかし、本当の豊かさとは、目に見える成果や所有の多さではなく、静かな場所で自分の心を慈しめること。他人の基準ではなく、あなた自身の歩幅で一日一日を丁寧に重ねていく。自分のペースを愛せる素直な心を持つことこそが、最も贅沢で確かな生き方ではないでしょうか。'
      },
      {
        hook: '「豊かな人生とは、心が穏やかであること。」',
        script: '多くのものを手に入れることだけが、幸せではありません。静かな木漏れ日や、ふと立ち止まった時の呼吸の深さ。そうした目に見えない小さな豊かさに気づける素直な心を持つこと。世間の物差しをそっと手放し、自分が心から心地よいと感じる時間を生きる。それこそが、何ものにも代えがたい本当の豊かな人生だと思うのです。'
      },
      {
        hook: '「自分だけの歩幅を、愛すること。」',
        script: '他人の評価で自分を測り続けていると、やがて心がすり減ってしまいますね。大切なのは、自分自身の声に耳を傾け、ありのままの歩みを尊重してあげること。静かな空間で自分と対話し、素直な心で今日という一日を慈しむ。誰かと比べるのをやめたとき、あなたの中に確かな安心感と豊かな時間が広がっていくと思うのです。'
      }
    ],
    '静寂と森に包まれる、五感の癒やし': [
      {
        hook: '「静けさの中に、答えがあります。」',
        script: '風の音や木の葉が擦れ合う声に、じっと耳を澄ませてみる。頭の中の慌ただしい雑音を静かに横へ置き、五感の感じるままに身を委ねてみる。言葉を超えた自然の静寂に身を置くだけで、日常の摩擦で擦り切れていた心の調和が、すーっと戻ってくるのを感じます。素直な心で静けさと共にあること。それが心を深く癒やしてくれるのではないでしょうか。'
      },
      {
        hook: '「森の静寂が、傷ついた心を包み込む。」',
        script: '日常の忙しない喧騒から少し離れ、大自然の懐に身を浸してみる。木々が放つ静かな気配は、言葉以上に私たちの疲れた心を優しく包み込んでくれます。五感を研ぎ澄まし、ただそこに咲く花や風を感じること。頭で考えるのをやめ、心が静かになる時間を自分に許すことで、失われていた穏やかな力が甦ってくる気がするのです。'
      },
      {
        hook: '「耳を澄ますと、心が澄んでいく。」',
        script: '慌ただしい日常の中では、自分自身の本当の声すら聞こえなくなってしまいますね。静かな環境に身を置き、深くゆっくりと呼吸を繰り返してみる。それだけで、胸の底に溜まった疲労や迷いが解き放たれ、心が驚くほど澄み渡っていく。素直な心で静寂を味わう時間こそが、明日を前向きに生きるための大切な源泉だと思うのです。'
      }
    ],
    '自分を取り戻す、マインドリセット': [
      {
        hook: '「心に、小さな余白を作りましょう。」',
        script: '誰かの期待に応えようと無理を重ね、自分自身を見失っていませんか。一日のうちわずかでもいい、役割も仮面も脱ぎ捨てて自分と向き合う時間を作る。素直な心で静かに自分の感情を受け止めてあげることで、忘れていた大切な何かが見えてくるはずです。心にゆったりとした余白を持つことこそが、自分を取り戻す一番の近道ではないでしょうか。'
      },
      {
        hook: '「一度、立ち止まる勇気を持ってみる。」',
        script: 'がむしゃらに走り続けることだけが、生きる正解ではありません。行き詰まりを感じたときこそ、そっと立ち止まり、背負い込んだ重荷を降ろしてみる。心に静かな隙間が生まれたとき、新しい一歩を踏み出すための穏やかで強いエネルギーが自然と湧き上がってくる。素直な心で休むことは、立ち止まるのではなく前進なのだと思うのです。'
      },
      {
        hook: '「本当の自分に、還る場所。」',
        script: '世間の立場や面目に縛られた日常をひととき離れ、素の自分に戻る時間を持つこと。静かな空間で心と体をゆったりと休ませ、頑張ってきた自分を心から褒めてあげる。そうして定期的に心のリセットを行うことが、どんな時代であっても自分らしく生き抜くための、深くて温かい知恵なのだと私は思うのです。'
      }
    ]
  };

  const list = fallbackVariations[theme] || fallbackVariations['私を甘やかす、ご褒美時間'];
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
      const { PHILOSOPHY } = require('./_lib-endo/endo-philosophy');
      ragContent = PHILOSOPHY;
    } catch (err) {
      console.warn('Failed to read RAG corpus:', err);
    }

    const randomSeed = Math.floor(Math.random() * 100000);

    const fetchGeminiScript = async () => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `
あなたはTikTokやInstagramリールで数百万人の心に深く静かな感動を与える動画プロデューサーです。

【最重要要求: 動画尺の長さをじっくり30〜45秒（文字数 230文字〜280文字）にすること】
短すぎる台本（15秒以下など）は厳禁です。じっくりと深みをもって語りかける、たっぷりとしたボリューム（230文字〜280文字程度）の長尺台本を書き下ろしてください。（シード値: ${randomSeed}）

【語り手の思想・ペルソナ（最重要手本: 松下幸之助の「素直な心」 ✕ 遠藤正俊の自然観）】
・話者背景: 世界中で自然や森と向き合ってきた70歳手前の人生の先輩（遠藤正俊）。
・お手本: 松下幸之助氏のような「素直な心」「人間への深い温かさと尊敬」「謙虚で誇らない姿勢」。
・語り口: 上品、深み、静けさ。「〜ですね」「〜だと思うのです」「〜ではないでしょうか」「〜でありたいものですね」と、静かに心にともしびを灯すような、温かく語りかける口調。

【模範とする正解出力例（230〜280文字）】
hook: "その重荷、降ろしませんか？"
script: "私たちは皆、完璧であろうと、ついつい頑張りすぎてしまいますね。しかし、森の木々がただそこに在るだけで美しいように、人間もまた、ありのままの姿で尊いもの。誰かの期待に応えようと走り続けてきた心に、そっと休息を与えてあげる。言葉にならない静けさに身を委ね、素直な心で自分自身を慈しむ時間を持つこと。それこそが、明日を心豊かに生きるための、何より大切な贈り物になると思うのです。"

【今回のテーマ】
${theme}

【絶対に守るべき厳格ルール（反したら即やり直し）】
❌ 1. 【「ぬる湯」「温泉」「お風呂」の完全禁止】: 「ぬる湯」「温泉」「お風呂」「湯船」「赤沢」「旅館」「オーナー」等の宣伝・風呂ワードは絶対に1文字も入れないこと！
❌ 2. 【自己紹介・PRの完全禁止】: 名前や肩書きの提示、店舗PRは一切不可。
❌ 3. 【軽々しい口調・オネエ調・若者言葉の完全禁止】: 「〜だよ」「〜だね」「甘やかしてね」「美しいんだから」といった年甲斐もない語りは厳禁。松下幸之助氏を手本とする上品で深みのある語りにすること。

【構成規定】
・冒頭3秒（hook）: スマホのスクロールの手がピタッと止まる、静かで本質的な問いかけ（15文字以内）
・台本本文（script）: 聴くだけで胸のつかえが降り、素直な心を取り戻せるような人生の静かな洞察。文字数は必ず【230文字〜280文字程度】（音声で35秒〜45秒尺）にたっぷり書き下ろすこと。

【思想インプット】
${ragContent.substring(0, 1000)}

必ず以下のJSON形式のみを出力してください（JSON以外のテキストやMarkdown装飾は禁止）:
{"hook": "フック文", "script": "アバター用台本"}
`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { 
          responseMimeType: 'application/json',
          temperature: 0.8
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
