/*
  塩原温泉 赤沢温泉旅館
  CEOコパイロット ✕ ②集客・マーケAI ✕ ④リピートCRM AI ✕ ⑦データ統合・分析AI
  自動運営デモシステム JavaScript (3AI連動・データ統合版)
*/
// グローバル変数
let geminiApiKey = "";
let geminiModel = "gemini-2.5-flash";
let autopilotInterval = null;
let isRunningAutopilot = false;
let mvvText = "";
let consultingText = "";
let aiAgentReportText = "";
let brandStrategyText = "";
let fullPlanText = "";
let voiceRecognition = null;
let currentDiagnosisScore = 52;
let isEmergencyFixed = false;

// モバイル向け音声ロック解除関数
let isMobileAudioUnlocked = false;
function unlockMobileAudio() {
  if (isMobileAudioUnlocked) return;
  
  // 1. AudioContext のロック解除
  try {
    if (!currentAudioCtx) {
      currentAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (currentAudioCtx && currentAudioCtx.state === "suspended") {
      currentAudioCtx.resume().then(() => {
        console.log("Mobile AudioContext resumed successfully.");
      });
    }
  } catch (e) {
    console.warn("Failed to unlock Mobile AudioContext:", e);
  }
  
  // 2. Web Speech API (speechSynthesis) のロック解除
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0.0;
      window.speechSynthesis.speak(u);
      console.log("Mobile Web Speech API unlocked.");
    }
  } catch (e) {
    console.warn("Failed to unlock Web Speech:", e);
  }
  
  isMobileAudioUnlocked = true;
}


// ==================== VOICEVOX 音声合成 ====================
let voiceEnabled = false;
let selectedVoiceSpeaker = 5; // デフォルト: 東北ずん子
let isPlayingVoice = false;
let currentAudioCtx = null;
let currentAudioSource = null;

// VOICEVOXキャラクター定義
const voicevoxSpeakers = [
  { id: 5,  name: "東北ずん子",   emoji: "🌸", style: "元気・明るい" },
  { id: 8,  name: "春日部つむぎ", emoji: "🌻", style: "明るい・優しい" },
  { id: 46, name: "小夜/SAYO",  emoji: "🌙", style: "落ち着き・落ち着いた新しい風" }
];
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const apiBaseUrl = isLocal ? "https://generativelanguage.googleapis.com" : "/api";
// 宿のファクトデータベース
const ryokanFacts = {
  name: "塩原温泉 赤沢温泉旅館",
  tel: "0287-46-5700",
  address: "〒329-2921 栃木県那須塩原市塩原1149",
  details: {
    onsen: "自家源泉かけ流しの「ぬる湯」（源泉44℃、浴槽38〜40℃）。長湯に最適で自律神経を整える温泉。",
    cats: "みーちゃん、ちびちゃん、ハチ、さくらの看板猫4匹がお出迎え。保護猫活動にも注力。",
    chef: "中国人シェフによる創作中華。木金日限定でヴィーガン中華コースを提供。川魚は炭火で焼きたて提供。",
    view: "箒川（ほうきがわ）の目の前、全室リバービューで川のせせらぎが聞こえる静かな全10室の小宿。"
  }
};
// 顧客データベース（ダミーデータ）
const customerDatabase = [
  { id: 1, name: "佐藤 健二 様", visits: 5, lastVisit: "2026-03-12", tags: ["cats", "onsen"], prob: 75 },
  { id: 2, name: "リン・チェン 様 (台湾)", visits: 2, lastVisit: "2026-04-05", tags: ["onsen", "vegan"], prob: 60 },
  { id: 3, name: "田中 美咲 様", visits: 12, lastVisit: "2026-05-10", tags: ["cats", "vip"], prob: 95 },
  { id: 4, name: "鈴木 拓海 様", visits: 1, lastVisit: "2025-11-20", tags: ["onsen"], prob: 30 },
  { id: 5, name: "高橋 陽子 様", visits: 3, lastVisit: "2026-02-28", tags: ["vegan"], prob: 50 },
  { id: 6, name: "ジェームズ・スミス 様", visits: 1, lastVisit: "2026-04-18", tags: ["onsen", "vegan"], prob: 45 },
  { id: 7, name: "渡辺 裕太 様", visits: 8, lastVisit: "2026-05-01", tags: ["cats", "onsen", "vip"], prob: 88 },
  { id: 8, name: "小林 杏奈 様", visits: 2, lastVisit: "2025-08-15", tags: ["cats"], prob: 20 },
  { id: 9, name: "チャン・ワイマン 様 (香港)", visits: 1, lastVisit: "2026-03-25", tags: ["cats", "vegan"], prob: 55 },
  { id: 10, name: "加藤 雅也 様", visits: 15, lastVisit: "2026-05-18", tags: ["onsen", "vip"], prob: 98 }
];

// モックデータ定義
const mockSolutions = {
  cats: {
    hp_summary: `<!-- AI Overviews & 看板猫ブロック -->
<div class="ryokan-summary-block" style="border: 2px solid #d4af37; background: #faf8f5; padding: 20px; border-radius: 12px; font-family: 'Noto Serif JP', serif; color: #333;">
  <h2 style="color: #1b3b2b; font-size: 20px; margin-top: 0; border-bottom: 2px solid #1b3b2b; padding-bottom: 8px;">看板猫4匹とふれあう癒やしの温泉宿</h2>
  <p style="font-size: 15px; line-height: 1.7; margin-bottom: 15px;">
    当館は<strong>「みーちゃん」「ちびちゃん」「ハチ」「さくら」の4匹の個性豊かな看板猫</strong>が暮らす、猫好きにはたまらない温泉旅館です。ロビーでのふれあいはもちろん、保護猫活動を支援するストーリーもあり、将来的な保護猫カフェ併設に向けて取り組んでいます。猫アレルギーのお客様向けには、空気清浄機の設置や入念な清掃を徹底したお部屋をご案内しています。
  </p>
</div>`,
    hp_jsonld: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "name": "塩原温泉 赤沢温泉旅館",
  "telephone": "0287-46-5700",
  "address": {
    "@type": "PostalAddress",
    "postalCode": "329-2921",
    "addressRegion": "栃木県",
    "addressLocality": "那須塩原市",
    "streetAddress": "塩原1149"
  },
  "amenityFeature": [
    { "@type": "LocationFeatureSpecification", "name": "看板猫4匹在籍(みーちゃん他)", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "保護猫支援活動", "value": true }
  ]
}
<\/script>`,
    gbp_post: `【看板猫みーちゃんのまったり日常日記 ＆ 保護猫カフェプロジェクト】
ロビーの特等席でお昼寝中の看板猫「みーちゃん」をお届けします🐱
当館は保護猫4匹が元気に働いており、売上の一部は保護猫活動に役立てられています。将来の「保護猫カフェ併設」に向けて一歩ずつ進んでいます。
猫好きのお客様限定のプランや特典もご用意しておりますので、ぜひ猫ちゃんたちに会いに来てくださいね！
#塩原温泉 #赤沢温泉旅館 #看板猫 #保護猫活動 #猫のいる暮らし`,
    gbp_img_desc: "ストーブの前で丸まって気持ちよさそうに眠るみーちゃんのドアップ写真",
    insta_post: `今日のロビーのアイドル、ちびちゃんです🐾
お客様がお越しになると、トコトコと寄っていってご挨拶するのが得意な甘えん坊さん。
当館自慢の「ぬる湯」で心ゆくまで温まった後は、ロビーで猫ちゃんたちとふれあって、最高の癒やしタイムをお過ごしください。
Mascot cat "Chibi-chan" greeting our guests at the lobby! Come and be healed by our natural hot spring and friendly cats. 🐱♨️
#赤沢温泉旅館 #塩原温泉 #看板猫 #猫のいる宿 #保護猫 #猫好きさんと繋がりたい #CatLovers #NasuShiobara #RyokanCat #CatsOfInstagram`,
    line_post: `【猫好きの皆様へ限定🐈】いつも赤沢温泉旅館を応援いただきありがとうございます。
看板猫「みーちゃん」「ちびちゃん」たちから日頃の感謝を込めて、猫ちゃん大好きリピーター様限定の『オリジナル猫おやつ差し入れ特典付きプラン』のシークレットクーポンをお送りします！
ご宿泊時にこの画面を見せていただくと、猫ちゃんに直接おやつをあげられる「おやつセット」をプレゼントいたします。また会いにお越しくださいにゃん🐾`,
    report: `【データ統合分析AI・経営改善提言レポート】
対象施策：猫好きリピート促進対策
データ抽出期間：本日（リアルタイム同期）
1. 施策実施効果（速報値）
- 集客チャネル露出度：SNSでの猫ちゃん投稿が好調で、インプレッション数が前週比 +24% と急拡大しています。
- CRM顧客応答：LINEによる「猫おやつ付きプラン」クーポン配信により、LINE友だちの開封率が 68% を突破。
2. 顧客データベース相関分析
- 「猫好き (cats)」タグを持つ佐藤様、田中様、渡辺様の次回再来店予測スコアが軒並み 5〜10% 向上しました。
- アンケート満足度（ポジティブ率）も、猫ちゃんとの触れ合い報告の増加により 75% ➔ 88% へと改善しています。
3. 経営戦略・次回への提言
- 猫好き顧客のリピート率は非常に高いため、次回予約時の「お部屋への看板猫派遣サービス（アレルギーがないお客様限定）」などのさらなるプレミアム体験オプションを新設することで、客単価アップが期待できます。
- 露出増加に伴い、猫アレルギーについての懸念問い合わせも微増しているため、HPのFAQにおける「アレルギー対策と客室隔離の取り組み」の記述をさらに強化することを推奨します。`
  },
  summer: {
    hp_summary: `<!-- AI Overviews & 夏のぬる湯ブロック -->
<div class="ryokan-summary-block" style="border: 2px solid #d4af37; background: #faf8f5; padding: 20px; border-radius: 12px; font-family: 'Noto Serif JP', serif; color: #333;">
  <h2 style="color: #1b3b2b; font-size: 20px; margin-top: 0; border-bottom: 2px solid #1b3b2b; padding-bottom: 8px;">夏こそ入りたい、源泉かけ流しの「ぬる湯」</h2>
  <p style="font-size: 15px; line-height: 1.7; margin-bottom: 15px;">
    栃木県塩原温泉郷の箒川沿いに位置する当館は、<strong>38〜40℃の自家源泉かけ流し「ぬる湯」</strong>が最大の魅力です。熱い温泉とは異なり、体に負担をかけずに1時間以上じっくり長湯ができ、夏の湯あたりや冷え性防止、自律神経の回復に最適です。川の心地よいせせらぎを聞きながら、心身を解きほぐす極上の長湯をご体験いただけます。
  </p>
</div>`,
    hp_jsonld: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "name": "塩原温泉 赤沢温泉旅館",
  "telephone": "0287-46-5700",
  "address": {
    "@type": "PostalAddress",
    "postalCode": "329-2921",
    "addressRegion": "栃木県",
    "addressLocality": "那須塩原市",
    "streetAddress": "塩原1149"
  },
  "amenityFeature": [
    { "@type": "LocationFeatureSpecification", "name": "自家源泉100%ぬる湯かけ流し(38-40℃)", "value": true },
    { "@type": "LocationFeatureSpecification", "name": "全室リバービューの静かな環境", "value": true }
  ]
}
<\/script>`,
    gbp_post: `【夏の暑さに疲れた心身に。極上の「ぬる湯長湯」のご案内】
外は暑くても、エアコンや冷たいもので体の中は冷えがちです。当館の温泉は浴槽で「38〜40℃」に調整された自家源泉かけ流しのぬる湯。
心臓や体に負担をかけずにのんびり湯船に浸かることで、自律神経が整い、夏の睡眠不足や疲労もスッキリ解消します。せせらぎを聞きながらの「長湯体験」、ぜひお試しください。
#塩原温泉 #赤沢温泉旅館 #ぬる湯 #源泉かけ流し #湯治 #夏の冷え性 #温泉旅行`,
    gbp_img_desc: "湯気がほんのり漂う、川のせせらぎが目の前に広がる岩露天風呂の写真",
    insta_post: `夏こそ、じっくり長湯の「ぬる湯」です♨️
当館の自家源泉は湯船で約39℃。熱すぎないからこそ、1時間でものんびりと温泉に浸かることができます。川風を感じながら、夏の疲れをリセットしに来ませんか？
Cool and cozy hot spring for hot summer! Our natural spring "Nuru-yu" (39°C) is perfect for long, relaxing baths. Feel the river breeze and unwind. 🍃
#赤沢温泉旅館 #塩原温泉 #ぬる湯 #長湯 #源泉かけ流し #露天風呂 #夏旅 #自律神経を整える #温泉療法 #NasuShiobara #OnsenHealing`,
    line_post: `【夏休み平日限定・ぬる湯満喫リピートクーポン】
赤沢温泉旅館の「ぬる湯」をいつもご愛顧いただきありがとうございます。
うだるような夏の暑さを乗り切るための「長湯プラン」をご用意しました。
本クーポンをご利用のうえ、夏休みの平日にご宿泊いただいたリピーター様には、ご夕食時に「地酒の冷酒一合」または「ノンアルコール果汁サイダー」を大人人数分無料サービスいたします！
心地よい川の風と、猫ちゃんたちがお待ちしております。`,
    report: `【データ統合分析AI・経営改善提言レポート】
対象施策：夏のぬる湯長湯アピールプラン
データ抽出期間：本日（リアルタイム同期）
1. 施策実施効果（速報値）
- 集客チャネル露出度：InstagramとGoogleマップ上での「ぬる湯・長湯」紹介の閲覧数が前月比 +38% を記録。特に30代〜50代の「自律神経の乱れ・疲労蓄積」への訴求が効果を発揮。
- 新規予約件数：夏休みの平日枠に対する公式HP経由 of 新規WEB予約が本日までに前年同月比 +15% 増加。
2. 顧客データベース相関分析
- 「ぬる湯 (onsen)」タグを持つ佐藤様、鈴木様、渡辺様の再来店予測確率が向上。
- LINEクーポン「平日冷酒特典」の配布後、3 day以内でのリピート予約問い合わせが数件発生しました。
3. 経営戦略・次回への提言
- 平日の稼働率向上が顕著に表れているため、この期間を対象とした「温泉ソムリエによるぬる湯入浴法ミニガイド」などのコンテンツをHPに追加すると、さらに宿泊満足度が向上します。
- 夏休みの休前日（土曜・祝前日）は既にほぼ満室のため、マーケティングの広告バナーやSNS発信の対象を「平日限定」にさらに絞り込むことで、広告費用の最適化（CPA削減）が可能です。`
  },
  fix: {
    hp_summary: `<!-- AI Overviews & 止血要約ブロック -->
<div class="ryokan-summary-block" style="border: 2px solid #ff4d4f; background: #fff1f0; padding: 20px; border-radius: 12px; font-family: 'Noto Serif JP', serif; color: #333;">
  <h2 style="color: #cf1322; font-size: 20px; margin-top: 0; border-bottom: 2px solid #cf1322; padding-bottom: 8px;">【緊急告知】他ホテル名掲載に関するお詫びと訂正</h2>
  <p style="font-size: 15px; line-height: 1.7; margin-bottom: 15px;">
    当館公式WEBサイト上において、無関係な他ホテル名（ほてるISAGO神戸）および誤った電話番号が混入していた不具合を修正いたしました。お客様にはご混乱を招きましたことを深くお詫び申し上げます。現在は「塩原温泉 赤沢温泉旅館」として正しい情報（那須塩原市塩原1149、TEL: 0287-46-5700）に修正が完了しております。
  </p>
</div>`,
    hp_jsonld: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  "name": "塩原温泉 赤沢温泉旅館",
  "telephone": "0287-46-5700",
  "address": {
    "@type": "PostalAddress",
    "postalCode": "329-2921",
    "addressRegion": "栃木県",
    "addressLocality": "那須塩原市",
    "streetAddress": "塩原1149"
  }
}
<\/script>`,
    gbp_post: `【公式情報修正とお詫びのお知らせ】
当館のGoogleビジネスプロフィールおよびWEBサイトにおいて、誤って他府県のホテル名や誤った連絡先が表示されていた問題を修正いたしました。
当館は栃木県那須塩原市の「塩原温泉 赤沢温泉旅館（0287-46-5700）」であり、他施設とは一切関係ございません。引き続きご愛顧のほどよろしくお願い申し上げます。
#塩原温泉 #赤沢温泉旅館 #お知らせ`,
    gbp_img_desc: "正しい看板が掲げられた赤沢温泉旅館の正面玄関の写真",
    insta_post: `【公式情報の修正と正しい情報のお知らせ】
いつも赤沢温泉旅館を応援いただきありがとうございます。
このたび、公式の店舗名記述および連絡先の誤表記を完全に修正いたしました。
当館は「塩原温泉 赤沢温泉旅館」です。温泉街の箒川沿いに佇む静かな小宿として、皆様のお越しを正しいおもてなしでお待ちしております。🌱
#塩原温泉 #赤沢温泉旅館 #那須塩原 #お知らせ`,
    line_post: `【重要・公式情報修正のお知らせ】
リピーターの皆様、いつも赤沢温泉旅館をご愛顧いただきありがとうございます。
当館公式WEBサイトでのホテル名の誤表記などの不具合を修正いたしました。
ご不便をおかけいたしましたお客様には深くお詫び申し上げます。
正しい情報のもと、今後ともみーちゃんたち看板猫とぬる湯の癒やしをお届けしてまいります。`,
    report: `【データ統合分析AI・経営改善提言レポート】
対象施策：信頼毀損の緊急止血アクション（NAP統一・他ホテル名削除）
データ抽出期間：本日（リアルタイム同期）
1. 施策実施効果（速報値）
- 信頼品質スコアの劇的回復：ダミー電話番号の削除および他ホテル名「ほてるISAGO神戸」の完全削除により、検索エンジンのNAP（名前・住所・電話番号）信頼性評価が大幅に改善。
- 診断スコア変動：技術的欠陥および信頼毀損シグナルが解消されたため、AI診断総合スコアが 52点 ➔ 62点（D ➔ Cランク）に即時上昇しました。
2. 顧客データベース相関分析
- サイトの信頼品質の回復により、検索エンジンのクロール適正が向上。他同名競合（伊豆赤沢温泉）との誤認衝突リスクが低減され、「栃木県塩原温泉の赤沢温泉」としての識別性が強化されました。
3. 経営戦略・次回への提言
- 止血は完了しました。次のフェーズとして、公式HPトップへの「結論ブロック」の追加および「構造化データ（JSON-LD）」の設置を実行し、鮮度ペナルティの完全解除（C ➔ B〜Aランクへの昇格）を目指すことを強く推奨します。`
  }
};

async function loadKnowledgeBase() {
  try {
    const mvvRes = await fetch("data/mvv.txt");
    if (mvvRes.ok) {
      mvvText = await mvvRes.text();
      console.log("Loaded MVV Knowledge Base");
    }
    const consultingRes = await fetch("data/consulting.txt");
    if (consultingRes.ok) {
      consultingText = await consultingRes.text();
      console.log("Loaded Consulting Knowledge Base");
    }
    const aiAgentRes = await fetch("data/ai_agent_report.txt");
    if (aiAgentRes.ok) {
      aiAgentReportText = await aiAgentRes.text();
      console.log("Loaded AI Agent Report Knowledge Base");
    }
    const brandStrategyRes = await fetch("data/brand_strategy.txt");
    if (brandStrategyRes.ok) {
      brandStrategyText = await brandStrategyRes.text();
      console.log("Loaded Brand Strategy Knowledge Base");
    }
    const fullPlanRes = await fetch("data/full_plan.txt");
    if (fullPlanRes.ok) {
      fullPlanText = await fullPlanRes.text();
      console.log("Loaded Full Execution Plan Knowledge Base");
    }
  } catch (e) {
    console.error("Failed to load knowledge base files", e);
  }
}
// 起動時の初期化
document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  await loadConfig();
  await loadKnowledgeBase();
  renderCustomerTable("all");
  updateDiagnosisScoreUI(currentDiagnosisScore);
  initEventHandlers();
});
// 1. タブ切り替えロジック
function initTabs() {
  const navBtns = document.querySelectorAll(".nav-btn");
  const tabContents = document.querySelectorAll(".tab-content");
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      navBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(tab => tab.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(targetTab).classList.add("active");
    });
  });
  // MARKETING用のサブタブ
  const subTabBtns = document.querySelectorAll(".sub-tab-btn");
  subTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetSubTab = btn.getAttribute("data-subtab");
      const parent = btn.parentElement;
      parent.querySelectorAll(".sub-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const contentsContainer = parent.parentElement;
      contentsContainer.querySelectorAll(".sub-tab-content").forEach(c => c.classList.remove("active"));
      document.getElementById("subtab-" + targetSubTab).classList.add("active");
      renderMarketingVisualPreview(targetSubTab);
    });
  });
}
// 2. config 読み込み (.env からの fetch 含む)
async function loadConfig() {
  // 1. まず key.txt を試みる (Netlify自動生成ファイル、隠しファイルではないためブロックされない)
  try {
    const response = await fetch("key.txt");
    if (response.ok) {
      const text = await response.text();
      const val = text.trim();
      // 環境変数名そのものが書き込まれている場合や空文字の場合を除く
      if (val && !val.includes("$GEMINI_API_KEY") && !val.includes("GEMINI_API_KEY")) {
        geminiApiKey = val;
        console.log("Loaded API Key from key.txt");
      }
    }
  } catch (e) {
    console.log("Could not read key.txt via fetch");
  }

  // 2. ローカル用の .env をフォールバックとして試みる
  if (!geminiApiKey) {
    try {
      const response = await fetch(".env");
      if (response.ok) {
        const text = await response.text();
        const match = text.match(/GEMINI_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/);
        if (match && match[1]) {
          geminiApiKey = match[1].trim();
          console.log("Loaded API Key from .env");
        }
      }
    } catch (e) {
      console.log("Could not read .env file via fetch");
    }
  }

  // 3. LocalStorage をチェック (画面で明示的に上書き保存した場合に最優先)
  // ただし、key.txt や .env で新しく有効なキーがロードされた場合は、
  // LocalStorage の古いキーを自動で新しいものに上書き更新する
  const savedKey = localStorage.getItem("ryokan-gemini-key");
  if (savedKey) {
    if (geminiApiKey && geminiApiKey !== savedKey) {
      console.log("New API Key detected from server/env. Updating localStorage cache.");
      localStorage.setItem("ryokan-gemini-key", geminiApiKey);
    } else {
      geminiApiKey = savedKey;
    }
  } else if (geminiApiKey) {
    localStorage.setItem("ryokan-gemini-key", geminiApiKey);
  }
  
  const savedModel = localStorage.getItem("ryokan-gemini-model");
  const validModels = ["gemini-2.5-flash", "gemini-2.5-flash-lite-preview-06-17", "gemini-2.5-pro"];
  if (savedModel && validModels.includes(savedModel)) {
    geminiModel = savedModel;
  } else if (savedModel && !validModels.includes(savedModel)) {
    // 古い廃止モデルが保存されていたらリセット
    console.warn(`保存されていたモデル "${savedModel}" は廃止されました。gemini-2.5-flash にリセットします。`);
    localStorage.removeItem("ryokan-gemini-model");
    geminiModel = "gemini-2.5-flash";
  }

  updateApiStatusUI();
}
function updateApiStatusUI() {
  const apiDot = document.getElementById("api-status-dot");
  const apiText = document.getElementById("api-status-text");
  const keyInput = document.getElementById("api-key-input");
  const modelSelect = document.getElementById("api-model-select");
  
  if (modelSelect && geminiModel) {
    modelSelect.value = geminiModel;
  }

  if (geminiApiKey) {
    if (keyInput) keyInput.value = geminiApiKey;
    apiDot.classList.add("connected");
    apiText.innerText = `APIキー接続完了 (${geminiModel} 有効)`;
  } else {
    apiDot.classList.remove("connected");
    apiText.innerText = "APIキー未設定 (モックモード)";
  }
}
// AI診断スコアUIの更新
function updateDiagnosisScoreUI(score) {
  currentDiagnosisScore = score;
  const currentScoreEl = document.getElementById("current-score");
  const ringFillEl = document.getElementById("score-ring-fill");
  const rankBadgeEl = document.getElementById("score-rank-badge");
  
  if (currentScoreEl) currentScoreEl.innerText = score;
  if (ringFillEl) {
    const r = 50;
    const circumference = 2 * Math.PI * r; // 約314.16
    const offset = circumference * (1 - score / 100);
    ringFillEl.style.strokeDashoffset = offset;
    
    // スコアに応じて色を変更
    if (score >= 80) ringFillEl.style.stroke = "var(--success)";
    else if (score >= 70) ringFillEl.style.stroke = "var(--primary)";
    else if (score >= 60) ringFillEl.style.stroke = "var(--warning)";
    else ringFillEl.style.stroke = "var(--danger)";
  }
  if (rankBadgeEl) {
    rankBadgeEl.className = "score-rank-badge";
    if (score >= 90) {
      rankBadgeEl.innerText = "S ランク";
      rankBadgeEl.classList.add("rank-s");
    } else if (score >= 80) {
      rankBadgeEl.innerText = "A ランク";
      rankBadgeEl.classList.add("rank-a");
    } else if (score >= 70) {
      rankBadgeEl.innerText = "B ランク";
      rankBadgeEl.classList.add("rank-b");
    } else if (score >= 60) {
      rankBadgeEl.innerText = "C ランク";
      rankBadgeEl.classList.add("rank-c");
    } else {
      rankBadgeEl.innerText = "D ランク";
      rankBadgeEl.classList.add("rank-d");
    }
  }
}

// 3. 顧客テーブルの描画
function renderCustomerTable(segment = "all") {
  const tbody = document.getElementById("crm-customer-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const filtered = customerDatabase.filter(c => {
    if (segment === "all") return true;
    if (segment === "cats") return c.tags.includes("cats");
    if (segment === "onsen") return c.tags.includes("onsen");
    if (segment === "vegan") return c.tags.includes("vegan");
    return true;
  });
  filtered.forEach(c => {
    const tr = document.createElement("tr");
    const tagsHtml = c.tags.map(t => {
      let label = t;
      let cl = "crm-tag";
      if (t === "cats") { label = "🐱 猫好き"; cl += " tag-cat"; }
      if (t === "onsen") { label = "♨️ ぬる湯"; cl += " tag-onsen"; }
      if (t === "vegan") { label = "🥗 中華・ヴィーガン"; cl += " tag-vegan"; }
      if (t === "vip") { label = "💎 VIP"; cl += " tag-vip"; }
      return `<span class="${cl}">${label}</span>`;
    }).join("");
    let probColor = "var(--danger)";
    if (c.prob >= 70) probColor = "var(--success)";
    else if (c.prob >= 50) probColor = "var(--warning)";
    tr.innerHTML = `
      <td style="padding: 0.75rem;"><strong>${c.name}</strong></td>
      <td style="padding: 0.75rem;">${c.visits}回</td>
      <td style="padding: 0.75rem; color: var(--text-secondary);">${c.lastVisit}</td>
      <td style="padding: 0.75rem;">${tagsHtml}</td>
      <td style="padding: 0.75rem; font-weight: bold; color: ${probColor};">${c.prob}%</td>
    `;
    tbody.appendChild(tr);
  });
}
// 4. イベントハンドラーの設定
// 4. イベントハンドラーの設定
function initEventHandlers() {
  // 設定モーダル
  const modal = document.getElementById("settings-modal");
  const openBtn = document.getElementById("open-settings-btn");
  const closeBtn = document.getElementById("close-settings-btn");
  const saveBtn = document.getElementById("save-settings-btn");
  const testBtn = document.getElementById("test-api-btn");
  if (openBtn) openBtn.addEventListener("click", () => modal.classList.add("active"));
  if (closeBtn) closeBtn.addEventListener("click", () => modal.classList.remove("active"));
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("active");
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const keyVal = document.getElementById("api-key-input").value.trim();
      const modelVal = document.getElementById("api-model-select")?.value || geminiModel || "gemini-2.5-flash";
      if (keyVal) {
        localStorage.setItem("ryokan-gemini-key", keyVal);
        geminiApiKey = keyVal;
      } else {
        localStorage.removeItem("ryokan-gemini-key");
        geminiApiKey = "";
      }
      if (modelVal) {
        localStorage.setItem("ryokan-gemini-model", modelVal);
        geminiModel = modelVal;
      }
      updateApiStatusUI();
      modal.classList.remove("active");
      alert("API設定を保存しました。");
    });
  }
  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      const keyVal = document.getElementById("api-key-input").value.trim();
      const modelVal = document.getElementById("api-model-select")?.value || geminiModel || "gemini-2.5-flash";
      const resultSpan = document.getElementById("api-test-result");
      if (!keyVal) {
        resultSpan.style.color = "var(--danger)";
        resultSpan.innerText = "⚠️ キーが入力されていません。";
        return;
      }
      resultSpan.style.color = "var(--warning)";
      resultSpan.innerText = "⏳ 接続テスト中...";
      try {
        const response = await fetch(`${apiBaseUrl}/v1beta/models/${modelVal}:generateContent?key=${keyVal}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
        });
        if (response.ok) {
          resultSpan.style.color = "var(--success)";
          resultSpan.innerText = `✅ 接続成功！${modelVal} を利用可能です。`;
        } else {
          const errText = await response.text();
          resultSpan.style.color = "var(--danger)";
          resultSpan.innerText = `❌ 接続失敗: ${response.status} (モデル未対応またはキー無効)`;
          console.error(errText);
        }
      } catch (e) {
        resultSpan.style.color = "var(--danger)";
        resultSpan.innerText = "❌ エラー: " + e.message;
      }
    });
  }
  // CRMセグメントフィルター
  const segBtns = document.querySelectorAll(".segment-btn");
  segBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      segBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const seg = btn.getAttribute("data-segment");
      renderCustomerTable(seg);
    });
  });
  // 手動実行ボタン群 (tab-marketing / tab-crm からの動作)
  const emergencyFixBtn = document.getElementById("emergency-fix-btn");
  if (emergencyFixBtn) {
    emergencyFixBtn.addEventListener("click", () => {
      const query = emergencyFixBtn.getAttribute("data-query");
      addChatBubble(query, "user");
      executeCooIntegratedAction(query, "fix");
    });
  }
  const applyHpBtn = document.getElementById("run-hp-apply-btn");
  if (applyHpBtn) {
    applyHpBtn.addEventListener("click", () => {
      alert("公式HPに改善コードを反映しました！");
      setAgentDeptState("mkt", "completed");
    });
  }
  const postGbpBtn = document.getElementById("run-gbp-post-btn");
  if (postGbpBtn) {
    postGbpBtn.addEventListener("click", () => {
      alert("Googleビジネスプロフィールへ最新投稿を公開しました！");
      setAgentDeptState("mkt", "completed");
    });
  }
  const postInstaBtn = document.getElementById("run-insta-post-btn");
  if (postInstaBtn) {
    postInstaBtn.addEventListener("click", () => {
      alert("Instagramへの投稿を公開しました！");
      setAgentDeptState("mkt", "completed");
    });
  }
  const sendLineBtn = document.getElementById("run-line-send-btn");
  if (sendLineBtn) {
    sendLineBtn.addEventListener("click", () => {
      alert("LINEメッセージを一斉送信しました！");
      setAgentDeptState("crm", "completed");
      triggerTrendImprovement();
    });
  }
  const copyReportBtn = document.getElementById("copy-integration-report-btn");
  if (copyReportBtn) {
    copyReportBtn.addEventListener("click", () => {
      copyText("integration-report-output");
    });
  }
  // --- COO AI チャットハンドラー追加 ---
  const sendChatBtn = document.getElementById("send-chat-btn");
  const chatInput = document.getElementById("coo-chat-input");
  if (sendChatBtn && chatInput) {
    sendChatBtn.addEventListener("click", () => {
      unlockMobileAudio();
      handleCooChatSend();
    });
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        unlockMobileAudio();
        handleCooChatSend();
      }
    });
  }
  // --- 音声入力（マイク）ハンドラー追加 ---
  const voiceBtn = document.getElementById("voice-input-btn");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (voiceBtn) {
    if (!SpeechRecognition) {
      voiceBtn.disabled = true;
      voiceBtn.title = "お使いのブラウザは音声入力に対応していません";
      console.warn("SpeechRecognition is not supported in this browser.");
    } else {
      voiceRecognition = new SpeechRecognition();
      voiceRecognition.lang = "ja-JP";
      voiceRecognition.interimResults = false;
      voiceRecognition.continuous = false;

      const addLogLocal = (text, type = "system-msg") => {
        const logContainer = document.getElementById("agent-log-container");
        if (!logContainer) return;
        const div = document.createElement("div");
        div.className = `log-line ${type}`;
        div.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
      };

      voiceBtn.addEventListener("click", () => {
        unlockMobileAudio();
        if (voiceBtn.classList.contains("recording")) {
          voiceRecognition.stop();
        } else {
          try {
            voiceRecognition.start();
          } catch (e) {
            console.error("SpeechRecognition start error:", e);
            addLogLocal("⚠️ 音声認識の開始に失敗しました。マイクへのアクセス権限等を確認してください。", "err-msg");
          }
        }
      });

      voiceRecognition.onstart = () => {
        voiceBtn.classList.add("recording");
        if (chatInput) {
          chatInput.placeholder = "音声入力中... お話しください";
        }
        addLogLocal("🎤 音声入力を受け付けています。マイクに向かって話してください...", "system-msg");
      };

      voiceRecognition.onresult = (event) => {
        const resultText = event.results[0][0].transcript;
        if (chatInput && resultText) {
          if (chatInput.value.trim() !== "") {
            chatInput.value += " " + resultText;
          } else {
            chatInput.value = resultText;
          }
          addLogLocal(`✅ 音声を認識しました: 「${resultText}」`, "success-msg");
        }
      };

      voiceRecognition.onerror = (event) => {
        console.error("SpeechRecognition error:", event.error);
        if (event.error === "not-allowed") {
          addLogLocal("⚠️ マイクの使用が許可されていません。ブラウザの設定を確認してください。", "err-msg");
        } else if (event.error === "no-speech") {
          addLogLocal("⚠️ 音声が検出されませんでした。もう一度お試しください。", "err-msg");
        } else {
          addLogLocal(`⚠️ 音声認識中にエラーが発生しました: ${event.error}`, "err-msg");
        }
        voiceBtn.classList.remove("recording");
        if (chatInput) {
          chatInput.placeholder = "質問や指示をここに入力してください...";
        }
      };

      voiceRecognition.onend = () => {
        voiceBtn.classList.remove("recording");
        if (chatInput) {
          chatInput.placeholder = "質問や指示をここに入力してください...";
        }
      };
    }
  }
  const shortcutBtns = document.querySelectorAll(".shortcut-btn");

  // --- VOICEVOX 音声ボタン & キャラクター選択 ---
  const voiceToggleBtn = document.getElementById("voice-toggle-btn");
  const voiceSpeakerSelect = document.getElementById("voice-speaker-select");

  if (voiceToggleBtn) {
    voiceToggleBtn.addEventListener("click", () => {
      voiceEnabled = !voiceEnabled;
      const icon = document.getElementById("voice-toggle-icon");
      const label = document.getElementById("voice-toggle-label");
      if (voiceEnabled) {
        voiceToggleBtn.classList.add("active");
        if (icon) icon.textContent = "🔊";
        if (label) label.textContent = "ON";
        // 挨拶音声
        const speaker = voicevoxSpeakers.find(s => s.id === selectedVoiceSpeaker);
        speakText(`にゃん！AIにゃんこ先生です。${speaker ? speaker.name + 'の声でお届けします。' : ''}何でもご相談ください！`);
      } else {
        voiceToggleBtn.classList.remove("active");
        if (icon) icon.textContent = "🔇";
        if (label) label.textContent = "OFF";
        stopVoice();
      }
    });
  }

  if (voiceSpeakerSelect) {
    voiceSpeakerSelect.addEventListener("change", () => {
      selectedVoiceSpeaker = parseInt(voiceSpeakerSelect.value, 10);
      if (voiceEnabled) {
        const speaker = voicevoxSpeakers.find(s => s.id === selectedVoiceSpeaker);
        if (speaker) speakText(`${speaker.name}に切り替えました。よろしくにゃん！`);
      }
    });
  }

  shortcutBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const query = btn.getAttribute("data-query");
      const preset = btn.getAttribute("data-preset");
      if (chatInput) {
        chatInput.value = query;
      }
      if (btn.classList.contains("execute-shortcut") && preset) {
        addChatBubble(query, "user");
        executeCooIntegratedAction(query, preset);
      } else {
        addChatBubble(query, "user");
        respondToCooChat(query);
      }
    });
  });
}
// 5. チャット表示用ユーティリティ
function addChatBubble(text, sender) {
  const container = document.getElementById("coo-chat-messages");
  if (!container) return;
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}-bubble`;
  const meta = document.createElement("div");
  meta.className = "bubble-meta";
  if (sender === "agent") {
    const avatarImg = document.createElement("img");
    avatarImg.src = "akasawa-nyanko.png";
    avatarImg.alt = "にゃんこ先生";
    avatarImg.className = "bubble-avatar";
    meta.appendChild(avatarImg);
    meta.appendChild(document.createTextNode(" AIにゃんこ先生"));
  } else {
    meta.innerText = "👤 ユーザー (スタッフ/経営者)";
  }
  const body = document.createElement("div");
  body.className = "bubble-text";
  
  // 安全対策: textがundefined, null, または文字列以外の場合のフォールバック
  let safeText = "";
  if (typeof text === "string") {
    safeText = text;
  } else if (text === null || text === undefined) {
    safeText = "（回答を取得できませんでした。もう一度お試しください）";
  } else {
    safeText = String(text);
  }

  body.innerHTML = safeText.replace(/\n/g, "<br>");
  bubble.appendChild(meta);
  bubble.appendChild(body);
  container.appendChild(bubble);
  // Auto-scroll
  container.scrollTop = container.scrollHeight;
  // AIにゃんこ先生の返答を音声で読み上げ
  if (sender === "agent") {
    if (isVoiceChatActive) {
      setVcState('speaking');
    }
    let speechText = safeText;
    if (isVoiceChatActive && safeText.includes("【指示実行完了報告】")) {
      speechText = "指示されたすべての施策の自動実行が完了したにゃ！詳しい経営レポートは画面に表示したから確認してほしいにゃん！";
    }
    setTimeout(() => speakText(speechText), 300);
  }
}
// 6. COO AI 統合アクション実行 (チャット連動・3AI自律実行)
async function executeCooIntegratedAction(instruction, presetKey) {
  if (isRunningAutopilot) return;
  const logContainer = document.getElementById("agent-log-container");
  const statusBadge = document.getElementById("agent-status-badge");
  const sendChatBtn = document.getElementById("send-chat-btn");
  
  try {
    // 初期化
    if (logContainer) logContainer.innerHTML = "";
    isRunningAutopilot = true;
    if (statusBadge) {
      statusBadge.innerText = "自律処理中";
      statusBadge.classList.add("active");
    }
    if (sendChatBtn) sendChatBtn.disabled = true;
  // エージェント相関図のインジケーターをリセット
  resetAllAgentDepts();
  // ログ出力用ヘルパー
  const addLog = (text, type = "system-msg") => {
    if (!logContainer) return;
    const div = document.createElement("div");
    div.className = `log-line ${type}`;
    div.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
  };
  addLog("👔 CEO経営指示を受信しました。COO AIが統合処理を開始します。", "coo-msg");
  addLog("🏢 [コンセプト・経営戦略室] 連携要請を受信。", "system-msg");
  addLog("🛠️ [Skill] 「経営ビジョン(MVV)整合性チェック」を発動中...", "system-msg");
  setAgentDeptState("mvv", "active-thinking");
  await sleep(1200);
  setAgentDeptState("mvv", "completed");
  addLog("✅ [コンセプト・経営戦略室] 施策が宿のMVVおよびターゲット層と一致していることを確認。", "success-msg");
  // CRM側のセグメント反映
  let crmSegment = "all";
  if (presetKey === "cats") crmSegment = "cats";
  else if (presetKey === "summer") crmSegment = "onsen";
  // セグメントフィルターUIの連動
  document.querySelectorAll(".segment-btn").forEach(b => {
    if (b.getAttribute("data-segment") === crmSegment) {
      b.classList.add("active");
    } else {
      b.classList.remove("active");
    }
  });
  renderCustomerTable(crmSegment);
  const targetSegmentLabel = document.getElementById("crm-target-segment-label");
  if (targetSegmentLabel) {
    targetSegmentLabel.value = crmSegment === "cats" ? "猫好き顧客 (4名)" : (crmSegment === "onsen" ? "ぬる湯ファン顧客 (5名)" : "全顧客 (10名)");
  }
  // AIによるコンテンツ生成 (API連携 or モック)
  let generatedData = null;
  addLog("🧠 COO AI：各組織エージェントへの指示とコンテンツ生成を開始します...", "coo-msg");
  if (geminiApiKey) {
    addLog("🌐 Gemini APIと接続。リアルタイムコンテンツ生成中...", "coo-msg");
    generatedData = await generateAiContentWithGemini(instruction, presetKey, addLog);
  } else {
    addLog("💡 APIキー未設定のため、高品質ローカルデータベースからマッチングを行います...", "coo-msg");
    await sleep(1500);
    generatedData = mockSolutions[presetKey];
  }
  if (!generatedData) {
    addLog("❌ コンテンツ生成に失敗しました。モックデータに切り替えます。", "err-msg");
    generatedData = mockSolutions[presetKey];
  }
  // 生成されたデータを各テキストエリアに流し込む
  document.getElementById("marketing-hp-summary-output").value = generatedData.hp_summary;
  document.getElementById("marketing-hp-jsonld-output").value = generatedData.hp_jsonld;
  document.getElementById("marketing-gbp-post-output").value = generatedData.gbp_post;
  document.getElementById("marketing-insta-post-output").value = generatedData.insta_post;
  document.getElementById("crm-line-msg-output").value = generatedData.line_post;
  const imgDescEl = document.getElementById("marketing-gbp-img-desc");
  if (imgDescEl) {
    imgDescEl.innerText = generatedData.gbp_img_desc || "宿の象徴的なアセット写真（猫または温泉）";
  }
  // プレビューの自動切り替え
  renderMarketingVisualPreview("marketing-hp");
  // 自律実行フェーズ
  addLog("📢 [集客・マーケ部] 連携要請を受信。コンテンツ自動作成を開始します。", "mkt-msg");
  addLog("🛠️ [Skill] 「AI検索・SEO対策」「MEO・Googleマップ定期投稿」「SNS投稿案作成」を発動中...", "system-msg");
  setAgentDeptState("mkt", "active-thinking");
  await sleep(1500);
  setAgentDeptState("mkt", "completed");
  addLog("📢 [集客・マーケ部] [実行] HP結論ブロック設置、構造化データ(JSON-LD)反映、GBP予約公開、Instagram投稿連携を完了しました。", "success-msg");
  addLog("🏨 [宿泊満足度・サービス部] 連携要請を受信。現場おもてなし品質のチェックを開始。", "coo-msg");
  addLog("🛠️ [Skill] 「客室清掃チェックシート監査」「ぬる湯おもてなしガイド」を発動中...", "system-msg");
  setAgentDeptState("srv", "active-thinking");
  await sleep(1200);
  setAgentDeptState("srv", "completed");
  addLog("🏨 [宿泊満足度・サービス部] [実行] 口コミ改善項目(清掃見える化、ぬる湯案内)の同期およびおもてなしマニュアルの更新を完了しました。", "success-msg");
  addLog("🔁 [リピートCRM部] ターゲット顧客の抽出およびLINE配信メッセージ準備完了。", "crm-msg");
  setAgentDeptState("crm", "active-thinking");
  await sleep(1500);
  setAgentDeptState("crm", "completed");
  addLog("🔁 [リピートCRM部] [実行] ターゲット顧客(セグメント)の抽出およびLINE公式経由での限定クーポン一斉配信を完了しました。", "success-msg");
  if (presetKey === "cats") {
    document.getElementById("crm-pos-percentage").innerText = "88%";
    document.getElementById("crm-pos-label").innerText = "88% (44件)";
  }
  addLog("📊 [財務・データ統合分析室] 連携要請を受信。チャネルパフォーマンスの集計を開始します。", "coo-msg");
  addLog("🛠️ [Skill] 「データ自動同期・集計」「AI経営改善レポート自動生成」を発動中...", "system-msg");
  setAgentDeptState("ana", "active-thinking");
  await sleep(1500);
  setAgentDeptState("ana", "completed");
  addLog("📊 [財務・データ統合分析室] [実行] チャネルデータの統合同期、ダッシュボード指標の更新、AI経営提言レポートの生成を完了しました。", "success-msg");
  // ダッシュボード更新
  if (presetKey === "cats") {
    document.getElementById("int-mkt-exposure").innerText = "15,840 回";
    document.getElementById("int-mkt-bookings").innerText = "92 件";
    document.getElementById("int-crm-line").innerText = "456 人";
    document.getElementById("int-crm-repeats").innerText = "35 件";
  } else if (presetKey === "summer") {
    document.getElementById("int-mkt-exposure").innerText = "17,180 回";
    document.getElementById("int-mkt-bookings").innerText = "98 件";
    document.getElementById("int-crm-line").innerText = "432 人";
    document.getElementById("int-crm-repeats").innerText = "31 件";
  }
  triggerTrendImprovement();
    // レポート流し込み
    document.getElementById("integration-report-output").innerText = generatedData.report;
    addLog("🏆 すべての自律駆動タスクが正常終了しました。", "success-msg");
    if (statusBadge) {
      statusBadge.innerText = "完了";
      statusBadge.classList.remove("active");
    }
    // チャットにも完了報告とレポートの要約をCOO AIとして投稿
    const chatResponse = `
【指示実行完了報告】
CEO、ご指示いただいた施策の自動実行がすべて完了しました！<br><br>
<strong>実行した連携タスク：</strong><br>
1. <strong>コンセプト戦略室</strong>: 施策の整合性確認<br>
2. <strong>集客・マーケ部</strong>: 公式HPへの要約HTML反映、構造化データ(JSON-LD)埋め込み、Googleマップ(GBP)定期投稿、Instagram投稿連携<br>
3. <strong>宿泊満足度部</strong>: 現場オペレーションの同期<br>
4. <strong>リピートCRM部</strong>: LINE公式アカウントでのセグメント配信（限定クーポン付）<br>
5. <strong>データ統合分析室</strong>: 効果測定シミュレーションおよびダッシュボード更新<br><br>
<strong>データ統合・分析AIによる経営レポート：</strong><br>
${generatedData.report.replace(/\n/g, "<br>")}
`;
    addChatBubble(chatResponse, "agent");
  } catch (err) {
    console.error("Error in executeCooIntegratedAction:", err);
    const div = document.createElement("div");
    div.className = "log-line err-msg";
    div.innerText = `[${new Date().toLocaleTimeString()}] ❌ エラーが発生しました: ${err.message}`;
    if (logContainer) {
      logContainer.appendChild(div);
      logContainer.scrollTop = logContainer.scrollHeight;
    }
    if (statusBadge) {
      statusBadge.innerText = "エラー";
      statusBadge.classList.remove("active");
    }
    addChatBubble("【お知らせ】施策の自律実行中にエラーが発生しました。設定やAPIキー of AIエージェントの接続を確認し、もう一度お試しください。", "agent");
  } finally {
    if (sendChatBtn) sendChatBtn.disabled = false;
    isRunningAutopilot = false;
  }
}
// 7. COO AI チャット送信ハンドラ
async function handleCooChatSend() {
  const chatInput = document.getElementById("coo-chat-input");
  if (!chatInput) return;
  const query = chatInput.value.trim();
  if (!query) return;
  // 入力を空にする
  chatInput.value = "";
  // ユーザーの発言を表示
  addChatBubble(query, "user");
  // 応答処理
  respondToCooChat(query);
}
// 8. COO AI 応答処理
async function respondToCooChat(query) {
  // チャット送信ボタンの無効化
  const sendChatBtn = document.getElementById("send-chat-btn");
  if (sendChatBtn) sendChatBtn.disabled = true;
  // COO AI が考えている状態を表示（相関図）
  const cooNode = document.getElementById("agent-node-coo");
  if (cooNode) cooNode.classList.add("active-thinking");
  
  try {
    // 施策の実行指示であるかどうかの簡易判定
    const isExecutionQuery = query.includes("施策") && (query.includes("実行") || query.includes("やって") || query.includes("送って"));
    if (isExecutionQuery) {
      let presetKey = "summer";
      if (query.includes("猫")) presetKey = "cats";
      // 施策実行
      if (cooNode) cooNode.classList.remove("active-thinking");
      await executeCooIntegratedAction(query, presetKey);
    } else {
      // 通常の質問回答
      let answer = "";
      // どの専門部署のナレッジに関係するか判定して相関図を光らせる
      let dept = "mvv";
      let skillName = "コンセプト・MVV整合性チェック";
      const q = query.toLowerCase();
      if (q.includes("清掃") || q.includes("チェック")) {
        dept = "srv";
        skillName = "客室清掃チェックシート管理・品質監査";
      } else if (q.includes("ぬる湯") || q.includes("効果") || q.includes("長湯")) {
        dept = "srv";
        skillName = "温泉おもてなし・ぬる湯説明ガイド";
      } else if (q.includes("猫") || q.includes("アレルギー") || q.includes("共生")) {
        dept = "srv";
        skillName = "猫共存ガイド・アレルギー対策";
      } else if (q.includes("料理") || q.includes("ヴィーガン") || q.includes("中華") || q.includes("テンポ") || q.includes("食事")) {
        dept = "srv";
        skillName = "食事おもてなし・料理提供テンポ調整";
      } else if (q.includes("外国人") || q.includes("インバウンド") || q.includes("案内") || q.includes("booking") || q.includes("英語")) {
        dept = "srv";
        skillName = "インバウンド対応・多言語案内ガイド";
      } else if (q.includes("接客") || q.includes("おもてなし") || q.includes("マニュアル") || q.includes("ペット") || q.includes("送迎") || q.includes("アクセス")) {
        dept = "srv";
        skillName = "宿泊満足度おもてなしナレッジ検索";
      } else if (q.includes("集客") || q.includes("hp") || q.includes("seo") || q.includes("sns") || q.includes("露出") || q.includes("直販") || q.includes("google") || q.includes("ai検索")) {
        dept = "mkt";
        skillName = "AI検索・SEO対策・SNS投稿案作成・直販推進";
      } else if (q.includes("リピート") || q.includes("crm") || q.includes("line") || q.includes("会員") || q.includes("顧客") || q.includes("クーポン") || q.includes("再訪")) {
        dept = "crm";
        skillName = "リピートCRM・LINE公式メッセージ配信・再訪設計";
      } else if (q.includes("分析") || q.includes("財務") || q.includes("売上") || q.includes("ダッシュボード") || q.includes("レポート") || q.includes("kpi") || q.includes("実行計画")) {
        dept = "ana";
        skillName = "財務・データ統合分析・AI経営レポート生成";
      } else if (q.includes("aiエージェント") || q.includes("組織") || q.includes("dx") || q.includes("ブランド")) {
        dept = "mvv";
        skillName = "企業理念・AI組織設計・ブランド戦略調査";
      }
      // ログへの出力
      const logContainer = document.getElementById("agent-log-container");
      const addLog = (text, type = "system-msg") => {
        if (!logContainer) return;
        const div = document.createElement("div");
        div.className = `log-line ${type}`;
        div.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
        logContainer.appendChild(div);
        logContainer.scrollTop = logContainer.scrollHeight;
      };
      if (logContainer) logContainer.innerHTML = "";
      addLog(`🧠 COO AI：質問を解析し、担当部署にSkills of AIエージェントを要求しました。`, "coo-msg");
      addLog(`🏢 担当部署: ${dept === "srv" ? "宿泊満足度・サービス部" : (dept === "mkt" ? "集客・マーケティング部" : (dept === "crm" ? "リピート・CRM推進部" : (dept === "ana" ? "財務・データ統合分析室" : "コンセプト・経営戦略室")))}`, "system-msg");
      addLog(`🛠️ 実行技能 (Skill): 「${skillName}」を発動中...`, "system-msg");
      const maskedKey = geminiApiKey ? `${geminiApiKey.substring(0, 6)}...${geminiApiKey.substring(geminiApiKey.length - 4)}` : "未設定 (モックモード)";
      addLog(`🔑 システムにロードされているAPIキー: ${maskedKey}`, "system-msg");
      setAgentDeptState(dept, "active-thinking");
      await sleep(1200);
      if (geminiApiKey && geminiApiKey.trim() !== "" && geminiApiKey !== "undefined" && geminiApiKey !== "null") {
        answer = await generateCooKnowledgeResponse(query);
      } else {
        answer = getMockResponse(query);
      }
      setAgentDeptState(dept, "completed");
      addLog(`✅ 実行成功: 「${skillName}」に基づく回答をCOO AIに報告しました。`, "success-msg");
      if (cooNode) cooNode.classList.remove("active-thinking");
      addChatBubble(answer, "agent");
      await sleep(500);
      resetAllAgentDepts();
    }
  } catch (err) {
    console.error("Error in respondToCooChat:", err);
    const logContainer = document.getElementById("agent-log-container");
    if (logContainer) {
      const div = document.createElement("div");
      div.className = "log-line err-msg";
      div.innerText = `[${new Date().toLocaleTimeString()}] ❌ エラーが発生しました: ${err.message}`;
      logContainer.appendChild(div);
    }
    addChatBubble(`【お知らせ】通信または処理中にエラーが発生したため、ローカルデータベースから回答を出力します：\n\n` + getMockResponse(query), "agent");
    if (cooNode) cooNode.classList.remove("active-thinking");
    resetAllAgentDepts();
  } finally {
    if (sendChatBtn) sendChatBtn.disabled = false;
  }
}
// 9. Gemini API を使用した COO ナレッジRAG応答
async function generateCooKnowledgeResponse(query) {
  const url = `${apiBaseUrl}/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
  const systemInstruction = `
あなたは「塩原温泉 赤沢温泉旅館」の優秀なCOO AI（統括司令塔）です。企業理念を体現するAIエージェント組織の一員として、MVV・ブランド戦略・完全版実行計画を深く理解し、スタッフや経営者（CEO）の相談・指示に具体的かつ実践的に回答してください。

当館の基本情報：
- ミッション：「日本の田舎に息づく大自然・健康・文化の価値を、誠実で快適な滞在体験として届け、訪れる人の心と身体に感動と回復をもたらす。地域の良さを発掘・発信し、地域に人の流れと希望を生み出す拠点となる。」
- コンセプト：「猫とぬる湯と渓流にほどける、静養型ウェルネスの小宿」（猫 × ぬる湯 × 渓流 × 静養）
- 看板猫：みーちゃん、ちびちゃん、ハチ、さくら
- 温泉：自家源泉かけ流しの「ぬる湯」（源泉44℃、内湯40℃前後、露天38℃前後）
- 所在地：栃木県那須塩原市塩原1149、箒川沿い全10室
- 非ターゲット層：熱い温泉希望者・豪華設備重視者・動物が苦手な方

【知識ベース①】当館のミッション・ビジョン・バリュー・コンセプト詳細：
${mvvText}

【知識ベース②】コンサルティングデータ・運営改善指針：
${consultingText}

【知識ベース③】企業理念を体現するAIエージェント組織の構築に関する調査レポート：
${aiAgentReportText}

【知識ベース④】ブランド統合方針書（ブランド戦略および実行計画）：
${brandStrategyText}

【知識ベース⑤】完全版実行計画書（OTA依存脱却・AI検索時代対応・直販・再訪・ブランド定着）：
${fullPlanText}

【応答のルール】
1. スタッフからの現場業務に関する質問（清掃、接客、食事、ぬる湯、インバウンド等）には、コンサルデータおよび完全版実行計画の具体的な改善ポイントに基づいて、実践的なアクションを提示してください。
2. AIエージェント組織・DX・ブランド戦略・実行計画に関する質問には、調査レポートとブランド統合方針書の内容をもとに、当館に特化した提案を行ってください。
3. 直販強化・OTA脱却・リピート設計・AI検索対応に関しては、完全版実行計画書のフェーズ別ロードマップ・KPI・テンプレートを活用して具体的に回答してください。
4. 常に赤沢温泉旅館のスタッフや経営者に寄り添うトーンで、丁寧な日本語で回答してください。
5. HTMLタグは含めず、プレーンテキストまたは改行コード(\n)を使用して読みやすくフォーマットしてください。
`;
  const prompt = `
【スタッフ/経営者からの相談・質問】
"${query}"
上記に対して、COO AIとして的確かつ親身に回答してください。
`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: systemInstruction + "\n\n" + prompt }]
          }
        ]
      })
    });
    if (response.ok) {
      const resJson = await response.json();
      if (resJson && resJson.candidates && resJson.candidates[0] && 
          resJson.candidates[0].content && resJson.candidates[0].content.parts && 
          resJson.candidates[0].content.parts[0] && resJson.candidates[0].content.parts[0].text) {
        return resJson.candidates[0].content.parts[0].text.trim();
      } else {
        console.warn("Unexpected API response structure. Falling back to mock.");
        return getMockResponse(query);
      }
    } else {
      const errText = await response.text();
      console.error("Gemini API Error Response:", errText);
      
      let errorReason = "HTTP " + response.status;
      try {
        const errJson = JSON.parse(errText);
        if (errJson && errJson.error && errJson.error.message) {
          errorReason = `${errJson.error.message} (${errJson.error.status || response.status})`;
        } else {
          errorReason = errText.substring(0, 100);
        }
      } catch (jsonErr) {
        errorReason = errText.substring(0, 100);
      }

      // 認証エラー（無効なキーなど）を検知した場合、LocalStorageにキャッシュされている古いキーを自動削除
      if (response.status === 400 || response.status === 403 || errText.includes("API_KEY_INVALID") || errText.includes("not valid")) {
        console.warn("Invalid API Key detected. Clearing localstorage cache.");
        localStorage.removeItem("ryokan-gemini-key");
      }
      return `【お知らせ】専門AIとの通信でエラーが発生したため（エラー詳細: ${errorReason}）、ローカルの運営改善データベースから回答を出力します：\n\n` + getMockResponse(query);
    }
  } catch (e) {
    console.error("Error fetching Gemini API:", e);
    return `【お知らせ】通信エラーが発生したため（エラー詳細: ${e.message}）、ローカルの運営改善データベースから代替回答を出力します：\n\n` + getMockResponse(query);
  }
}
// 10. API未設定（モックモード）時のローカルナレッジ回答
function getMockResponse(query) {
  const q = query.toLowerCase();

  // 音声会話モード中は超簡潔な回答を返す
  if (typeof isVoiceChatActive !== 'undefined' && isVoiceChatActive) {
    if (q.includes("清掃") || q.includes("チェック")) {
      return "客室や温泉の清掃には「10項目チェックシート」を導入して、髪の毛や猫の毛を毎回トリプルチェックするのが効果的だにゃ！露天風呂の藻の対策も朝夕にやるにゃん！";
    }
    if (q.includes("ぬる湯") || q.includes("効果") || q.includes("説明") || q.includes("長湯")) {
      return "当館のぬる湯は、体に負担をかけずにじっくり浸かることで自律神経が整うにゃん。冬は少しぬるくなるから、事前に説明してお客様とのズレを防ぐのがコツだにゃ！";
    }
    if (q.includes("猫") || q.includes("アレルギー") || q.includes("共生") || q.includes("みーちゃん")) {
      return "みーちゃんたちの情報は全媒体に書いておくべきだにゃ。アレルギーのお客様には空気清浄機を最大にして対応するにゃ。猫はロビーだけでふれあってもらうのが基本だにゃん。";
    }
    if (q.includes("料理") || q.includes("ヴィーガン") || q.includes("中華") || q.includes("食事")) {
      return "食事のテンポはお客様に合わせて調整するにゃん。木金日限定のヴィーガン中華コースは健康志向の方に大人気だにゃ！岩魚などの地元食材のストーリーも伝えてにゃ！";
    }
    if (q.includes("外国人") || q.includes("インバウンド") || q.includes("台湾") || q.includes("booking") || q.includes("英語")) {
      return "インバウンド向けには、resident catやぬる湯であることをBooking.comに英語で明記するにゃ！お風呂のマナーも多言語で掲示して、笑顔でおもてなしするにゃん！";
    }
    if (q.includes("ミッション") || q.includes("ビジョン") || q.includes("コンセプト") || q.includes("mvv") || q.includes("ブランド")) {
      return "赤沢温泉旅館のミッションは「猫との出会いと、ぬる湯の癒しで、心身をリセットする場を提供する」ことだにゃ。コンセプトは静養型ウェルネスの小宿だにゃん！";
    }
    if (q.includes("集客") || q.includes("直販") || q.includes("seo") || q.includes("ai検索") || q.includes("google")) {
      return "直販比率を上げるために公式限定特典をアピールして、Googleマップやホームページに構造化データを埋め込むのが最優先だにゃ！他ホテルの誤記はすぐ直してにゃ！";
    }
    if (q.includes("リピーター") || q.includes("crm") || q.includes("会員") || q.includes("クーポン") || q.includes("再訪") || q.includes("line")) {
      return "リピート設計にはCRMで猫好きやぬる湯ファンのセグメントを作成して、LINEで個別のクーポンや再訪の提案を送るのが一番効果的だにゃ！";
    }
    if (q.includes("aiエージェント") || q.includes("ai組織") || q.includes("dx") || q.includes("デジタル")) {
      return "当館のAI組織は、ボクがCOOとして全体を統括し、マーケ・CRM・財務などの専門AIが自律して働く仕組みだにゃ。人間とAIが協力して旅館を盛り上げるにゃ！";
    }
    if (q.includes("実行計画") || q.includes("ロードマップ") || q.includes("フェーズ") || q.includes("kpi")) {
      return "まずは7日以内に他ホテル名の誤記を直すなどの止血を行って、30日以内にFAQ公開などのミスマッチ対策、半年で直販比率プラス10パーセントを目指すにゃん！";
    }
    if (q.includes("送迎") || q.includes("アクセス") || q.includes("バス") || q.includes("電車")) {
      return "那須塩原駅からのバスは14時台が最終だから注意してにゃ！送迎は前日までに予約してもらうルールにして、3日前のリマインドメールで案内を送るにゃん。";
    }
    if (q.includes("ペット") || q.includes("犬") || q.includes("wooinu")) {
      return "ペット同伴客室には高級ドライルームなどを設置してアピールするにゃ！ただしレストランや浴場は不可など、ルールは予約直後からしっかり説明しておくべきだにゃ！";
    }
    return "ご相談ありがとうございますにゃ！「清掃」「ぬる湯」「猫」「食事」「集客」「リピーター」「アクセス」など、気になるキーワードについて聞いてみてにゃん！";
  }

  if (q.includes("清掃") || q.includes("チェック")) {
    return `【完全版実行計画書より】客室および館内清掃の品質向上については、以下の対策を推奨します：\n\n1. **清掃10項目チェックシートの導入**: 髪の毛・臭い・埃・蜘蛛の巣・寝具状態・猫毛を毎回チェック。清掃完了カードを客室のテーブルに提示し「見える化」。\n2. **温泉清掃の強化**: 浴槽まわり・脱衣所・排水・鏡・水垢を毎日点検。Booking.comで清掃印象が論点化しているため優先管理。\n3. **露天風呂の藻対策**: 朝夕の湯温測定タイミングで湯もみとネット清掃を実施。男女入替の案内表示を脱衣所に掲示。\n4. **共用部**: ロビー・階段・トイレ・ラウンジ・屋外導線を毎日点検。エレベーターがないため階段手すり・滑り止めも確認。\n\nKPI目標: 清掃チェックリスト実施率100%、未記入0件を目標とします。`;
  }
  if (q.includes("ぬる湯") || q.includes("効果") || q.includes("説明") || q.includes("長湯")) {
    return `【ブランド戦略・完全版実行計画書より】自家源泉「ぬる湯」のお客様への説明とおもてなしガイドです：\n\n* **基本説明文**: 「当館の温泉は源泉44℃前後のお湯を、内湯40℃前後・露天38℃前後のぬる湯としてご提供しています。熱い温泉と異なり、体に負担をかけずに15〜20分じっくり浸かると副交感神経が優位になり、自律神経が整います。夏の冷え性や不眠、日頃の疲労回復に最適です。」\n* **冬季露天の重要告知**: 冬は露天が35℃前後まで下がることがあります。事前に必ず「熱い湯ではない」ことと季節による体感差をご説明し、期待値ミスマッチを防いでください。\n* **接客時のコツ**: 箒川のせせらぎを聞きながら「静養」とセットでご案内すると満足度が大幅に向上します。ぬる湯の「長湯でじんわり温まる体験」をチェックイン時に紙面でも案内してください。`;
  }
  if (q.includes("猫") || q.includes("アレルギー") || q.includes("共生") || q.includes("みーちゃん")) {
    return `【完全版実行計画書・ブランド戦略より】看板猫との共生とアレルギー対応のガイドラインです：\n\n1. **全媒体への明記**: resident catの存在を公式HP・GBP・OTA全媒体に明記。猫アレルギーの方や苦手な方は非ターゲット層と定義し、事前説明で期待値調整。\n2. **アレルギー客向けの棲み分け**: 重度のアレルギーがある方にはお断りをご案内。ご相談いただいた場合は空気清浄機を最大風量で稼働させた客室を準備。\n3. **ロビーでのふれあいガイド**: みーちゃん・ちびちゃん・ハチ・さくらとのふれあいはロビーのみとし、客室への出入りは禁止。無理な抱っこを控えるよう掲示物で案内。\n4. **保護猫ストーリーの活用**: 当館の猫は保護猫出身であり、エシカル消費に共感する層（30〜40代）への感情的なつながりを深めます。ブランドのコア資産として訴求してください。`;
  }
  if (q.includes("料理") || q.includes("ヴィーガン") || q.includes("中華") || q.includes("テンポ") || q.includes("食事")) {
    return `【完全版実行計画書より】食事提供と おもてなしのマニュアルです：\n\n1. **食事提供テンポの調整**: 急かさない・急がせない。食事開始時刻・提供テンポを事前確認。遅着・追加注文・食事締切は予約直後メールで案内。\n2. **中華ヴィーガンコースの訴求**: 木金日限定のヴィーガン中華コースは、那須高原野菜と大豆ミートで作る本格創作中華。健康志向の方・外国人・アレルギー対応が必要な方に積極的にPR。\n3. **岩魚などの地元食材**: 地元の川魚は炭火焼きで焼きたて提供。食材のストーリー（地域との共生）をお客様にお伝えし、体験価値を高めてください。\n4. **配膳オペレーション**: 口コミで「食事提供ペースのムラ」が指摘されています。厨房とリアルタイム連携して最適タイミングで提供するよう標準化を図ってください。`;
  }
  if (q.includes("外国人") || q.includes("インバウンド") || q.includes("台湾") || q.includes("中国") || q.includes("booking") || q.includes("英語")) {
    return `【ブランド戦略・完全版実行計画書より】インバウンド対応ガイドラインです：\n\n1. **Booking.com対応**: resident cat・入湯税別・到着時刻事前連絡必須を英語で明記。lukewarm onsen・peaceful countryside ryokan・restorative stayなどの正確な表現を使用。\n2. **英語テンプレート整備**: 予約直後メール・アクセス案内・チェックインカード・館内注意掲示の英語版を整備。\n3. **多言語掲示**: 温泉マナー（体を洗ってから入る・スマートフォン禁止）を英語・繁体字・簡体字で分かりやすく掲示。\n4. **接客スタンス**: 言葉の壁があっても笑顔と丁寧なジェスチャー、翻訳アプリを活用。「一生懸命なおもてなし」が国際口コミで高評価につながります。\n5. **ターゲット**: 北米・西欧のウェルネス志向層、台湾・香港の「養生」と猫文化に関心の高い層が重点インバウンドターゲット。`;
  }
  if (q.includes("ミッション") || q.includes("ビジョン") || q.includes("コンセプト") || q.includes("mvv") || q.includes("要約") || q.includes("ブランド")) {
    return `【ブランド統合方針書より】赤沢温泉旅館のブランド定義です：\n\n* **ミッション（使命）**: 「猫との出会いと、ぬる湯の癒しで、心身をリセットする場を提供する」\n* **3年後ビジョン**: 直販比率を大幅向上させ、確固たるリピーター基盤を持つ独自路線の宿としての地位を確立\n* **5年後ビジョン**: 日本を代表するウェルネス温泉地として国内外から指名される存在へ\n* **メインコンセプト**: 「猫とぬる湯と渓流にほどける、静養型ウェルネス小宿」\n* **提供価値**: 刺激ではなく「回復」。静養・調律・再起動の体験。\n* **NG表現**: 豪華旅館・熱々の湯・万人向け・至れり尽くせり\n* **ブランドの存在意義**: 日常の重圧やストレスから心身を解放し、自然と動物の力で人間本来の感覚を取り戻す「回復の場」を提供すること`;
  }
  if (q.includes("集客") || q.includes("ファネル") || q.includes("直販") || q.includes("mkt") || q.includes("seo") || q.includes("ai検索") || q.includes("google")) {
    return `【完全版実行計画書・ブランド戦略より】集客・直販・AI検索対応の戦略です：\n\n1. **AI検索（Google AI Mode）対応**: Schema.org（Hotel, FAQ, Review等）の構造化データをHPに実装。「向いている方/向いていない方」「FAQテキスト15項目」「ぬる湯の説明」「猫の情報」を機械可読なテキストで整備。\n2. **GBP整備（最重要）**: 説明文を「猫・ぬる湯・渓流・静養」に統一。写真10〜20枚・設備・FAQ・口コミ48時間以内返信を徹底。週1確認・月1更新。\n3. **直販比率向上**: ベストレート保証と公式限定特典を最優先で訴求。OTAは「新規発見チャネル」と割り切り、過度な割引依存を避ける。半年で直販比率+10%がKGI。\n4. **OTA文面刷新**: 楽天・じゃらんでは冒頭に「ぬる湯・保護猫・渓流・静養」を明記。「熱い湯ではない」「エレベーターなし」「全館禁煙」「虫の可能性」を先出し表示。\n5. **緊急対応**: 公式サイトの「予約4大特典」ページに混入している他ホテル名「ほてるISAGO神戸」を即時削除。`;
  }
  if (q.includes("リピーター") || q.includes("crm") || q.includes("会員") || q.includes("クーポン") || q.includes("再訪") || q.includes("line")) {
    return `【完全版実行計画書より】リピート設計・CRM戦略のポイントです：\n\n1. **CRM（顧客台帳）の活用**: 「猫好き」「長湯好き」「静かな部屋希望」「送迎利用」「別棟利用」等を記録し、季節・猫・湯治の3軸でパーソナライズ再訪提案。入力率80%以上がKPI。\n2. **メールシナリオ（自動化）**: ①予約直後 → ②来館3日前リマインド → ③翌日お礼 → ④30日後口コミ依頼 → ⑤60〜90日後再訪案内を順次自動配信。\n3. **LINE配信**: 猫好きには「猫おやつ特典付きプラン」、ぬる湯ファンには「平日限定地酒付きプラン」などセグメント別クーポンを配信。\n4. **再訪メール例文**: 「また静かにほどける時間を。季節ごとに渓流の表情や猫たちの過ごし方も変わります。次回は猫との再会・季節の再訪・静養・湯治のいずれかをテーマにご提案します。」\n5. **チェックアウト時の一言**: 精算確認シート・口コミ依頼カードを標準化。「また帰る宿」を意識した一言を添えてください。`;
  }
  if (q.includes("aiエージェント") || q.includes("ai組織") || q.includes("組織構築") || q.includes("dx") || q.includes("デジタル") || q.includes("ai活用")) {
    return `【企業理念を体現するAIエージェント組織の構築に関する調査レポートより】赤沢温泉旅館のAIエージェント組織設計の方針です：\n\n■ MVV体現型AIエージェント組織の概念\n当館のミッション・ビジョン・バリュー・コンセプトを深く理解し、自律的に行動するAIエージェントと人間が協調することで、理念浸透と実践を加速させるモデルです。\n\n■ 設計の3本柱\n1. **業務設計（Human-led, Agent-operated）**: AIエージェントがイベントを起点に自律的に業務を進め、人間は価値判断や例外対応に集中。\n2. **情報システム設計（エージェントファースト）**: MVV・コンサルデータ・実行計画をRAG技術でAIに統合。\n3. **ガバナンス設計**: 要所での人間承認（ヒューマン・イン・ザ・ループ）を組み込み、責任の所在を明確化。\n\n■ 当館AIエージェント組織の構成\n- **コア・エージェント（COO AI）**: MVVの守護者として全エージェントへ判断基準を提供\n- **集客・マーケ部AI**: SEO・SNS・GBP施策の自律実行\n- **リピートCRM部AI**: 顧客セグメント分析・LINE配信\n- **財務・データ統合分析室AI**: KPI集計・経営レポート生成\n\n■ 参考事例\n- 株式会社THAの「AI社長」: 企業理念を体現するAIアシスタント\n- リコー: 8,000体のAIエージェントと社員の共生`;
  }
  if (q.includes("実行計画") || q.includes("ロードマップ") || q.includes("フェーズ") || q.includes("kpi") || q.includes("kgi")) {
    return `【完全版実行計画書より】フェーズ別ロードマップとKPIです：\n\n■ フェーズ別ロードマップ\n● 初動7日: 信頼毀損の止血（他ホテル名誤記の緊急修正・全媒体基本情報棚卸し・FAQ公開）\n● 30日: 期待値ミスマッチ削減（FAQ15項目・到着時説明シート・GBP整備・OTA文面刷新・送迎台帳）\n● 90日: 直販導線と満足度強化（予約導線改修・ベストレート訴求・清掃10項目定着）\n● 180日: 再訪の仕組み化（CRM稼働・メール自動化・体験別プラン・口コミ分析会議）\n● 365日: AI検索時代対応定着（Schema.org実装・レビュー資産化・季節別導線改善）\n\n■ 重要KPI/KGI\n- KGI: 直販比率 +10%（半年後）\n- KGI: 再訪率 180日以内に計測開始、365日で改善\n- KPI: 口コミ返信率 48時間以内100%\n- KPI: 清掃チェックリスト実施率 100%\n- KPI: CRM入力率 80%以上\n- KPI: 指名検索数 +10%（半年後）`;
  }
  if (q.includes("送迎") || q.includes("アクセス") || q.includes("バス") || q.includes("電車")) {
    return `【完全版実行計画書より】送迎・アクセス案内の標準化ガイドです：\n\n■ 公共交通の注意点（重要）\n- 那須塩原駅発の塩原温泉バスターミナル行きは**14時台が最終**\n- 間に合わない場合は西那須野駅経由で**19:40便**をご検討ください\n- 上三依塩原温泉口からは木の葉化石園入口まで徒歩7分\n\n■ 送迎サービス\n- 塩原温泉バスターミナルからの送迎を可能な限り承ります\n- 前日までに到着時刻・人数・予約名を連絡必須\n- 送迎不可時は代替アクセスを即案内\n\n■ 改善施策（30日以内）\n- 来館3日前リマインドメールでアクセス分岐案内・GoogleマップURLを送信\n- 送迎台帳を整備し、送迎漏れ件数・当日電話件数をKPIで管理`;
  }
  if (q.includes("ペット") || q.includes("犬") || q.includes("wooinu")) {
    return `【完全版実行計画書より】ペット同伴ルールの明文化ガイドです：\n\n■ 基本ルール（一部専用客室のみ可）\n- しつけ済み・ワクチン接種済みであること\n- レストラン・浴場への同伴は不可\n- 食事はペット用を持参\n- 汚損・破損があった場合は修繕費を負担\n\n■ ペット設備\n- 一部客室に高級ドライルーム wooinu を設置（訴求ポイント）\n\n■ 案内のポイント\n- 予約直後・来館前・当日の3回、ペット同伴の条件と制限を説明\n- 「猫がいる宿」であることとペット同伴客室の棲み分けを公式サイトとOTAに明記`;
  }
  return `ご相談ありがとうございます！\n当館のミッション「猫との出会いと、ぬる湯の癒しで、心身をリセットする場を提供する」を踏まえ、集客・サービス・CRM・データ分析・AIエージェント組織の各専門AIと連携して最適な回答や改善アクションを提案いたします。\n\n以下のキーワードを含めてご質問いただくと、より詳細な情報をお届けできます：\n「清掃」「ぬる湯」「猫」「食事」「外国人/インバウンド」「ブランド/MVV」「集客/直販/SEO」「リピーター/CRM/LINE」「AIエージェント/DX」「実行計画/ロードマップ」「送迎/アクセス」「ペット」`;
}
// 11. 各エージェント（相関図ノード）の表示制御
function setAgentDeptState(deptId, state) {
  const node = document.getElementById(`dept-node-${deptId}`);
  if (!node) return;
  // pending, active-thinking, completed
  node.className = `agent-dept-node ${state}`;
  const statusIcon = node.querySelector(".dept-status");
  if (statusIcon) {
    if (state === "pending") statusIcon.innerText = "⚪";
    else if (state === "active-thinking") statusIcon.innerText = "⏳";
    else if (state === "completed") statusIcon.innerText = "✅";
  }
}
function resetAllAgentDepts() {
  const depts = ["mvv", "mkt", "srv", "crm", "ana"];
  depts.forEach(d => setAgentDeptState(d, "pending"));
  const coo = document.getElementById("agent-node-coo");
  if (coo) coo.className = "agent-node node-coo";
}
// 既存のユーティリティ関数
function copyText(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      el.select();
      navigator.clipboard.writeText(el.value);
    } else {
      navigator.clipboard.writeText(el.innerText);
    }
    alert("コピーしました！");
  }
}
// 画像アセット定義
const imageAssets = {
  cat: "file:///C:/Users/user/.gemini/antigravity/brain/1a948177-ec44-4161-b2c9-5f8e3bba9581/onsen_cat_1779748509090.png",
  food: "file:///C:/Users/user/.gemini/antigravity/brain/1a948177-ec44-4161-b2c9-5f8e3bba9581/onsen_food_1779748533916.png",
  view: "file:///C:/Users/user/.gemini/antigravity/brain/1a948177-ec44-4161-b2c9-5f8e3bba9581/onsen_view_1779748552676.png"
};

// ==================== 復元されたユーティリティ関数 ====================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function triggerTrendImprovement() {
  const line = document.getElementById("crm-active-trend-line");
  const node = document.getElementById("crm-active-trend-node");
  if (line && node) {
    line.setAttribute("d", "M 70,110 L 170,95 L 270,70 L 360,30");
    node.setAttribute("cy", "30");
    node.setAttribute("fill", "var(--success)");
  }
}

async function generateAiContentWithGemini(instruction, presetKey, logFn) {
  const prompt = `あなたは「塩原温泉 赤沢温泉旅館」の優秀なCOO AI（統括司令塔）です。
旅館の特徴：
- 栃木県那須塩原市の箒川（ほうきがわ）沿いの全10室リバービューの個人経営旅館。
- 自慢は38〜40℃の自家源泉かけ流しの「ぬる湯」。
- 4匹の看板猫（みーちゃん、ちびちゃん、ハチ、さくら）がお出迎え。保護猫活動も行っており、将来保護猫カフェを併設予定。
- 食事は中国人シェフによる本格創作中華。木金日限定でヴィーガン中華コースを提供。川魚は炭火焼きで提供。

CEOからの経営指示：
「${instruction}」

この指示に対応するコンテンツを生成し、必ず以下の構造のJSONのみを返してください。マークダウンの囲みや余計な解説文は一切出力せず、純粋なJSONテキストのみを応答してください。

{
  "hp_summary": "自社HPの最上部に貼る、AI Overviews向けで且つユーザーフレンドリーな結論要約のHTMLブロック(ryokan-summary-blockというdivクラスを使用)。今回のCEO指示を反映した紹介文にすること。",
  "hp_jsonld": "HPのheadに埋め込む構造化データJSON-LD（scriptタグで囲むこと。LodgingBusinessタイプをベースにし、多言語対応や今回の施策のカスタム属性を含めること）",
  "gbp_post": "Googleビジネスプロフィール用の魅力的な定期投稿文。ハッシュタグ付き。",
  "gbp_img_desc": "GBP投稿に添えるべき最適な写真の構図の説明（一言で）",
  "insta_post": "Instagram用の投稿キャプション。日本語と英語を併記した魅力的な紹介文とハッシュタグを生成すること。",
  "line_post": "LINE公式アカウントでリピーターへ配信するための、次回予約特典（クーポン付き）の案内メッセージ。",
  "report": "データ統合・分析AIとして生成する、経営改善提言レポート。今回の施策の実行結果（モックのデータに基づき、アクセス数やLINE開封率、再来店確率が向上したシミュレーション）と、今後の経営へのアドバイスを、見出しを含めて200〜300文字程度で論理的に記述すること。"
}`;

  try {
    const response = await fetch(`${apiBaseUrl}/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (response.ok) {
      const resJson = await response.json();
      const rawText = resJson.candidates[0].content.parts[0].text;
      logFn("✅ Gemini APIからコンテンツおよび経営分析レポートの生成が完了しました！データをパースしています...", "coo-msg");
      return JSON.parse(rawText.trim());
    } else {
      const errText = await response.text();
      logFn(`❌ Gemini APIエラー: ${response.status} ${response.statusText}`, "err-msg");
      console.error(errText);
      return null;
    }
  } catch (e) {
    logFn(`❌ 通信エラー: ${e.message}`, "err-msg");
    console.error(e);
    return null;
  }
}

function renderMarketingVisualPreview(tabId) {
  const container = document.getElementById("marketing-visual-preview");
  if (!container) return;

  const hpSummary = document.getElementById("marketing-hp-summary-output").value;
  const gbpPost = document.getElementById("marketing-gbp-post-output").value;
  const instaPost = document.getElementById("marketing-insta-post-output").value;
  const gbpImgDesc = document.getElementById("marketing-gbp-img-desc").innerText;

  if (tabId === "marketing-hp") {
    container.innerHTML = `
      <div style="font-family: 'Noto Serif JP', serif; width: 100%; border: 1px solid #ccc; border-radius: 8px; background: #fff; color: #333; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        <div style="background: #1b3b2b; color: #fff; padding: 15px; text-align: center;">
          <h4 style="margin:0; font-size: 1.1rem; letter-spacing: 2px;">塩原温泉 赤沢温泉旅館 【公式HP】</h4>
        </div>
        <div style="padding: 20px;">
          <div style="margin-bottom: 20px; font-style: italic; color: #777; font-size: 0.8rem; border-bottom: 1px solid #eee; padding-bottom: 5px;">【AI Overviews優先クロール用設置ブロック】</div>
          ${hpSummary || '<div style="color: #999; text-align: center; padding: 20px;">AIが生成した「結論ブロックHTML」がここにレンダリングされます。</div>'}
        </div>
      </div>
    `;
  } else if (tabId === "marketing-gbp") {
    container.innerHTML = `
      <div class="gbp-mock-container" style="width: 100%; max-width: 400px; margin: 0 auto;">
        <div class="gbp-mock-header">
          <div class="gbp-mock-avatar">赤</div>
          <div class="gbp-mock-title-info">
            <h4 style="margin:0; font-size: 0.9rem; color: #fff;">塩原温泉 赤沢温泉旅館</h4>
            <p style="margin:0; font-size: 0.7rem; color: #a0aec0;">Googleマップの投稿</p>
          </div>
        </div>
        <div class="gbp-mock-body" style="padding: 1rem; color: #fff;">
          <p style="font-size: 0.85rem; white-space: pre-wrap; margin-bottom: 1rem;">${gbpPost || '投稿ドラフト文がここに表示されます。'}</p>
          ${gbpPost ? `
          <div style="background: rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px; border: 1px dashed var(--primary); text-align: center;">
            <div style="font-size: 0.75rem; color: var(--primary); font-weight: bold; margin-bottom: 5px;">📷 推奨される写真アセット</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">${gbpImgDesc}</div>
          </div>` : ''}
        </div>
      </div>
    `;
  } else if (tabId === "marketing-instagram") {
    container.innerHTML = `
      <div style="background: #000; border: 1px solid #262626; border-radius: 12px; width: 100%; max-width: 380px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #fff;">
        <div style="display: flex; align-items: center; padding: 10px; gap: 10px; border-bottom: 1px solid #262626;">
          <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px;">赤沢</div>
          <strong style="font-size: 0.85rem;">akasawa_ryokan</strong>
        </div>
        <div style="width: 100%; aspect-ratio: 1/1; background: #111; display: flex; justify-content: center; align-items: center; overflow: hidden; position: relative;">
          <img src="${imageAssets.cat}" style="width: 100%; height: 100%; object-fit: cover;">
          <div style="position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.6); padding: 2px 8px; border-radius: 10px; font-size: 0.7rem;">📍 栃木県 塩原温泉 赤沢温泉旅館</div>
        </div>
        <div style="padding: 10px;">
          <div style="display: flex; gap: 10px; margin-bottom: 8px; font-size: 1.2rem;">
            <span>❤️</span> <span>💬</span> <span>✈️</span>
          </div>
          <p style="font-size: 0.8rem; margin: 0; line-height: 1.4; white-space: pre-wrap;">
            <strong>akasawa_ryokan</strong> ${instaPost || 'Instagramキャプションがここに表示されます。'}
          </p>
        </div>
      </div>
    `;
  }
}

// ==================== VOICEVOX 音声合成関数群 ====================

/**
 * テキストをVOICEVOXで読み上げる
 * Netlify Function (/.netlify/functions/voicevox) を経由して音声取得
 * 失敗した場合はWeb Speech APIにフォールバック
 */
async function speakText(text) {
  // 音声会話モード中の場合の自動再開ヘルパー
  const handleVoiceChatAutoRestart = () => {
    if (typeof isVoiceChatActive !== 'undefined' && isVoiceChatActive && vcAutoRestart) {
      setVcState('listening');
      setTimeout(() => vcStartListening(), 700);
    }
  };

  if (!voiceEnabled || !text) {
    handleVoiceChatAutoRestart();
    return;
  }

  // 再生中の音声を停止
  stopVoice();

  // スマホ対応：非同期処理 (fetch) の前に、ユーザー操作の同期コンテキストで AudioContext を有効化しておく
  try {
    if (!currentAudioCtx) {
      currentAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (currentAudioCtx && currentAudioCtx.state === 'suspended') {
      currentAudioCtx.resume();
    }
  } catch (e) {
    console.warn("Failed to activate AudioContext in speakText:", e);
  }

  // テキストを整形（HTMLタグや装飾記号を除去、300文字に制限）
  let cleanText = text
    .replace(/<br\s*\/?>/gi, '。')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/【[^】]+】/g, '')
    .replace(/■/g, '')
    .replace(/●/g, '')
    .replace(/^\s*[-*#]\s*/gm, '')
    .replace(/https?:\/\/\S+/g, '')
    .trim();

  if (cleanText.length > 300) {
    cleanText = cleanText.substring(0, 297) + '…';
  }
  if (!cleanText) {
    handleVoiceChatAutoRestart();
    return;
  }

  updateVoiceStatus('talking');

  try {
    // Netlify Function でVOICEVOX APIを呼び出す
    const endpoint = isLocal
      ? '/.netlify/functions/voicevox'  // netlify dev で動作
      : '/.netlify/functions/voicevox'; // 本番

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleanText,
        speaker: selectedVoiceSpeaker,
        pitch: 0,
        speed: 1.1
      })
    });

    if (!response.ok) {
      console.warn(`VOICEVOX Function失敗 (${response.status}): Web Speech APIにフォールバック`);
      await speakTextWebSpeech(cleanText);
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      await speakTextWebSpeech(cleanText);
      return;
    }

    // AudioContextで音声を再生
    if (currentAudioCtx) {
      try { currentAudioCtx.close(); } catch(e) {}
    }
    currentAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await currentAudioCtx.decodeAudioData(arrayBuffer);
    currentAudioSource = currentAudioCtx.createBufferSource();
    currentAudioSource.buffer = decoded;
    currentAudioSource.connect(currentAudioCtx.destination);
    isPlayingVoice = true;
    currentAudioSource.onended = () => {
      isPlayingVoice = false;
      updateVoiceStatus('idle');
      handleVoiceChatAutoRestart();
    };
    currentAudioSource.start(0);

  } catch (err) {
    console.warn('VOICEVOX音声再生エラー:', err.message);
    updateVoiceStatus('idle');
    // フォールバック: Web Speech API（ブラウザ標準TTS）
    await speakTextWebSpeech(cleanText);
  }
}

/**
 * Web Speech API (ブラウザ標準) によるフォールバック音声合成
 */
async function speakTextWebSpeech(text) {
  const handleVoiceChatAutoRestart = () => {
    if (typeof isVoiceChatActive !== 'undefined' && isVoiceChatActive && vcAutoRestart) {
      setVcState('listening');
      setTimeout(() => vcStartListening(), 700);
    }
  };

  if (!('speechSynthesis' in window)) {
    handleVoiceChatAutoRestart();
    return;
  }
  try {
    // 進行中の発話をキャンセル
    window.speechSynthesis.cancel();

    // 少しだけ遅延を入れてキャンセルの処理を確実に完了させる（ブラウザのバグ回避）
    await new Promise(resolve => setTimeout(resolve, 50));

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.05;
    utterance.pitch = 1.15;
    utterance.volume = 0.9;

    // 日本語の音声を明示的に探して設定（iOS/Chrome/Edge対策）
    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find(v => v.lang === 'ja-JP' || v.lang.replace('_', '-').startsWith('ja-'));
    if (jaVoice) {
      utterance.voice = jaVoice;
    }

    updateVoiceStatus('talking');
    utterance.onend = () => {
      updateVoiceStatus('idle');
      handleVoiceChatAutoRestart();
    };
    utterance.onerror = (event) => {
      console.warn('Web Speech API onerror:', event);
      updateVoiceStatus('idle');
      handleVoiceChatAutoRestart();
    };
    window.speechSynthesis.speak(utterance);
  } catch(e) {
    console.error('Web Speech API error:', e);
    updateVoiceStatus('idle');
    handleVoiceChatAutoRestart();
  }
}

/**
 * 再生中の音声を停止する
 */
function stopVoice() {
  if (currentAudioSource) {
    try { currentAudioSource.stop(); } catch(e) {}
    currentAudioSource = null;
  }
  if (currentAudioCtx) {
    try { currentAudioCtx.close(); } catch(e) {}
    currentAudioCtx = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  isPlayingVoice = false;
  updateVoiceStatus('idle');
}

/**
 * 音声状態に応じてUIを更新
 */
function updateVoiceStatus(status) {
  const indicator = document.getElementById('voice-speaking-indicator');
  const voiceToggleBtn = document.getElementById('voice-toggle-btn');
  if (status === 'talking') {
    if (indicator) indicator.style.display = 'flex';
    if (voiceToggleBtn) voiceToggleBtn.classList.add('speaking');
  } else {
    if (indicator) indicator.style.display = 'none';
    if (voiceToggleBtn) voiceToggleBtn.classList.remove('speaking');
  }
}

// ==================== 音声会話モード ====================

let isVoiceChatActive = false;
let vcRecognition = null;
let vcAutoRestart = false;

/**
 * 音声会話モードのUI要素を取得するヘルパー
 */
function vcEl(id) { return document.getElementById(id); }

/**
 * 音声会話オーバーレイの状態を更新
 * state: 'idle' | 'listening' | 'thinking' | 'speaking'
 */
function setVcState(state) {
  const avatarWrap    = vcEl('vc-avatar-wrap');
  const waveform      = vcEl('vc-waveform');
  const statusText    = vcEl('vc-status-text');
  const statusSub     = vcEl('vc-status-sub');

  // クラスをリセット
  if (avatarWrap) {
    avatarWrap.classList.remove('vc-listening', 'vc-thinking', 'vc-speaking');
  }
  if (waveform) {
    waveform.classList.remove('wave-idle', 'wave-listen', 'wave-think', 'wave-speak');
  }

  switch (state) {
    case 'listening':
      if (avatarWrap) avatarWrap.classList.add('vc-listening');
      if (waveform)   waveform.classList.add('wave-listen');
      if (statusText) statusText.textContent = '🎤 聞いています...';
      if (statusSub)  statusSub.textContent  = 'はっきりとお話しください。話し終わると自動的に送信されます。';
      break;
    case 'thinking':
      if (avatarWrap) avatarWrap.classList.add('vc-thinking');
      if (waveform)   waveform.classList.add('wave-think');
      if (statusText) statusText.textContent = '🧠 考えています...';
      if (statusSub)  statusSub.textContent  = 'AIにゃんこ先生が回答を生成しています。少々お待ちください。';
      break;
    case 'speaking':
      if (avatarWrap) avatarWrap.classList.add('vc-speaking');
      if (waveform)   waveform.classList.add('wave-speak');
      if (statusText) statusText.textContent = '🔊 話しています...';
      if (statusSub)  statusSub.textContent  = '読み上げが終わると自動的に次の音声入力を開始します。';
      break;
    default: // idle
      if (waveform)   waveform.classList.add('wave-idle');
      if (statusText) statusText.textContent = '準備完了';
      if (statusSub)  statusSub.textContent  = '音声会話ボタンをタップするか、話しかけてください。';
  }
}

/**
 * 音声会話モードを開始する
 */
function startVoiceChatMode() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('お使いのブラウザは音声認識に対応していません。\nChrome または Edge をご使用ください。');
    return;
  }

  isVoiceChatActive = true;
  vcAutoRestart     = true;

  // 音声出力を自動ON
  if (!voiceEnabled) {
    voiceEnabled = true;
    const icon  = document.getElementById('voice-toggle-icon');
    const label = document.getElementById('voice-toggle-label');
    const btn   = document.getElementById('voice-toggle-btn');
    if (icon)  icon.textContent  = '🔊';
    if (label) label.textContent = 'ON';
    if (btn)   btn.classList.add('active');
  }

  // オーバーレイを表示
  const overlay = vcEl('voice-chat-overlay');
  if (overlay) overlay.classList.add('active');

  // バナーを表示
  const banner  = vcEl('vc-active-banner');
  if (banner) banner.classList.add('show');

  // ボタンをアクティブ表示
  const modeBtn = vcEl('voice-chat-mode-btn');
  if (modeBtn) modeBtn.classList.add('active');

  // SpeechRecognition の初期化
  vcRecognition = new SpeechRecognition();
  vcRecognition.lang            = 'ja-JP';
  vcRecognition.interimResults  = true;
  vcRecognition.continuous      = false;

  vcRecognition.onstart = () => {
    setVcState('listening');
  };

  vcRecognition.onresult = (event) => {
    let interim = '';
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += t;
      } else {
        interim += t;
      }
    }
    const box = vcEl('vc-transcript-box');
    const displayText = finalTranscript || interim;
    if (box && displayText) {
      box.textContent = displayText;
      box.classList.add('has-text');
    }
  };

  vcRecognition.onend = async () => {
    if (!isVoiceChatActive) return;
    const box = vcEl('vc-transcript-box');
    const transcript = box ? box.textContent.trim() : '';
    const ignoreTexts = ['話しかけると、ここに認識したテキストが表示されます', '準備完了'];

    if (transcript && !ignoreTexts.includes(transcript)) {
      // テキストが取得できた → チャットに送信
      setVcState('thinking');
      addChatBubble(transcript, 'user');

      // 通常チャットの入力にも反映
      const chatInput = document.getElementById('coo-chat-input');
      if (chatInput) chatInput.value = '';

      // AIへの問い合わせ
      const isExec = transcript.includes('施策') && (transcript.includes('実行') || transcript.includes('やって') || transcript.includes('送って'));
      if (isExec) {
        let preset = transcript.includes('猫') ? 'cats' : 'summer';
        await executeCooIntegratedAction(transcript, preset);
        // 読み上げ完了後に次の録音を開始するフックは addChatBubble → speakText 内で処理
      } else {
        await respondToCooChat(transcript);
      }
    } else {
      // 無言だった → 直ちに再起動
      if (vcAutoRestart && isVoiceChatActive) {
        setTimeout(() => vcStartListening(), 600);
      }
    }
  };

  vcRecognition.onerror = (e) => {
    console.warn('VoiceChat認識エラー:', e.error);
    if (e.error === 'not-allowed') {
      alert('マイクへのアクセスが拒否されました。\nブラウザの設定からマイクの使用を許可してください。');
      stopVoiceChatMode();
      return;
    }
    if (vcAutoRestart && isVoiceChatActive) {
      setTimeout(() => vcStartListening(), 1000);
    }
  };

  // 開始の挨拶を発話（この再生完了時に onended -> vcStartListening() が自動で呼び出され、録音が開始されます）
  speakText("音声会話モードだにゃ！気になることを何でも話しかけてほしいにゃん！");
}

/**
 * 音声認識を開始するラッパー（再起動時も使用）
 */
function vcStartListening() {
  if (!isVoiceChatActive || !vcRecognition) return;
  const box = vcEl('vc-transcript-box');
  if (box) {
    box.textContent = '話しかけると、ここに認識したテキストが表示されます';
    box.classList.remove('has-text');
  }
  try {
    vcRecognition.start();
  } catch (e) {
    // 既に開始している場合など
    setTimeout(() => {
      try { vcRecognition.start(); } catch(e2) {}
    }, 500);
  }
}

/**
 * 音声会話モードを終了する
 */
function stopVoiceChatMode() {
  isVoiceChatActive = false;
  vcAutoRestart     = false;

  if (vcRecognition) {
    try { vcRecognition.stop(); } catch(e) {}
    vcRecognition = null;
  }

  // オーバーレイを非表示
  const overlay = vcEl('voice-chat-overlay');
  if (overlay) overlay.classList.remove('active');

  // バナーを非表示
  const banner = vcEl('vc-active-banner');
  if (banner) banner.classList.remove('show');

  // ボタンのアクティブ解除
  const modeBtn = vcEl('voice-chat-mode-btn');
  if (modeBtn) modeBtn.classList.remove('active');

  setVcState('idle');
}

// 音声会話モードのイベントハンドラ初期化（DOMContentLoaded後に呼ぶ）
function initVoiceChatMode() {
  const modeBtn   = vcEl('voice-chat-mode-btn');
  const endBtn    = vcEl('vc-end-btn');
  const minBtn    = vcEl('vc-minimize-btn');
  const banner    = vcEl('vc-active-banner');
  const overlay   = vcEl('voice-chat-overlay');

  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      unlockMobileAudio();
      if (isVoiceChatActive) {
        stopVoiceChatMode();
      } else {
        startVoiceChatMode();
      }
    });
  }

  if (endBtn) {
    endBtn.addEventListener('click', () => stopVoiceChatMode());
  }

  if (minBtn) {
    // 最小化：オーバーレイを隠すがモードは継続
    minBtn.addEventListener('click', () => {
      if (overlay) overlay.classList.remove('active');
    });
  }

  if (banner) {
    // バナークリック → オーバーレイを再表示
    banner.addEventListener('click', () => {
      if (overlay) overlay.classList.add('active');
    });
  }
}

// DOMContentLoaded に音声会話モードの初期化を追加
document.addEventListener('DOMContentLoaded', () => {
  // 既存の DOMContentLoaded に追加（app.js 内の既存の async 初期化とは別）
  setTimeout(() => initVoiceChatMode(), 100);
});

