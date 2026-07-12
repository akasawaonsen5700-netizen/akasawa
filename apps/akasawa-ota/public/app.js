// OTA最適化用のデモデータ
const DEMO_DATA = {
  rakuten: {
    catchCopy: "塩原温泉 赤沢温泉旅館　猫とぬるゆに癒される昔ながらの一軒宿",
    description: "那須塩原温泉郷の箒川沿いに佇む宿です。当館名物の源泉掛け流し100%のぬるゆ温泉や、看板猫たちがお出迎えします。お料理は地元の食材を使った手作り和食をお楽しみください。無料の駐車場も完備しております。",
    plans: "【スタンダード】赤沢のぬる湯と旬の味覚プラン 16,500円〜\n【猫好き必見】看板猫と遊べる特別室プラン 18,700円〜"
  },
  jalan: {
    catchCopy: "【猫と温泉の宿】のんびり、ぬる湯と地場食材の料理を満喫する休日",
    plans: "1泊2食付スタンダード和食プラン 16,500円〜\n【直前割】空室限定で1,000円引プラン 15,500円〜\n【ポイント10%】早期予約30日前プラン 17,600円〜",
    points: "基本ポイント設定（2%）。現在じゃらんクーポンフェスなどの販促特集への参画はほぼしていない。"
  },
  booking: {
    description: "Located in Nasushiobara, Akasawa Onsen Ryokan has a hot spring, garden and free parking. The property is traditional Japanese style. We serve Japanese dinner and breakfast.",
    inboundInfo: "インバウンド利用は現在全体の10%程度。アジア系のファミリーやカップルが稀に来る。英語の案内や説明が足りていない。",
    policy: "現地決済または事前決済。キャンセルポリシーは3日前から100%課金。"
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
    details: "1泊2食付き 16,500円〜、特典なし、チェックアウト10:00"
  },
  rank_ad: {
    rankings: "・「那須塩原 温泉」で検索順位48位（ほぼ表示されない）\n・「那須塩原 ぬる湯」で4位\n・「那須塩原 猫の宿」で2位",
    adSpend: "現在、楽天キーワード広告やじゃらん販促パックなどの有料広告は一切行っていない（月0円）。",
    couponSpend: "じゃらんや楽天で時々思い出したように割引クーポンを少量発行している（月2万円分程度）。"
  }
};

// UIステート
let activeTab = 'rakuten';

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

  // レポート出力要素
  reportIssues: document.getElementById('report-issues'),
  reportRevised: document.getElementById('report-revised'),
  reportPromotion: document.getElementById('report-promotion'),
  reportActions: document.getElementById('report-actions')
};

// 1. タブ切り替え処理
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

      // 右側の出力エリアを初期化（プレースホルダーに戻す）
      el.placeholderView.classList.remove('hidden');
      el.reportContent.classList.add('hidden');
      el.reportStatus.textContent = '未分析';
      el.reportStatus.classList.remove('active');
    });
  });
}

// 2. デモデータのロード
function initDemoLoader() {
  el.loadDemoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const data = DEMO_DATA[activeTab];
    if (!data) return;

    const formContainer = document.getElementById(`form-${activeTab}`);
    for (const [key, val] of Object.entries(data)) {
      const input = formContainer.querySelector(`[name="${key}"]`);
      if (input) {
        input.value = val;
      }
    }
  });
}

// 3. 簡易マークダウンパーサー
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
    // 箇条書きリストを <ul> で包む簡易処理
    if (block.includes('<li>')) {
      return `<ul>${block}</ul>`;
    }
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

// 4. API呼び出しとレポートレンダリング
async function runAnalysis(e) {
  e.preventDefault();

  // 現在のアクティブなフォーム内のデータを収集
  const formContainer = document.getElementById(`form-${activeTab}`);
  const inputs = formContainer.querySelectorAll('input, textarea, select');
  const payload = {};
  
  let hasValue = false;
  inputs.forEach(input => {
    payload[input.name] = input.value.trim();
    if (input.value.trim()) hasValue = true;
  });

  if (!hasValue) {
    alert('分析対象のデータを入力するか、デモデータを読み込んでください。');
    return;
  }

  // UIをローディングに切り替え
  el.analyzeBtn.disabled = true;
  el.loader.style.display = 'block';
  el.reportStatus.textContent = '分析中...';
  el.reportStatus.classList.remove('active');

  try {
    const response = await fetch('/api/analyze-ota', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: activeTab, payload })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || '分析中にサーバーエラーが発生しました。');
    }

    // 分析結果をUIに反映
    el.reportIssues.textContent = data.issues || '特になし';
    
    // タイトルの調整
    const revisedTitleEl = document.getElementById('panel-revised-title');
    if (activeTab === 'plan') {
      revisedTitleEl.textContent = '🏷️ 改善されたプラン設計案';
      el.reportRevised.innerHTML = `
        <p><strong>改善後のプラン名:</strong></p>
        <div class="meta-row" style="background:#07090e; padding:8px; border-radius:6px; margin-bottom:12px; color:var(--brand); font-weight:bold;">${data.revisedPlanName}</div>
        <p><strong>リライトされたプラン説明文:</strong></p>
        <div style="background:rgba(255,255,255,0.02); padding:10px; border-radius:6px; margin-bottom:12px; white-space:pre-wrap;">${data.revisedDescription}</div>
        <p><strong>推奨される付加価値特典:</strong></p>
        <div style="margin-bottom:12px;">${parseMarkdown(data.valueAddProps)}</div>
        <p><strong>メインターゲット:</strong></p>
        <div>${data.targetAudience}</div>
      `;
      // プラン改善時はクーポンパネルを非表示または別のアドバイスを格納
      document.getElementById('promotion-panel').classList.add('hidden');
    } else {
      revisedTitleEl.textContent = '📝 改善テキスト・ビジュアル案';
      el.reportRevised.innerHTML = parseMarkdown(data.revisedText || data.body);
      document.getElementById('promotion-panel').classList.remove('hidden');
      
      // クーポン・プロモーションのアドバイスのレンダリング
      el.reportPromotion.innerHTML = parseMarkdown(data.promotionAdvice || '該当のプロモーション設定アドバイスを分析できませんでした。');
    }

    // アクションプランの描画
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

// 5. コピー機能
function initCopyButtons() {
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;

    const targetId = btn.dataset.target;
    const targetEl = document.getElementById(targetId);
    let textToCopy = '';

    if (targetId === 'report-revised' && activeTab === 'plan') {
      // プラン改善時のカスタムテキスト抽出
      const rawTextarea = targetEl.textContent; // ここはHTMLプレビューになっているのでInnerTextを使用
      textToCopy = targetEl.innerText;
    } else {
      textToCopy = targetEl.innerText || targetEl.textContent;
    }

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

  el.otaForm.addEventListener('submit', runAnalysis);
});
