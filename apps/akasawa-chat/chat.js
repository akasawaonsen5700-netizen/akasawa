// 赤沢温泉旅館 デジタルコンシェルジュ (akasawa-chat)
// テキスト質問・キーワード検索コンシェルジュ（日本語・英語・中国語・韓国語対応）

(function() {
  // --- 設定とグローバル状態 ---
  let geminiApiKey = '';
  let chatHistory = [];
  let pastReviews = []; // RAG用の口コミ・回答データ
  
  // 予約ヒアリングの状態管理
  const bookingState = {
    active: false,
    step: 0,
    date: '',
    guests: '',
    plan: ''
  };

  // HTML UI要素
  let messagesContainer, textForm, textInput;

  // --- 初期化 ---
  document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    loadApiKey();
    loadPastReviews();
    setupEventListeners();
    
    setTimeout(() => {
      updatePlaceholder();
    }, 500);
  });

  function initDOMElements() {
    messagesContainer = document.getElementById('chat-messages');
    textForm = document.getElementById('chat-text-form');
    textInput = document.getElementById('chat-text-input');
  }

  // APIキーの読み込み (/akasawa-ml/key.txt)
  async function loadApiKey() {
    try {
      const response = await fetch('/akasawa-ml/key.txt');
      if (response.ok) {
        const text = await response.text();
        geminiApiKey = text.trim();
        console.log('Gemini API key loaded successfully.');
      } else {
        console.warn('API key file not found. Falling back to knowledge search mode.');
      }
    } catch (e) {
      console.warn('Failed to load API key. Falling back to knowledge search mode:', e);
    }
  }

  // 口コミ・ナレッジデータの読み込み (RAG用)
  async function loadPastReviews() {
    try {
      const response = await fetch('past_reviews.md');
      if (response.ok) {
        const text = await response.text();
        const parts = text.split(/(## 事例\d+：[^\n]+)/);
        pastReviews = [];
        for (let i = 1; i < parts.length; i += 2) {
          const heading = parts[i];
          const body = parts[i + 1] || "";
          pastReviews.push(heading + "\n" + body.trim());
        }
        console.log(`Loaded ${pastReviews.length} reviews for RAG.`);
      } else {
        console.warn('past_reviews.md not found.');
      }
    } catch (e) {
      console.warn('Failed to load past_reviews.md:', e);
    }
  }

  function setupEventListeners() {
    if (textForm) {
      textForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = textInput.value.trim();
        if (!message) return;
        
        handleUserMessage(message);
        textInput.value = '';
      });
    }

    // 言語切り替え時のプレースホルダー更新
    const dropdown = document.querySelector('.lang-dropdown');
    if (dropdown) {
      dropdown.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
          setTimeout(updatePlaceholder, 100);
        }
      });
    }
  }

  function updatePlaceholder() {
    const currentLang = window.currentLang || 'ja';
    if (textInput) {
      if (currentLang === 'en') textInput.placeholder = "Type your question or keyword...";
      else if (currentLang === 'zh') textInput.placeholder = "请输入您的提问或关键字...";
      else if (currentLang === 'ko') textInput.placeholder = "질문이나 키워드를 입력하세요...";
      else textInput.placeholder = "質問・キーワードを入力して検索...";
    }
  }

  // ユーザーメッセージの処理
  async function handleUserMessage(message) {
    appendMessage(message, 'user');

    // 予約フォーム制御
    if (bookingState.active) {
      processBookingFlow(message);
      return;
    }

    if (isBookingTrigger(message)) {
      startBookingFlow();
      return;
    }

    showTypingIndicator();

    try {
      let replyText = '';
      if (geminiApiKey) {
        replyText = await generateGeminiResponse(message);
      } else {
        replyText = generateFallbackResponse(message);
      }
      
      removeTypingIndicator();

      // クレンジング（看板猫などの表現禁止ルール適用）
      replyText = sanitizeResponseText(replyText);

      appendMessage(replyText, 'bot');
    } catch (e) {
      console.error('Error generating response:', e);
      removeTypingIndicator();
      const fallback = generateFallbackResponse(message);
      appendMessage(sanitizeResponseText(fallback), 'bot');
    }
  }

  // クレンジング処理（RAG最新ルール適用）
  function sanitizeResponseText(text) {
    return text
      .replace(/看板猫/g, '館内の自由な猫たち（※触れ合い希望の方は別棟の猫カフェがご利用いただけます）')
      .replace(/露天風呂/g, 'お風呂')
      .replace(/ペットと宿泊できる/g, '専用プランにてペットとご宿泊いただける');
  }

  // メッセージの画面追加
  function appendMessage(text, sender) {
    if (!messagesContainer) return;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender} fade-in`;
    
    const content = document.createElement('div');
    content.className = 'bubble-content';
    content.innerText = text;

    bubble.appendChild(content);
    messagesContainer.appendChild(bubble);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function showTypingIndicator() {
    if (!messagesContainer) return;
    const indicator = document.createElement('div');
    indicator.id = 'typing-indicator';
    indicator.className = 'chat-bubble bot fade-in';
    indicator.innerHTML = '<div class="bubble-content"><span class="dots">検索中...</span></div>';
    messagesContainer.appendChild(indicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  function isBookingTrigger(msg) {
    const triggers = ['予約', '泊まりたい', '空室', 'book', 'reservation', '预订', '예약'];
    return triggers.some(t => msg.toLowerCase().includes(t));
  }

  function startBookingFlow() {
    bookingState.active = true;
    bookingState.step = 1;
    const currentLang = window.currentLang || 'ja';
    
    let msg = "ご宿泊の検索・手配をお手伝いいたします。ご希望のご宿泊日程（例：10月15日より1泊）を教えていただけますか？";
    if (currentLang === 'en') msg = "I'd be happy to help with your reservation search. What is your preferred check-in date and length of stay?";
    else if (currentLang === 'zh') msg = "很高兴为您提供预订搜索服务。请问您的预计入住日期和住宿天数是？";
    else if (currentLang === 'ko') msg = "숙박 예약을 도와드리겠습니다. 원하시는 숙박 날짜와 숙박 일수를 말씀해 주세요.";

    appendMessage(msg, 'bot');
  }

  function processBookingFlow(msg) {
    const currentLang = window.currentLang || 'ja';

    if (bookingState.step === 1) {
      bookingState.date = msg;
      bookingState.step = 2;
      let reply = "ありがとうございます。ご利用人数（大人の人数・お子様の有無）を教えてください。";
      if (currentLang === 'en') reply = "Thank you. How many guests will be staying (number of adults/children)?";
      else if (currentLang === 'zh') reply = "谢谢。请问入住人数（大人和儿童人数）是多少？";
      else if (currentLang === 'ko') reply = "감사합니다. 투숙 인원(성인 및 어린이 수)을 알려주세요.";
      appendMessage(reply, 'bot');
    } else if (bookingState.step === 2) {
      bookingState.guests = msg;
      bookingState.step = 3;
      let reply = "承知いたしました。ご希望のお食事タイプ（スタンダード創作料理、ジンギスカン鍋、創作中華、ヴィーガンなど）や特別リクエストはございますか？";
      if (currentLang === 'en') reply = "Got it. Do you have any preferred dining option (Standard Course, Jingisukan, Chinese Creation, or Vegan) or special requests?";
      else if (currentLang === 'zh') reply = "好的。请问您有偏好的用餐类型（标准创作料理、羊肉锅、创作中华、纯素等）或特殊要求吗？";
      else if (currentLang === 'ko') reply = "알겠습니다. 원하시는 식사 타입(스탠다드 코스, 징기스칸, 중식, 비건 등)이나 특별 요청이 있으신가요?";
      appendMessage(reply, 'bot');
    } else if (bookingState.step === 3) {
      bookingState.plan = msg;
      bookingState.step = 4;
      bookingState.active = false;
      
      let reply = `ご希望内容を確認いたしました。
・ご日程：${bookingState.date}
・人数：${bookingState.guests}
・お料理・ご要望：${bookingState.plan}

恐れ入りますが、最終的な空室状況のご確認・正式予約確定につきましては、お電話またはフロント窓口にてご案内しております。（フロント内線：9番）`;

      if (currentLang === 'en') {
        reply = `Thank you. Here are your preferred details:
- Date: ${bookingState.date}
- Guests: ${bookingState.guests}
- Meal/Request: ${bookingState.plan}

To confirm final availability and complete your booking, please contact the front desk or call directly.`;
      }
      appendMessage(reply, 'bot');
    }
  }

  // RAG 検索コンテキスト作成
  function getRAGContext(query) {
    if (!pastReviews || pastReviews.length === 0) return '';

    const queryWords = query.toLowerCase().split(/\s+/);
    const scored = pastReviews.map(text => {
      let score = 0;
      const lower = text.toLowerCase();
      queryWords.forEach(w => {
        if (w.length > 1 && lower.includes(w)) score += 2;
      });
      return { text, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topMatches = scored.slice(0, 3).filter(item => item.score > 0).map(item => item.text);

    if (topMatches.length === 0) return '';
    return "\n【館内・サービス参考情報】:\n" + topMatches.join("\n\n");
  }

  // Gemini API レスポンス生成
  async function generateGeminiResponse(userPrompt) {
    const currentLang = window.currentLang || 'ja';
    const ragContext = getRAGContext(userPrompt);

    const systemPrompt = `
あなたは栃木県塩原温泉の『赤沢温泉旅館』の丁寧で心温まる公式AIコンシェルジュです。
客室のご案内、自家源泉100%ぬる湯、お料理、館内施設、周辺観光、アクセスなどについて、お客様の質問に分かりやすく親身に回答してください。

【厳格回答ルール】
1. 猫の表現ルール: 猫は館内・旅館で自由気ままに暮らしています。「看板猫」という単語・表現は絶対に使わず、猫と触れ合いたい・遊びたいお客様には別棟にある「猫カフェ」を案内してください。
2. 露天風呂ルール: 「露天風呂」を宿のメインの売りとして前面に出さないこと。
3. ペット宿泊ルール: ペットと宿泊できる部屋は限られるため、全面的なアピールとして前面には出さないこと（※ペット同伴専用プランの中でのみ案内する）。
4. 丁寧で上品な接客口調で回答してください。

言語設定: ${currentLang}
${ragContext}
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const bodyData = {
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + "\n\nお客様の質問: " + userPrompt }] }
      ]
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    if (!res.ok) {
      throw new Error(`Gemini API Error: ${res.status}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || generateFallbackResponse(userPrompt);
  }

  // フォールバック応答
  function generateFallbackResponse(query) {
    const currentLang = window.currentLang || 'ja';
    const q = query.toLowerCase();

    if (q.includes('風呂') || q.includes('温泉') || q.includes('ぬる湯') || q.includes('bath') || q.includes('onsen')) {
      if (currentLang === 'en') return "Our hot spring features 100% pure, unadulterated free-flowing thermal water ('Nuruyu'). The mild temperature (around 38-40°C) allows you to relax for extended periods without fatigue.";
      return "当館の温泉は、加水・加温・循環を一切行わない、完全自家源泉100%かけ流しの「ぬる湯」でございます。約38℃〜40℃の優しい湯温ですので、体に負担をかけずじっくりと長湯をお楽しみいただけます。";
    }

    if (q.includes('猫') || q.includes('ねこ') || q.includes('cat')) {
      if (currentLang === 'en') return "Cats live freely and peacefully around our inn. If you would like to interact and play with cats, please visit our separate Cat Café building.";
      return "当館では猫たちが自由気ままに生活しております。なお、猫ちゃんとじっくり遊んだり触れ合いを楽しみたいお客様には、別棟の「猫カフェ」をご案内しております。ぜひそちらもご利用ください。";
    }

    if (q.includes('飯') || q.includes('食事') || q.includes('料理') || q.includes('夕食') || q.includes('朝食') || q.includes('dining') || q.includes('food')) {
      if (currentLang === 'en') return "We serve delicious handmade seasonal courses blending Japanese, Western, and Chinese culinary styles. We also offer special Jingisukan BBQ on the outdoor deck and Vegan options (Thu, Fri, Sun).";
      return "お食事は、地元・栃木の旬の食材を活かした手作りの創作料理をご用意しております。和・洋・中の枠にとらわれない基本コースのほか、ウッドデッキでのジンギスカン鍋、ヴィーガン特別料理（木・金・日限定）もお選びいただけます。";
    }

    if (q.includes('wifi') || q.includes('ワイファイ') || q.includes('インターネット')) {
      return "全客室および館内にて無料Wi-Fiをご利用いただけます。SSID: Akasawa_Guest_WiFi / PASSWORD: akasawaonsen2026";
    }

    if (currentLang === 'en') return "Thank you for your inquiry. For detailed information or special assistance, please feel free to ask our front desk (Extension 9).";
    return "お問い合わせありがとうございます。客室や館内施設、ご予約についてご不明な点がございましたら、お気軽にフロント（内線9番）までお尋ねください。";
  }

})();
