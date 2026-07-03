const dayjs = require('dayjs');
const { BRAND } = require('./brand');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

// 投稿テーマのキーワードマップ（ルールベース分類用）
const THEME_KEYWORDS = {
  '無駄の美学': ['無駄', '枯れ葉', '効率', '余裕', '余白'],
  '完璧という呪縛': ['完璧', '不完全', 'プレッシャー', '歪み', '正解'],
  '失われた日本の魂': ['魂', '奥日本', '秘境', '原風景', '伝統', 'アイデンティティ'],
  '自然との距離': ['自然', 'せせらぎ', '森', '川', '虫', '苔', '呼吸'],
  '成功の定義': ['成功', '数字', 'お金', '地位', '幸せ', '豊かさ'],
  '情報過多の疲弊': ['情報', '疲弊', 'スマホ', 'SNS', '沈黙', '静寂'],
  '日本の未来への不安': ['未来', '不安', '衰退', '少子化', '歴史', '過去'],
  '自己肯定感の低さ': ['自己肯定', '比較', '価値', '葛藤', '自分らしく']
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

  const primary = input.simpleTag || (scores[0]?.score ? scores[0].theme : '無駄の美学');
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
    '無駄の美学': {
      scene: `「無駄」があるからこそ、心に余白が生まれる。`,
      detail: `世界中を植林し「生」を育んできた私が最後にたどり着いたのは、この山奥の「枯れ葉」の美しさでした。効率だけでは見えない命の循環があります。`,
      instagramQuote: `“All gold does not glitter, not all those who wander are lost.”\n(すべての黄金が輝くわけではなく、彷徨う者すべてが道に迷っているわけではない。)`,
      xText: `かつては数字を追い、今は季節を追う。どちらが人間らしいか、未だ答えは出ない。だが、数字を追うことに疲れた魂は、季節の中に救いを見出すだろう。`
    },
    '完璧という呪縛': {
      scene: `完璧でなくていい。その不完全さにこそ美がある。`,
      detail: `日本人は完璧を求めすぎるあまり、自分自身をすり減らしています。古民家の歪んだ柱や、不揃いな石畳の美しさに目を向けてみてください。`,
      instagramQuote: `“There is a crack in everything. That's how the light gets in.”\n(すべてのものにはひびがある。そこから光が入るのだ。)`,
      xText: `日本人はなぜ、これほどまでに「完璧」を求めるのか。世界から見れば、その「余白」こそが魅力なのに。あなたの心の「余白」は、今、何で埋められているだろうか？`
    },
    '失われた日本の魂': {
      scene: `観光地ではない『奥日本』に、失われた魂を探す旅。`,
      detail: `海外の富裕層が日本の秘境に惹かれるのは、彼ら自身の失われた魂のあり処を、日本の原風景や伝統に見出しているからです。`,
      instagramQuote: `“The real voyage of discovery consists not in seeking new landscapes, but in having new eyes.”\n(真の発見の旅とは、新しい景色を探すことではなく、新しい目を持つことにある。)`,
      xText: `地図に残らない日本を歩く。奥日本シルバールートは、単なる道ではない。それは、忘れられた日本の記憶を辿り、あなたの魂を呼び覚ます旅だ。`
    },
    '自然との距離': {
      scene: `川の音に沈黙し、自然と繋がるということ。`,
      detail: `世界中の森を見てきて気づいたのは、日本にしかない「沈黙」の価値です。川のせせらぎや風の音は、あなたの心と対話するための余白です。`,
      instagramQuote: `“Look deep into nature, and then you will understand everything better.”\n(自然を深く見つめなさい。そうすれば、すべてをより理解できるようになる。)`
    }
  };

  const selected = templates[theme] || templates['無駄の美学'];
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
      userText || tone.scene,
      userText ? '' : tone.detail,
      '',
      tone.instagramQuote,
      '',
      BRAND.profileInstagram
    ].filter(Boolean);
    return {
      text: `${lines.join('\n')}\n\n${buildFallbackHashtags(classification, 'instagram').join(' ')}`,
      narration: userText || `${tone.scene}。${tone.detail}`
    };
  } else if (channel === 'x') {
    const mainText = userText || `${tone.xText}\n\n${BRAND.site}`;
    return {
      text: mainText.slice(0, 280),
      narration: userText || tone.xText
    };
  }
  return { text: userText };
}

// RAG検索ロジック (構造化されたビジョン・ミッション・戦略JSONを丸ごとGeminiに流し込み)
function retrieveStrategySegments(input) {
  try {
    const dbPath = path.join(__dirname, 'strategy_rag_db.json');
    if (!fs.existsSync(dbPath)) return '';
    return fs.readFileSync(dbPath, 'utf8');
  } catch (error) {
    console.error('RAG retrieval failed:', error);
    return '';
  }
}

// Gemini APIを使った高度な下書き生成
async function generateDraftWithGemini(input, classification) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const ragContext = retrieveStrategySegments(input);

    const systemPrompt = `
    あなたは赤沢温泉旅館のオーナー「遠藤正俊」氏の個人SNSアカウント（InstagramおよびX）の発信をサポートする専属AIです。
    遠藤氏の経歴やビジョンは以下の通りです。これらを深く理解した上で、入力された投稿メモや撮影場所に基づいて、心に深く刺さる下書きを生成してください。

    ■ RAGによる『遠藤正俊個人SNS戦略提案書』からの関連情報（コンテキスト）
    以下の戦略提案書の内容に必ず合致するトーン、テーマ、およびインサイトを用いて投稿文を生成してください：
    ${ragContext}

    ■ 遠藤正俊のプロフィール・ブランドアイデンティティ
    - 肩書: 世界を植林してきた元博士 / 赤沢温泉旅館オーナー
    - 全体コンセプト: 「${BRAND.concept}」
    - Instagram発信テーマ: 「${BRAND.instagramTheme}」
      - コンテンツ像: 自然の美しい映像・環境音を背景に、情緒的・哲学的なナレーション（英語やスペイン語の格言・詩の引用とその日本語訳テロップ）を重ね、視覚と聴覚から心に染み渡るような表現。
    - X発信テーマ: 「${BRAND.xTheme}」
      - コンテンツ像: ビジネスパーソンとしての葛藤、世界の植林現場での過酷な体験と、現在の山奥での経営や猫との生活を対比させた「独り言」。知的な議論や内省、深い共感を呼ぶ140文字〜280文字以内の短文。

■ 今回の投稿情報
- 指定テーマ: ${classification.primary} ${classification.secondary.length ? `(副テーマ: ${classification.secondary.join(', ')})` : ''}
- オーナーの投稿メモ: ${input.ownerComment || '特になし'}
- 撮影場所: ${input.location || '旅館周辺の自然'}
- 猫の名前: ${input.catName || 'なし'}
- 公開NG/注意事項: ${input.ngMemo || '特になし'}

■ 出力フォーマットの要件
必ず以下のJSONフォーマット（プレーンなJSONオブジェクト）のみを返してください。マークダウンの囲み(\`\`\`json など)は不要です。
{
  "instagram": {
    "text": "Instagram用のキャプション全文。情緒的で深いトーン。戦略PDFのハッシュタグを最後に改行を挟んで入れること。遠藤氏のプロフィール紹介文も含める。",
    "narration": "Instagramリール動画用のナレーション原稿（1分以内、約150〜200文字程度）。美しい日本語で、動画のテロップにもなる文章。詩的で心に響く表現。英語・スペイン語の短い格言とその訳も含めると良い。"
  },
  "x": {
    "text": "X用の投稿テキスト（140文字〜最大280文字）。改行やハッシュタグ、最後に公式サイトURL(${BRAND.site})を含め、知的で思わず考え込んでしまうような深い独り言。",
    "narration": "X用の読み上げ用テキスト（動画を添付する場合のナレーション原稿）。"
  },
  "altText": "投稿画像の代替テキスト（バリアフリー用、100文字程度）"
}
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });
    const responseText = result.response.text();
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

  // Gemini APIでの生成を試みる
  const geminiDraft = await generateDraftWithGemini(input, classification);

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

module.exports = { buildDraftPackage };
