// グローバル変数で現在の言語を保持
let currentLang = 'ja';

/**
 * 安全にlocalStorageから値を取得するヘルパー
 */
function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('localStorage is disabled or inaccessible:', e);
    return null;
  }
}

/**
 * 安全にlocalStorageへ値を保存するヘルパー
 */
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('localStorage is disabled or inaccessible:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. 言語の初期化と適用（翻訳処理を含む）
  initLanguage();

  // ページロード時のフェードイン効果
  const container = document.querySelector('.app-container');
  if (container) {
    container.classList.add('fade-in');
  }

  // Wi-Fi情報のワンタップコピー機能
  setupWifiCopy();

  // 言語セレクターのイベントリスナー設定
  setupLanguageSelector();
});

/**
 * URLパラメータ、ローカルストレージ、ブラウザ設定から適切な言語を判定する
 */
function initLanguage() {
  // URLパラメータチェック (?lang=xx)
  const urlParams = new URLSearchParams(window.location.search);
  let lang = urlParams.get('lang');

  // ローカルストレージチェック
  if (!lang) {
    lang = safeGetItem('selected_language');
  }

  // ブラウザの言語設定チェック (QRコードアクセス時の自動認知用)
  if (!lang) {
    const browserLang = navigator.language || (navigator.languages && navigator.languages[0]);
    if (browserLang) {
      const normalized = browserLang.toLowerCase();
      if (normalized.startsWith('ja')) {
        lang = 'ja';
      } else if (normalized.startsWith('zh')) {
        lang = 'zh';
      } else if (normalized.startsWith('ko')) {
        lang = 'ko';
      } else {
        lang = 'en'; // それ以外の言語（英語含む）は英語にフォールバック
      }
    }
  }

  // サポートされていない言語の場合はデフォルトで 'ja'
  if (!lang || !['ja', 'en', 'zh', 'ko'].includes(lang)) {
    lang = 'ja';
  }

  currentLang = lang;
  safeSetItem('selected_language', lang);
  updateTranslations(lang);
}

/**
 * ページ全体に翻訳を適用する
 * @param {string} lang 
 */
function updateTranslations(lang) {
  // translationsが定義されているか確認
  if (typeof translations === 'undefined' || !translations[lang]) {
    console.error('Translation data not found for lang: ' + lang);
    return;
  }

  const dict = translations[lang];

  // htmlのlang属性を更新
  document.documentElement.lang = lang;

  // [data-i18n] 要素の翻訳
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) {
      el.textContent = dict[key];
    }
  });

  // [data-i18n-html] 要素の翻訳
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (dict[key] !== undefined) {
      el.innerHTML = dict[key];
    }
  });

  // ページタイトル (document.title) の更新
  const path = window.location.pathname;
  let titleKey = 'title_index';
  if (path.includes('dining.html')) {
    titleKey = 'title_dining';
  } else if (path.includes('facilities.html')) {
    titleKey = 'title_facilities';
  } else if (path.includes('onsen.html')) {
    titleKey = 'title_onsen';
  } else if (path.includes('sightseeing.html')) {
    titleKey = 'title_sightseeing';
  }
  
  if (dict[titleKey]) {
    document.title = dict[titleKey];
  }

  // 言語セレクターUIの更新
  updateLanguageSelectorUI(lang);
}

/**
 * 言語選択セレクターのクリック動作などの設定
 */
function setupLanguageSelector() {
  const selector = document.querySelector('.lang-selector');
  if (!selector) return;

  const btn = selector.querySelector('.lang-selector-btn');
  const dropdown = selector.querySelector('.lang-dropdown');

  if (btn) {
    // 既存のイベントリスナーとの重複を防ぐため一度クローンして差し替え
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selector.classList.toggle('active');
    });
  }

  // ドロップダウン内の言語ボタンクリック
  if (dropdown) {
    dropdown.querySelectorAll('button').forEach(button => {
      // 重複登録防止のためクローン差し替え
      const newButton = button.cloneNode(true);
      button.parentNode.replaceChild(newButton, button);
      
      newButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const selectedLang = newButton.getAttribute('data-lang');
        if (selectedLang && selectedLang !== currentLang) {
          currentLang = selectedLang;
          safeSetItem('selected_language', selectedLang);
          updateTranslations(selectedLang);
        }
        selector.classList.remove('active');
      });
    });
  }

  // ドロップダウン外クリックで閉じる
  document.removeEventListener('click', closeLangDropdown);
  document.addEventListener('click', closeLangDropdown);
}

function closeLangDropdown() {
  const selector = document.querySelector('.lang-selector');
  if (selector) {
    selector.classList.remove('active');
  }
}

/**
 * 言語選択セレクターの表示テキストとアクティブ状態を更新する
 * @param {string} lang 
 */
function updateLanguageSelectorUI(lang) {
  const selector = document.querySelector('.lang-selector');
  if (!selector) return;

  const currentLabelEl = selector.querySelector('.current-lang');
  if (currentLabelEl) {
    const langNames = {
      ja: '日本語',
      en: 'English',
      zh: '简体中文',
      ko: '한국어'
    };
    currentLabelEl.textContent = langNames[lang] || '日本語';
  }

  const dropdown = selector.querySelector('.lang-dropdown');
  if (dropdown) {
    dropdown.querySelectorAll('button').forEach(button => {
      const btnLang = button.getAttribute('data-lang');
      if (btnLang === lang) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }
}

/**
 * Wi-FiのSSIDおよびパスワードのコピー機能とトースト通知の設定
 */
function setupWifiCopy() {
  const infoRows = document.querySelectorAll('.quick-info-widget .info-row, .item-card .alert-box .info-row');
  
  infoRows.forEach(row => {
    const labelEl = row.querySelector('.info-label');
    const valueEl = row.querySelector('.info-value');
    
    // SSIDまたはパスワードの行である場合
    if (labelEl && valueEl) {
      row.style.cursor = 'pointer';
      
      // ツールチップメッセージも多言語化
      const getCopyTip = () => {
        const tips = {
          ja: 'タップしてコピー',
          en: 'Tap to copy',
          zh: '轻触复制',
          ko: '터치하여 복사'
        };
        return tips[currentLang] || tips['ja'];
      };
      
      row.title = getCopyTip();
      
      // 既存のクリックイベントをクリアするためクローン差し替え
      const newRow = row.cloneNode(true);
      row.parentNode.replaceChild(newRow, row);
      
      // タップイベント登録
      newRow.addEventListener('click', () => {
        const textToCopy = newRow.querySelector('.info-value').textContent.trim();
        const dict = translations[currentLang] || translations['ja'];
        
        let message = '';
        const isSSID = labelEl.textContent.includes('SSID') || 
                       (labelEl.getAttribute('data-i18n') && labelEl.getAttribute('data-i18n').includes('ssid')) ||
                       labelEl.textContent.includes('SSID:');
        
        if (isSSID) {
          message = dict['copied_sssid'] || 'SSID をコピーしました';
        } else {
          message = dict['copied_pass'] || 'パスワード をコピーしました';
        }
        
        // SSIDやPASS以外の一般的な情報（フロント内線など）はコピー対象外にする
        if (!isSSID && !labelEl.textContent.includes('PASS') && !labelEl.textContent.includes('パスワード') && !labelEl.getAttribute('data-i18n')?.includes('pass')) {
          return;
        }
        
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast(message);
        }).catch(err => {
          console.error('コピーに失敗しました: ', err);
          showToast(dict['copy_failed'] || 'コピーに失敗しました。');
        });
      });
    }
  });
}

/**
 * 画面下部に一時的な通知トーストを表示する
 * @param {string} message 
 */
function showToast(message) {
  // 既存のトーストがあれば削除
  const existingToast = document.querySelector('.wifi-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // トースト要素の作成
  const toast = document.createElement('div');
  toast.className = 'wifi-toast';
  toast.textContent = message;

  // トーストのスタイル設定
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '90px', // 下部ナビゲーションより上
    left: '50%',
    transform: 'translateX(-50%) translateY(20px)',
    backgroundColor: 'rgba(44, 42, 41, 0.98)',
    color: '#f7f4eb',
    padding: '10px 20px',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontFamily: 'sans-serif',
    letterSpacing: '0.05em',
    zIndex: '1000',
    opacity: '0',
    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    border: '1px solid #c5a059',
    textAlign: 'center',
    whiteSpace: 'nowrap'
  });

  document.body.appendChild(toast);

  // 表示アニメーション
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  // 2.5秒後に非表示にして削除
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    
    // アニメーション完了後にDOMから削除
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, 2500);
}
