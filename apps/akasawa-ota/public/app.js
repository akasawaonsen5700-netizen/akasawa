// 各OTAのリアルな初期サンプルデータ（プレロード用）
const DEMO_DATA = {
  rakuten: {
    catchCopy: "塩原温泉 赤沢温泉旅館　猫とぬるゆに癒される昔ながらの一軒宿",
    description: "那須塩原温泉郷の箒川沿いに佇む宿です。当館名物の源泉掛け流し100%のぬるゆ温泉や、看板猫たちがお出迎えします。お料理は地元の食材を使った手作り和食をお楽しみください。無料の駐車場も完備しております。",
    plans: "【スタンダード】赤沢のぬる湯と旬の味覚プラン 16,500円〜"
  },
  jalan: {
    catchCopy: "【猫と温泉の宿】のんびり、ぬる湯と地場食材の料理を満喫する休日",
    description: "箒川の渓流沿いに静かに佇む温泉宿。名物ぬる湯の露天風呂と大浴場は一晩中入浴可能！看板猫たちがロビーでお出迎えします。ご夕食は地場の山菜や川魚、手作りの蒸し餃子などをアツアツでお届けします。",
    points: "基本ポイント2%設定のみ。特設クーポンやクーポンフェスには現在不参画。"
  },
  booking: {
    description: "Located in Nasushiobara, Akasawa Onsen Ryokan has a hot spring, garden and free parking. The property is traditional Japanese style. We serve Japanese dinner and breakfast.",
    inboundInfo: "インバウンド利用は現在全体の10%程度。アジア系のファミリーやカップルが稀に来るが、英語の案内がほぼ無くミスマッチが不安。",
    policy: "現地決済または事前決済。当日キャンセルは100%課金。"
  },
  review: {
    reviews: "・内湯はとてもいいお湯で何時間でも入っていられそうでしたが、露天風呂がぬるすぎて寒くてすぐに出ました。(40代男性)\n・ロビーで可愛い猫ちゃんが膝の上に乗ってくれて感動しました！ただ、部屋のテーブルを動かした時に、下に少しホコリが溜まっていたのが気になりました。(30代女性)\n・従業員の方が皆さん外国人で、一生懸命対応してくれて温かい気持ちになりました。ただ、食事の際、まだ食べている途中に天ぷらや次の料理がどんどん運ばれてきて、少し急かされているように感じて残念でした。(50代夫婦)"
  },
  photo: {
    photoList: "1. フロントロビーの少し暗い写真（猫は写っていない）\n2. 温泉大浴場の白く曇った内湯の写真\n3. 露天風呂の引きの写真（お湯がぬるく藻が少し浮いているように見える）\n4. 昭和レトロな和室の畳と座卓の写真\n5. お膳料理の全体写真（ヤシオマスや蒸し餃子は小さくしか映っていない）"
  },
  plan: {
    planName: "【スタンダード】赤沢のぬる湯と旬の創作和食プラン",
    description: "源泉掛け流しのぬる湯をお楽しみいただいた後は、当館オリジナルの創作和食をお召し上がりください。のんびりとお寛ぎいただけます。和室のお部屋になります。",
    details: "1-2名利用時 16,500円〜、特典なし、チェックアウト10:00"
  },
  rank_ad: {
    rankings: "・「那須塩原 温泉」で検索順位48位（ほぼ表示されない）\n・「那須塩原 ぬる湯」で4位\n・「那須塩原 猫の宿」で2位",
    adSpend: "現在、有料広告（楽天ITCキーワード広告やじゃらん販促パックなど）は一切行っていない（月0円）。",
    couponSpend: "じゃらんや楽天で時々思い出したように割引クーポンを少量発行している（月2万円分程度）。"
  }
};

// UIステート
let activeTab = 'rakuten';
let uploadedImageData = null; // { mimeType, data (Base64) }

// DOM要素
const el = {
  navItems: document.querySelectorAll('.nav-item'),
  activeTabTitle: document.getElementById('active-tab-title'),
  loadDemoBtn: document.getElementById('load-demo-btn'),
  otaForm: document.getElementById('ota-form'),
  analyzeBtn: document.getElementById('analyze-btn'),
  loader: document.getElementById('loader'),
  reportStatus: document.getElementById('report-status'),
  placeholderView: document.getElementById('placeholder-view'),
  reportContent: document.getElementById('report-content'),

  // 画像アップロード用
  imageUploadZone: document.getElementById('image-upload-zone'),
  imageFileInput: document.getElementById('image-file-input'),
  imagePreviewContainer: document.getElementById('image-preview-container'),
  imagePreview: document.getElementById('image-preview'),
  removeImageBtn: document.getElementById('remove-image-btn'),

  // レポート出力要素
  reportIssues: document.getElementById('report-issues'),
  reportBefore: document.getElementById('report-before'),
  reportAfter: document.getElementById('report-after'),
  reportManual: document.getElementById('report-manual'),
  reportPromotion: document.getElementById('report-promotion'),
  reportActions: document.getElementById('report-actions'),
  promoPanelTitle: document.getElementById('promo-panel-title')
};

// 1. 起動時の初期サンプルデータのプレロード（空欄を作らない）
function preloadInitialData() {
  loadOtaData('rakuten');
}

function loadOtaData(tab) {
  const data = DEMO_DATA[tab];
  if (!data) return;

  const formContainer = document.getElementById(`form-${tab}`);
  for (const [key, val] of Object.entries(data)) {
    const input = formContainer.querySelector(`[name="${key}"]`);
    if (input) {
      input.value = val;
    }
  }
}

// 2. タブ切り替え処理
function initTabs() {
  el.navItems.forEach(item => {
    item.addEventListener('click', () => {
      activeTab = item.dataset.tab;
      
      // アクティブ表示の切り替え
      el.navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // タイトルの変更
      el.activeTabTitle.textContent = item.textContent.trim();

      // フォームの表示切り替え
      document.querySelectorAll('.form-container').forEach(form => form.classList.add('hidden'));
      document.getElementById(`form-${activeTab}`).classList.remove('hidden');

      // データロード（プレロード）
      loadOtaData(activeTab);

      // 写真タブ以外では画像アップロードデータをクリア
      if (activeTab !== 'photo') {
        clearImage();
      }

      // プロモーションパネルのタイトル名調整
      if (activeTab === 'review') {
        el.promoPanelTitle.textContent = '🛠️ ハード・設備投資アドバイス';
      } else if (activeTab === 'photo') {
        el.promoPanelTitle.textContent = '🎨 画像生成AI用プロンプト';
      } else if (activeTab === 'rank_ad') {
        el.promoPanelTitle.textContent = '📊 予算 ＆ 値引きクーポン原資の最適配分シート';
      } else {
        el.promoPanelTitle.textContent = '🎁 クーポン・プロモーション最適化パラメータ設定値';
      }

      // 右側の出力エリアを初期化（プレースホルダーに戻す）
      el.placeholderView.classList.remove('hidden');
      el.reportContent.classList.add('hidden');
      el.reportStatus.textContent = '未分析';
      el.reportStatus.classList.remove('active');
    });
  });
}

// 3. デモデータのロード（手動クリック用）
function initDemoLoader() {
  el.loadDemoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loadOtaData(activeTab);
  });
}

// 4. 画像アップロード・ドラッグ＆ドロップ制御
function initImageUpload() {
  const zone = el.imageUploadZone;
  const input = el.imageFileInput;

  // クリックでファイル選択を開く
  zone.addEventListener('click', () => {
    input.click();
  });

  input.addEventListener('change', e => {
    handleFiles(e.target.files);
  });

  // ドラッグ＆ドロップイベント
  ['dragenter', 'dragover'].forEach(eventName => {
    zone.addEventListener(eventName, e => {
      e.preventDefault();
      zone.style.borderColor = 'var(--brand)';
      zone.style.background = 'rgba(226, 194, 153, 0.08)';
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, e => {
      e.preventDefault();
      zone.style.borderColor = 'rgba(226, 194, 153, 0.3)';
      zone.style.background = 'rgba(15, 23, 42, 0.4)';
    }, false);
  });

  zone.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    handleFiles(dt.files);
  });

  el.removeImageBtn.addEventListener('click', e => {
    e.stopPropagation();
    clearImage();
  });
}

function handleFiles(files) {
  if (files.length === 0) return;
  const file = files[0];

  if (!file.type.startsWith('image/')) {
    alert('画像ファイルを選択してください。');
    return;
  }

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    const base64Data = reader.result;
    
    // プレビュー表示
    el.imagePreview.src = base64Data;
    el.imagePreviewContainer.classList.remove('hidden');
    el.imageUploadZone.classList.add('hidden');

    // API送信用データ作成 (プレフィックス "data:image/jpeg;base64," を除外)
    const splitIndex = base64Data.indexOf(',') + 1;
    uploadedImageData = {
      mimeType: file.type,
      data: base64Data.substring(splitIndex)
    };
  };
}

function clearImage() {
  el.imageFileInput.value = '';
  el.imagePreview.src = '';
  el.imagePreviewContainer.classList.add('hidden');
  el.imageUploadZone.classList.remove('hidden');
  uploadedImageData = null;
}

// 5. 簡易マークダウンパーサー
function parseMarkdown(md) {
  if (!md) return '';
  let html = md.trim();
  
  // 見出し H4
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  // 見出し H3
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  // 見出し H2
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  
  // 太字
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 箇条書き
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');

  // 改行とパラグラフ
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    if (block.startsWith('<h') || block.startsWith('<li>')) {
      return block;
    }
    if (block.includes('<li>')) {
      return `<ul>${block}</ul>`;
    }
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

// 6. 分析API呼び出しとレンダリング
async function runAnalysis(e) {
  e.preventDefault();

  const formContainer = document.getElementById(`form-${activeTab}`);
  const inputs = formContainer.querySelectorAll('input, textarea, select');
  const payload = {};
  
  let hasValue = false;
  inputs.forEach(input => {
    payload[input.name] = input.value.trim();
    if (input.value.trim()) hasValue = true;
  });

  if (!hasValue && !uploadedImageData) {
    alert('分析対象のデータを入力するか、画像をアップロードしてください。');
    return;
  }

  // UIをローディングに
  el.analyzeBtn.disabled = true;
  el.loader.style.display = 'block';
  el.statusBadge.textContent = '分析中...';
  el.statusBadge.classList.remove('active');

  try {
    const response = await fetch('/api/analyze-ota', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        type: activeTab, 
        payload, 
        imageData: uploadedImageData 
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '分析中にサーバーエラーが発生しました。');
    }

    // 各カードへの描画
    el.reportIssues.textContent = data.issues || '特になし';
    el.reportBefore.textContent = data.beforeText || '現在の設定（未指定）';
    
    // 改善後（After）
    el.reportAfter.innerHTML = parseMarkdown(data.afterText);
    
    // 入稿マニュアル
    el.reportManual.innerHTML = parseMarkdown(data.manual || '管理画面の該当箇所に入稿してください。');

    // クーポン・プロモーションパラメータ
    el.reportPromotion.innerHTML = parseMarkdown(data.promotionParams);

    // アクションリスト
    const actions = data.actionPlan || [];
    el.reportActions.innerHTML = actions.map(act => `
      <li>${act}</li>
    `).join('');

    // 表示切り替え
    el.placeholderView.classList.add('hidden');
    el.reportContent.classList.remove('hidden');
    
    el.reportStatus.textContent = '分析完了';
    el.reportStatus.classList.add('active');

  } catch (error) {
    console.error('Analysis error:', error);
    alert(error.message || '通信エラーが発生しました。');
    el.reportStatus.textContent = 'エラー';
  } finally {
    el.analyzeBtn.disabled = false;
    el.loader.style.display = 'none';
  }
}

// 7. コピー機能
function initCopyButtons() {
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;

    const targetId = btn.dataset.target;
    const targetEl = document.getElementById(targetId);
    let textToCopy = targetEl.innerText || targetEl.textContent;

    try {
      await navigator.clipboard.writeText(textToCopy);
      
      const originalText = btn.textContent;
      btn.textContent = 'コピー完了 ✓';
      btn.classList.add('copied');
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('コピーに失敗しました。');
    }
  });
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initDemoLoader();
  initCopyButtons();
  initImageUpload();

  // 初回起動データプレロード
  preloadInitialData();

  el.otaForm.addEventListener('submit', runAnalysis);
});
