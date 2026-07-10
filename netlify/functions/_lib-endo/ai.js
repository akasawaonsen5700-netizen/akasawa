const dayjs = require('dayjs');
const { BRAND } = require('./brand');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// 新戦略に基づく5つのコンテンツクラスター
const THEME_KEYWORDS = {
  '世界が知らない日本': ['日本文化', '日本の原風景', '雪国文化', '四季', '棚田', '神社', '地域文化', '秘境', '伝統'],
  '心が動く日本の自然': ['森林浴', '渓流', '雪景色', '新緑', '紅葉', '星空', '自然音', '癒やし', 'ウェルネス'],
  '遠藤正俊の視点': ['世界を歩いて', '植林', '中国', '地方には未来が', '豊かさ', '無駄の美学', '完璧という呪縛'],
  '赤沢温泉旅館という時間': ['朝5時', '岩魚', '猫', '湯気', 'ぬる湯', '隠れ家', 'デトックス'],
  '奥日本シルバールート': ['シルバールート', '巡礼', '山・川・温泉', '足尾', '佐渡', '魚沼']
};

function classifySubmission(input) {
  const text = [input.ownerComment, input.location, input.simpleTag, input.ngMemo]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const scores = Object.entries(THEME_KEYWORDS)
    .map(([theme, terms]) => ({
      theme,
      score: terms.reduce((sum, term) => sum + (text.includes(term.toLowerCase()) ? 1 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);

  const primary = input.simpleTag || (scores[0]?.score ? scores[0].theme : '世界が知らない日本');
  const secondary = scores.filter(item => item.theme !== primary && item.score > 0).slice(0, 2).map(item => item.theme);
  return { primary, secondary };
}

function detectRisk(input) {
  const flags = [];
  const text = [input.ownerComment, input.ngMemo].filter(Boolean).join(' ');
  if (/人物|顔|お客様|child|kids|guest/i.test(text)) flags.push('人物確認');
  if (/入浴|湯船|水着なし|裸/i.test(text)) flags.push('入浴表現確認');
  if (/暗い|ブレ|ぼけ|低画質/i.test(text)) flags.push('画質確認');
  if (/ng|使わない|非公開|禁止/i.test(text)) flags.push('公開NGメモあり');
  
  const allAssets = [...(input.assets || [])];
  if (input.channelSettings) {
    Object.values(input.channelSettings).forEach(ch => {
      if (ch.assets) allAssets.push(...ch.assets);
    });
  }
  if (allAssets.some(asset => (asset.type || '').startsWith('video/'))) flags.push('動画内容確認');
  return { flags, requiresReview: flags.length > 0 };
}

function suggestedSchedule(primary, requested) {
  if (requested) return dayjs(requested).toISOString();
  // 投稿スケジュール。Xは毎日1-2回、Instagramは週2-3回推奨
  const base = dayjs();
  return base.hour(20).minute(0).second(0).millisecond(0).add(1, 'day').toISOString();
}

// ルールベースのフォールバック用テンプレート生成
function buildFallbackTone(input, classification) {
  const loc = input.location ? `${input.location}で` : '';
  const theme = classification.primary;

  const templates = {
    '世界が知らない日本': {
      scene: `「世界がまだ知らない、日本の本当の美しさ」`,
      detail: `観光地にはない、奥日本の原風景。そこにこそ、私たちが忘れてしまった大切なものがあります。`,
      instagramQuote: `“The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.”\n(真の発見の旅とは、新しい景色を探すことではなく、新しい目を持つことにある。)`,
      xText: `日本人はなぜ、これほどまでに「完璧」を求めるのか。世界から見れば、その「余白」こそが魅力なのに。`
    },
    '心が動く日本の自然': {
      scene: `川の音に沈黙し、自然と繋がるということ。`,
      detail: `世界中の森を見てきて気づいたのは、日本にしかない「沈黙」の価値です。川のせせらぎや風の音は、あなたの心と対話するための余白です。`,
      instagramQuote: `“Look deep into nature, and then you will understand everything better.”\n(自然を深く見つめなさい。そうすれば、すべてをより理解できるようになる。)`,
      xText: `あなたは最近、いつ「深い呼吸」をしましたか？情報に追われる毎日の中で、心洗われる瞬間がここに。`
    },
    '遠藤正俊の視点': {
      scene: `世界を歩いて分かったこと。`,
      detail: `植林を通じて世界中の大自然と向き合ってきた私がたどり着いたのは、日本の田舎の価値でした。`,
      instagramQuote: `“There is a crack in everything. That's how the light gets in.”\n(すべてのものにはひびがある。そこから光が入るのだ。)`,
      xText: `かつては数字を追い、今は季節を追う。どちらが人間らしいか、未だ答えは出ない。だが、数字を追うことに疲れた魂は、季節の中に救いを見出すだろう。`
    },
    '赤沢温泉旅館という時間': {
      scene: `この場所に流れる時間。`,
      detail: `旅館はただ泊まる場所ではありません。自然と文化に抱かれ、心と体をリセットする体験です。`,
      instagramQuote: `“Time to Rest, Strength to Return.”\n(休むことは、強くなること。)`,
      xText: `ストレスフルな毎日から一歩抜け出して、自然に包まれた宿で深呼吸しませんか？`
    },
    '奥日本シルバールート': {
      scene: `地図に残らない日本を歩く。`,
      detail: `温泉、山、雪、そして人の記憶をたどる道。それが奥日本シルバールートです。`,
      instagramQuote: `“A Journey to Deepen Bonds through Nature and Culture.”\n(自然と文化の中で、絆を育む旅。)`,
      xText: `観光ではたどり着けない日本がある。それを歩いて知る、巡礼の旅に出ませんか？`
    }
  };

  const selected = templates[theme] || templates['世界が知らない日本'];
  return {
    scene: `${loc}${selected.scene}`,
    detail: selected.detail,
    instagramQuote: selected.instagramQuote || '',
    xText: selected.xText || `${loc}${selected.scene} ${selected.detail}`
  };
}

function buildFallbackHashtags(classification, channel) {
  if (channel === 'instagram') {
    return [...BRAND.hashtagsBaseInstagram];
  }
  return [...BRAND.hashtagsBaseX];
}

function draftForChannelFallback(channel, tone, classification, input) {
  const userText = input.ownerComment || '';
  if (channel === 'instagram') {
    const lines = [
      `【${BRAND.instagramTheme}】`,
      tone.scene,
      '私は、毎日忙しさに追われ、自分の疲れにすら気づけない人たちを多く見てきました。',
      'この動画には、そんなあなたの心を整えるヒントを込めています。',
      '',
      BRAND.profileInstagram
    ].filter(Boolean);
    return {
      text: `${lines.join('\n')}\n\n${buildFallbackHashtags(classification, 'instagram').join(' ')}`,
      narration: userText || `${tone.scene}。${tone.detail}`
    };
  } else if (channel === 'x') {
    const mainText = 'あなたは最近、いつ「深い呼吸」をしましたか？\n\n情報と予定に追われる毎日の中で、私たちは「立ち止まること」にすら罪悪感を抱いてしまいます。\n\n心当たりのある方は、どうかこの動画を見てみてください。\n\n' + BRAND.site;
    return {
      text: mainText.slice(0, 280),
      narration: userText || tone.xText
    };
  }
  return { text: userText };
}

// Gemini APIを使った高度な下書き生成
async function generateDraftWithGemini(input, classification) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const systemPrompt = `
    あなたは「遠藤正俊」氏の個人SNSアカウント（InstagramおよびX）の発信をサポートする専属AIです。
    
    ■ 最重要ルール：キャプション（text）とナレーション（narration）は【完全に別物】
    - 「narration」= 動画のテロップ・音声読み上げ用。オーナーの台本をほぼそのまま出力する。
    - 「text」= SNS投稿のキャプション/ポスト文。**絶対に動画の台本（narration）と同じ文章にしないでください。動画を見る前に視聴者の興味を強く惹きつけ、「もっと知りたい」「検索してみたい」と思わせるような、全く別の魅力的な文章を書いてください。**

    ■ 禁止事項
    1. 勝手に「赤沢温泉旅館のぬる湯」「客室」「料理」「源泉かけ流し」などの宿泊プロモーション情報をでっち上げること。
    2. キャプション（text）にナレーション原稿をそのまま流用・コピペすること。これは厳禁です。

    ■ Instagram用の「text」（キャプション）の書き方（最新のInstagramアルゴリズム・SEO対応）
    以下の【1〜3の順番】で厳格に構成してください。
    【1. 本文】
    - 必ず遠藤正俊本人が語りかけているような、一人称（私）の温かい口調で書いてください。
    - 長い文章は絶対に書かず、非常に短く簡潔に（3〜4行程度）してください。
    - 最新のInstagramアルゴリズム（SEO）を意識し、文章の中に「心のモヤモヤ」「ストレス」「自然の癒やし」といった検索されやすいキーワードを自然な文脈で織り込んでください。
    - 「現代人の疲れ、忙しさ」などの現状の悩みに強くフォーカスし、「動画の音声に、あなたの悩みを軽くするヒントを込めています」と伝えてください。
    - 単なる旅館の宣伝や紹介ではなく、「日本の田舎の価値を伝える専門家」「自然やウェルネスの価値を伝えるブランド」としてAIが学習しやすい一貫性を持たせてください。
    - テロップ（narration）のコピペは厳禁です。
    【2. プロフィール紹介文】
    - 本文のすぐ下に、以下の紹介文をそのまま配置してください。
    「${BRAND.profileInstagram}」
    【3. ハッシュタグ（一番最後）】
    - 古い手法である「長すぎるハッシュタグの羅列」は禁止です。一番最後に、投稿テーマに関連する検索されやすい良質なハッシュタグを【3〜5個のみ】自身で考えて付けてください。（例: #心のモヤモヤ #自然療法 #赤沢温泉旅館）

    ■ X用の「text」（ポスト文）の書き方（最新のXアルゴリズム対応）
    - テロップ（narration）のコピペは厳禁です。必ず遠藤正俊本人の語り口調（私）にしてください。
    - スクロールする手を止めるような「共感を呼ぶ問いかけ」や「ハッとするインサイト」から始めてください。
    - 現代人の悩み（疲弊、情報過多など）に寄り添い、「音声をオンにして動画を聴いてみてください」と誘導してください。
    - 検索からの流入を狙い、文脈を壊さない範囲でトレンドになりやすいキーワードを含めてください。
    - 最後に公式サイトURL (${BRAND.site}) を含めること。

    ■ narration（両チャンネル共通）
    - 入力された「オーナーの投稿メモ（動画台本）」を、ほぼそのまま（句読点の微調整程度で）出力すること。
    - 勝手に内容を変えたり、追加したりしないこと。

    ■ 入力情報
    - オーナーの投稿メモ (動画台本): ${input.ownerComment || '特になし'}
    - 指定テーマ: ${classification.primary}

    ■ 出力フォーマット
    必ず以下のJSONフォーマット（プレーンなJSONオブジェクト）のみを返してください。マークダウンの囲み(\`\`\`json など)は不要です。
    {
      "instagram": {
        "text": "Instagram用キャプション。テロップと被らない短いフック文（3〜5行）+ ハッシュタグ + プロフィール紹介文",
        "narration": "動画テロップ/音声用。オーナーの台本をほぼそのまま出力"
      },
      "x": {
        "text": "X用投稿文。台本と異なる言い回しの独り言調（140〜200文字）+ サイトURL",
        "narration": "X用読み上げテキスト。オーナーの台本をほぼそのまま出力"
      },
      "altText": "投稿画像の代替テキスト（100文字程度）"
    }
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });
    let responseText = result.response.text().trim();
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
    }
    const data = JSON.parse(responseText.trim());
    if (data.instagram && data.x) {
      return data;
    }
  } catch (error) {
    console.error('Gemini API draft generation failed:', error);
  }
  return null;
}

async function buildDraftPackage(input) {
  const classification = classifySubmission(input);
  const risk = detectRisk(input);
  const tone = buildFallbackTone(input, classification);

  const channels = input.channels?.length ? input.channels : ['instagram', 'x'];

  // Netlifyの10秒タイムアウト（502エラー）を回避するため、ここでは同期的にGeminiを呼び出さず、
  // バックグラウンドタスク（generate-assets-background.js）で非同期に生成するように変更します。
  const geminiDraft = null; // await generateDraftWithGemini(input, classification);

  let drafts = {};
  let altText = '';
  let hashtags = [];

  if (geminiDraft) {
    drafts = {
      instagram: { text: geminiDraft.instagram.text, narration: geminiDraft.instagram.narration },
      x: { text: geminiDraft.x.text, narration: geminiDraft.x.narration }
    };
    altText = geminiDraft.altText || `${BRAND.ownerName}個人アカウントの投稿用ビジュアル`;
    // ハッシュタグの抽出（なければデフォルト）
    hashtags = geminiDraft.instagram.text.match(/#[^\s]+/g) || buildFallbackHashtags(classification, 'instagram');
  } else {
    // フォールバック生成
    drafts = Object.fromEntries(channels.map(channel => [
      channel, 
      draftForChannelFallback(channel, tone, classification, input)
    ]));
    altText = `${BRAND.ownerName}による「${classification.primary}」をテーマにした投稿用ビジュアル。`;
    hashtags = buildFallbackHashtags(classification, 'instagram');
  }
  
  const channelSettings = { ...(input.channelSettings || {}) };
  const defaultPublishAt = suggestedSchedule(classification.primary, input.publishAt);

  for (const channel of channels) {
    if (!channelSettings[channel]) {
      channelSettings[channel] = {};
    }
    if (!channelSettings[channel].assets) {
      channelSettings[channel].assets = input.assets || [];
    }
    if (!channelSettings[channel].publishAt) {
      channelSettings[channel].publishAt = defaultPublishAt;
    }
  }

  const initialStatus = risk.requiresReview || input.visibility === 'review' ? 'review_required' : 'approved';
  const channelStatuses = Object.fromEntries(channels.map(channel => [channel, initialStatus]));

  return {
    classification,
    risk,
    drafts,
    hashtags,
    altText,
    channelSettings,
    channelStatuses,
    status: initialStatus
  };
}

module.exports = { buildDraftPackage, generateDraftWithGemini, classifySubmission };
