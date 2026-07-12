const REVIEW_EXAMPLES = [
  {
    id: 1,
    title: "♨️ 露天風呂とぬる湯",
    review: "内湯は加温しているようで、温かく気持ちの良い温泉ですが、露天は景色は良いのですが、少しぬるすぎました。夏だと丁度良いと思います。"
  },
  {
    id: 2,
    title: "🐈 猫の癒しと静寂",
    review: "フロントでは猫ちゃんたちが出迎えてくれました。無料のコーヒーを飲みながら滝を眺めたり、猫と戯れたりして癒されました。部屋の窓からの景色は木々に囲まれ、川の対岸の温泉街とはひと味違った静けさを感じました。露天風呂、大浴場の窓からの眺めも良く、ぬる湯に長く入っていても飽きなかったです。"
  },
  {
    id: 3,
    title: "🤝 多国籍な接客とできたて配膳",
    review: "従業員のほとんどが外国出身の方のようでしたが、とても丁寧な接客で好印象でした。夕食の天ぷらも揚げたてを運んでくれるので満足です。朝食もお膳仕様で、席についてから温かい鮭や卵焼きを配膳してくれたのは良かったです。おもてなしの心を感じられました。"
  },
  {
    id: 4,
    title: "🥗 こだわりサラダと蒸し餃子",
    review: "夕食朝食とも、生野菜サラダがたっぷりで嬉しかったです。奥様が中国出身だそうで、手作りの蒸し餃子やヤシオマスのお刺身がすごく美味しかったです。温泉街から少し離れた川辺の静かなロケーションも素敵でした。"
  },
  {
    id: 5,
    title: "🏡 貸別荘とスマートな静養",
    review: "温泉付きの古民家貸別荘（あかさわ和風の家）に泊まりました。檜の内風呂の香りが素晴らしく、露天風呂も貸切で最高でした。スマートチェックインができて便利だし、スマートTVや暖炉、洗濯機など長期滞在したくなる設備が全て揃っていました。コスパ最高です。"
  },
  {
    id: 6,
    title: "🐾 ネコカフェとシルバールート",
    review: "近くの『あかさわネコカフェ』も利用しました。可愛い猫ちゃんがいっぱいで癒されました。オーナーさんから南会津を通り新潟へ抜ける『奥日本シルバールート』のドライブ周遊旅行について教えてもらい、明日のドライブがとても楽しみになりました。"
  }
];

// DOM要素
const el = {
  exampleButtons: document.getElementById('example-buttons'),
  reviewInput: document.getElementById('review-input'),
  themeSelect: document.getElementById('theme-select'),
  targetSelect: document.getElementById('target-select'),
  toneSelect: document.getElementById('tone-select'),
  lengthSelect: document.getElementById('length-select'),
  generateBtn: document.getElementById('generate-btn'),
  loader: document.getElementById('loader'),
  statusBadge: document.getElementById('status-badge'),
  placeholderView: document.getElementById('placeholder-view'),
  outputContent: document.getElementById('output-content'),
  
  blogTitle: document.getElementById('blog-title'),
  imagePrompt: document.getElementById('image-prompt'),
  blogBodyPreview: document.getElementById('blog-body-preview'),
  blogBody: document.getElementById('blog-body'),
  metaTitle: document.getElementById('meta-title'),
  metaDesc: document.getElementById('meta-desc'),
  jsonLd: document.getElementById('json-ld')
};

// 1. クイック事例選択ボタンの生成
function initExamples() {
  el.exampleButtons.innerHTML = REVIEW_EXAMPLES.map(ex => `
    <button class="example-btn" data-id="${ex.id}">${ex.title}</button>
  `).join('');

  el.exampleButtons.addEventListener('click', e => {
    const btn = e.target.closest('.example-btn');
    if (!btn) return;

    // アクティブクラスの切り替え
    document.querySelectorAll('.example-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // テキスト挿入
    const id = parseInt(btn.dataset.id, 10);
    const selected = REVIEW_EXAMPLES.find(ex => ex.id === id);
    if (selected) {
      el.reviewInput.value = selected.review;
    }
  });
}

// 2. 簡易マークダウンパーサー (H2, H3, p, blockquoteのパース)
function parseMarkdown(md) {
  let html = md.trim();
  
  // 見出し H3
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  // 見出し H2
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  // 引用 blockquote
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  
  // パラグラフ (空行を基準に分割)
  const paragraphs = html.split(/\n\n+/);
  html = paragraphs.map(p => {
    if (p.startsWith('<h') || p.startsWith('<block')) {
      return p;
    }
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

// 3. ブログ記事自動生成APIの呼び出し
async function generateBlog() {
  const review = el.reviewInput.value.trim();
  const theme = el.themeSelect.value;
  const target = el.targetSelect.value;
  const tone = el.toneSelect.value;
  const length = el.lengthSelect.value;

  if (!review) {
    alert('お客様のクチコミテキストを入力、または事例から選択してください。');
    return;
  }

  // UIをローディング状態にする
  el.generateBtn.disabled = true;
  el.loader.style.display = 'block';
  el.statusBadge.textContent = '生成中...';
  el.statusBadge.classList.remove('active');

  try {
    const response = await fetch('/api/generate-blog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ review, theme, target, tone, length })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'ブログ生成中にエラーが発生しました。');
    }

    // データの描画
    el.blogTitle.textContent = data.title;
    el.imagePrompt.textContent = data.imagePrompt;
    
    // 本文 (プレーンテキストとプレビュー両方)
    el.blogBody.value = data.body;
    el.blogBodyPreview.innerHTML = `
      <div class="lead-text">${parseMarkdown(data.lead)}</div>
      <hr style="border: 0; height: 1px; background: var(--line); margin: 20px 0;">
      ${parseMarkdown(data.body)}
    `;

    // SEOメタデータ
    el.metaTitle.textContent = data.metaTitle || data.title;
    el.metaDesc.textContent = data.metaDescription;

    // JSON-LD 構造化データ
    el.jsonLd.textContent = JSON.stringify(data.jsonLd, null, 2);

    // 画面表示の切り替え
    el.placeholderView.classList.add('hidden');
    el.outputContent.classList.remove('hidden');
    el.statusBadge.textContent = '生成完了';
    el.statusBadge.classList.add('active');

  } catch (error) {
    console.error('API Error:', error);
    alert(error.message || 'サーバー接続に失敗しました。');
    el.statusBadge.textContent = 'エラー';
  } finally {
    el.generateBtn.disabled = false;
    el.loader.style.display = 'none';
  }
}

// 4. コピー機能の実装
function initCopyButtons() {
  document.addEventListener('click', async e => {
    const btn = e.target.closest('.copy-btn');
    if (!btn) return;

    const targetId = btn.dataset.target;
    let textToCopy = '';

    if (targetId === 'blog-title' || targetId === 'meta-title' || targetId === 'meta-desc') {
      textToCopy = document.getElementById(targetId).textContent;
    } else if (targetId === 'blog-body') {
      // 本文の場合はプレーンテキストをコピー
      textToCopy = el.blogBody.value;
    } else {
      textToCopy = document.getElementById(targetId).textContent;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      
      // コピー完了のUIアニメーション
      const originalText = btn.textContent;
      btn.textContent = 'コピー完了 ✓';
      btn.classList.add('copied');
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      alert('コピーに失敗しました。お手数ですが手動で選択してコピーしてください。');
    }
  });
}

// 5. タブ切り替え（本文のプレビューとプレーンテキスト）
function initTabs() {
  document.addEventListener('click', e => {
    const tab = e.target.closest('.tab-btn');
    if (!tab) return;

    const tabType = tab.dataset.tab;
    const parentHead = tab.closest('.output-card-head');
    const card = parentHead.closest('.output-card');
    
    // アクティブ切り替え
    card.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // 表示切り替え
    if (tabType === 'preview') {
      el.blogBodyPreview.classList.remove('hidden');
      el.blogBody.classList.add('hidden');
    } else {
      el.blogBodyPreview.classList.add('hidden');
      el.blogBody.classList.remove('hidden');
    }
  });
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  initExamples();
  initCopyButtons();
  initTabs();

  el.generateBtn.addEventListener('click', generateBlog);
});
