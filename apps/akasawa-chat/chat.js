// AI音声コンシェルジュ制御スクリプト (akasawa-chat)
// 日本語・英語・中国語・韓国語の4カ国語対応、すべて「女性の声」で自動発声

(function() {
  // --- 設定とグローバル状態 ---
  let geminiApiKey = '';
  let isVoiceEnabled = true;
  let recognition = null;
  let isRecording = false;
  let isSpeaking = false;
  let chatHistory = [];
  
  // 予約ヒアリングの状態管理
  const bookingState = {
    active: false,
    step: 0, // 0: 開始前, 1: 日程ヒアリング中, 2: 人数ヒアリング中, 3: プランヒアリング中, 4: 完了
    date: '',
    guests: '',
    plan: ''
  };

  // 言語設定マッピング
  const langConfig = {
    ja: { code: 'ja-JP', voiceKeyword: ['kyoko', 'nanami', 'google 日本語', 'haruka', 'sayaka', 'yuri', 'sin-ji', 'mei-mei'], systemName: 'にゃんこ先生' },
    en: { code: 'en-US', voiceKeyword: ['zira', 'samantha', 'karen', 'moira', 'tessa', 'veena', 'google us english', 'female'], systemName: 'Nyanko' },
    zh: { code: 'zh-CN', voiceKeyword: ['ting-ting', 'tingting', 'hui-hui', 'huihui', 'yaoyao', 'google 普通话', 'female'], systemName: '猫咪老师' },
    ko: { code: 'ko-KR', voiceKeyword: ['sun-hi', 'sunhi', 'yuna', 'google 한국어', 'siri', 'female'], systemName: '냥코선생' }
  };

  // HTML UI要素
  let triggerBtn, chatWindow, closeBtn, messagesContainer, voiceToggleBtn, micBtn, textForm, textInput, waveIndicator, footerTip, voiceStatus;

  // --- 初期化 ---
  document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    loadApiKey();
    setupEventListeners();
    initSpeechRecognition();
    
    // 初期の言語設定に合わせてUIテキストの適用（少し待って翻訳が反映されてから）
    setTimeout(() => {
      updatePlaceholder();
    }, 500);
  });

  // DOM要素のバインド
  function initDOMElements() {
    triggerBtn = document.getElementById('chat-agent-trigger');
    chatWindow = document.getElementById('chat-agent-window');
    closeBtn = document.getElementById('chat-close-btn');
    messagesContainer = document.getElementById('chat-messages');
    voiceToggleBtn = document.getElementById('chat-voice-toggle');
    micBtn = document.getElementById('chat-mic-btn');
    textForm = document.getElementById('chat-text-form');
    textInput = document.getElementById('chat-text-input');
    waveIndicator = document.getElementById('chat-wave-indicator');
    footerTip = document.getElementById('chat-footer-tip');
    voiceStatus = document.getElementById('chat-voice-status');
  }

  // APIキーの読み込み (/akasawa-ml/key.txt)
  async function loadApiKey() {
    try {
      // 開発・本番両方で動作するように絶対パスで読み込む
      const response = await fetch('/akasawa-ml/key.txt');
      if (response.ok) {
        const text = await response.text();
        geminiApiKey = text.trim();
        console.log('Gemini API key loaded successfully.');
      } else {
        console.warn('API key file not found. Falling back to mock dialog mode.');
      }
    } catch (e) {
      console.warn('Failed to load API key. Falling back to mock dialog mode:', e);
    }
  }

  // イベントリスナーの設定
  function setupEventListeners() {
    // 起動ボタンクリック
    triggerBtn.addEventListener('click', () => {
      chatWindow.classList.remove('hidden');
      triggerBtn.classList.add('hidden');
      scrollToBottom();
      
      // 初回表示時に歓迎メッセージを発声
      const welcomeText = getTranslatedText('chat_welcome');
      speak(welcomeText);
    });

    // 閉じるボタンクリック
    closeBtn.addEventListener('click', () => {
      chatWindow.classList.add('hidden');
      triggerBtn.classList.remove('hidden');
      stopSpeaking();
      stopRecording();
    });

    // 音声オンオフ切り替え
    voiceToggleBtn.addEventListener('click', () => {
      isVoiceEnabled = !isVoiceEnabled;
      const wavePath = document.getElementById('speaker-wave-path');
      
      if (isVoiceEnabled) {
        voiceStatus.setAttribute('data-i18n', 'chat_voice_on');
        voiceStatus.textContent = getTranslatedText('chat_voice_on');
        wavePath.style.display = 'block';
        showToastMessage(getTranslatedText('chat_voice_on'));
      } else {
        voiceStatus.setAttribute('data-i18n', 'chat_voice_off');
        voiceStatus.textContent = getTranslatedText('chat_voice_off');
        wavePath.style.display = 'none';
        stopSpeaking();
        showToastMessage(getTranslatedText('chat_voice_off'));
      }
    });

    // マイクボタンクリック (音声入力)
    micBtn.addEventListener('click', () => {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    });

    // テキスト送信
    textForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = textInput.value.trim();
      if (!message) return;
      
      handleUserMessage(message);
      textInput.value = '';
    });

    // 言語セレクターの言語変更を検知してプレースホルダーを更新するフック
    // script.jsの言語変更イベントを模倣、または定期的に監視
    const langObserver = new MutationObserver(() => {
      updatePlaceholder();
    });
    langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  // トースト表示用のヘルパー（script.jsのものを利用するか、なければ自作）
  function showToastMessage(msg) {
    if (typeof showToast === 'function') {
      showToast(msg);
    } else {
      console.log('Toast:', msg);
    }
  }

  // プレースホルダーとフッターヒントの更新
  function updatePlaceholder() {
    if (!textInput) return;
    const placeholder = getTranslatedText('chat_placeholder');
    textInput.placeholder = placeholder;

    if (footerTip) {
      footerTip.textContent = getTranslatedText(isRecording ? 'chat_mic_stop' : 'chat_mic_start');
    }
  }

  // 翻訳テキストの取得
  function getTranslatedText(key) {
    const lang = document.documentElement.lang || 'ja';
    if (typeof translations !== 'undefined' && translations[lang] && translations[lang][key]) {
      return translations[lang][key];
    }
    // デフォルトフォールバック
    const fallback = {
      chat_welcome: "こんにちはにゃん！赤沢温泉旅館 of AI音声コンシェルジュだにゃん。客室のご案内や、宿泊予約のお手伝いをするにゃん。何でも聞いてにゃん！",
      chat_placeholder: "メッセージを入力...",
      chat_listening: "聞き取り中...",
      chat_processing: "考え中...",
      chat_voice_on: "音声オン",
      chat_voice_off: "音声オフ",
      chat_mic_start: "タップして話す",
      chat_mic_stop: "タップして完了"
    };
    return fallback[key] || '';
  }

  // --- 音声合成 (TTS) ---
  function speak(text) {
    if (!isVoiceEnabled || !text) return;
    
    stopSpeaking(); // 現在の発声をクリア
    
    // 話している間は認識を一時停止
    const wasRecording = isRecording;
    if (isRecording) {
      stopRecording();
    }

    isSpeaking = true;
    const currentLang = document.documentElement.lang || 'ja';
    const config = langConfig[currentLang] || langConfig.ja;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = config.code;
    
    // ブラウザの女性音声リストを取得して設定
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;

    if (voices.length > 0) {
      // 1. その言語のボイスをフィルタリング
      const langVoices = voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(currentLang));
      
      // 2. 女性らしき名前のキーワードを優先検索
      for (const keyword of config.voiceKeyword) {
        selectedVoice = langVoices.find(v => v.name.toLowerCase().includes(keyword.toLowerCase()));
        if (selectedVoice) break;
      }
      
      // 3. なければ単に「female」という文字列を含むものを検索
      if (!selectedVoice) {
        selectedVoice = langVoices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('kyoko') || v.name.toLowerCase().includes('siri'));
      }
      
      // 4. それでもなければその言語の最初のボイス
      if (!selectedVoice && langVoices.length > 0) {
        selectedVoice = langVoices[0];
      }
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log(`TTS Voice selected: ${selectedVoice.name} (${selectedVoice.lang})`);
    }

    utterance.onend = () => {
      isSpeaking = false;
      // 話し終わった後にマイクがオンだった場合は再開
      if (wasRecording) {
        startRecording();
      }
    };

    utterance.onerror = (e) => {
      console.error('SpeechSynthesis error:', e);
      isSpeaking = false;
      if (wasRecording) {
        startRecording();
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isSpeaking = false;
  }

  // --- 音声認識 (STT) ---
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API (SpeechRecognition) is not supported in this browser.');
      if (micBtn) micBtn.style.display = 'none'; // マイク非表示
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      isRecording = true;
      micBtn.classList.add('recording');
      waveIndicator.classList.remove('hidden');
      
      // 翻訳テキストの適用
      const listenText = waveIndicator.querySelector('.wave-text');
      if (listenText) {
        listenText.textContent = getTranslatedText('chat_listening');
      }
      if (footerTip) {
        footerTip.textContent = getTranslatedText('chat_mic_stop');
      }
    };

    recognition.onresult = (event) => {
      const resultText = event.results[0][0].transcript;
      if (resultText) {
        handleUserMessage(resultText);
      }
    };

    recognition.onerror = (event) => {
      console.error('SpeechRecognition error:', event.error);
      stopRecording();
    };

    recognition.onend = () => {
      isRecording = false;
      micBtn.classList.remove('recording');
      waveIndicator.classList.add('hidden');
      if (footerTip) {
        footerTip.textContent = getTranslatedText('chat_mic_start');
      }
    };
  }

  function startRecording() {
    if (!recognition) return;
    stopSpeaking(); // 発話中なら止める
    
    const currentLang = document.documentElement.lang || 'ja';
    const config = langConfig[currentLang] || langConfig.ja;
    recognition.lang = config.code;

    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
    }
  }

  function stopRecording() {
    if (!recognition || !isRecording) return;
    try {
      recognition.stop();
    } catch (e) {
      console.error('Failed to stop recognition:', e);
    }
  }

  // --- メッセージ処理フロー ---
  function handleUserMessage(text) {
    // ユーザー発言を画面に表示
    appendMessage(text, 'user');
    
    // 「考え中...」表示
    const processingId = appendProcessingIndicator();
    
    // AIに応答を要求
    getAIResponse(text).then((reply) => {
      removeProcessingIndicator(processingId);
      appendMessage(reply, 'bot');
      speak(reply);
    });
  }

  // メッセージのDOM追加
  function appendMessage(text, sender) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${sender}`;
    
    const content = document.createElement('div');
    content.className = 'bubble-content';
    content.textContent = text;
    
    bubble.appendChild(content);
    messagesContainer.appendChild(bubble);
    scrollToBottom();
    
    // 履歴保持 (Gemini用)
    chatHistory.push({
      role: sender === 'user' ? 'user' : 'model',
      parts: [{ text: text }]
    });
  }

  // 考え中インジケーターの追加
  function appendProcessingIndicator() {
    const id = 'proc-' + Date.now();
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot processing';
    bubble.id = id;
    
    const content = document.createElement('div');
    content.className = 'bubble-content';
    content.textContent = getTranslatedText('chat_processing');
    
    bubble.appendChild(content);
    messagesContainer.appendChild(bubble);
    scrollToBottom();
    return id;
  }

  // 考え中インジケーターの削除
  function removeProcessingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
      indicator.remove();
    }
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // --- 対話ロジック (Gemini / Mock) ---
  async function getAIResponse(userText) {
    const currentLang = document.documentElement.lang || 'ja';
    
    // 1. 予約シナリオのインターセプト
    const bookingReply = handleBookingScenario(userText, currentLang);
    if (bookingReply) {
      return bookingReply;
    }

    // 2. APIキーがあれば Gemini を呼ぶ
    if (geminiApiKey) {
      try {
        return await callGeminiAPI(userText, currentLang);
      } catch (e) {
        console.error('Gemini API call failed, falling back to mock dialogue:', e);
        return getMockResponse(userText, currentLang);
      }
    } else {
      // 3. APIキーがなければモック応答
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(getMockResponse(userText, currentLang));
        }, 1000);
      });
    }
  }

  // Gemini API の呼び出し
  async function callGeminiAPI(userText, lang) {
    const systemInstruction = getSystemInstruction(lang);
    
    // 会話履歴を整形（直近の10往復程度）
    const recentHistory = chatHistory.slice(-20);
    
    const requestBody = {
      contents: recentHistory,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.7
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  // システムインストラクションの定義
  function getSystemInstruction(lang) {
    const baseInstruction = `
You are the AI Voice Concierge "Nyanko-sensei" (🐱) at Akasawa Onsen Ryokan (赤沢温泉旅館).
You must answer questions about the ryokan accurately based on the following facts.
Use an affectionate feline persona.

Facts:
- Concept: A quiet wellness retreat nested by cats, lukewarm hot springs, and mountain streams.
- Wi-Fi: SSID is "AKASAWA_FREE_WiFi", password is "akasawaonsen100".
- Onsen: 100% natural source, lukewarm water. Indoor bath is 40°C, outdoor bath is 38°C. Private Hinoki family bath is 1000 yen for 50 mins (needs reservation).
- Dining: Dinner menu options are: Standard Course, outdoor Wood Deck Jingisukan (venison & pork), Creative Chinese (by Chinese chef), or Vegan course (Thu, Fri, Sun only). Breakfast is Japanese style, congee substitution available.
- Resident Cats: 4 cats spend time in the lobby and hallways.
- Checkout time: 10:00 AM.
- Activities: Rental dog walk, Akasawa tour.

Language specific rules:
`;

    const langRules = {
      ja: baseInstruction + `
- Answer in Japanese.
- Add cat-style suffix "〜だにゃん" or "〜にゃん" at the end of sentences.
- Be polite but cute.
`,
      en: baseInstruction + `
- Answer in English.
- Naturally include cat sounds like "meow!" at the end of sentences (e.g. "We look forward to hosting you, meow!").
`,
      zh: baseInstruction + `
- Answer in Simplified Chinese (简体中文).
- Add cat-style suffix "喵 (miāo)" at the end of sentences (e.g. "欢迎光临喵！").
`,
      ko: baseInstruction + `
- Answer in Korean.
- Add cat-style suffix "~냥 (nyang)" at the end of sentences (e.g. "안녕하세요냥!").
`
    };

    return langRules[lang] || langRules.ja;
  }

  // --- 宿泊予約ヒアリングシナリオ (ローカル/API共通) ---
  function handleBookingScenario(text, lang) {
    const textLower = text.toLowerCase();
    
    // キーワード判定：予約の開始
    const bookingTriggers = {
      ja: ['予約', 'よやく', 'とまりたい', '宿泊したい'],
      en: ['book', 'reserve', 'stay', 'room', 'booking'],
      zh: ['预订', '预约', '想住', '订房'],
      ko: ['예약', '머물고', '숙박', '묵고']
    };

    const triggers = bookingTriggers[lang] || bookingTriggers.ja;
    const isTriggered = triggers.some(t => textLower.includes(t));

    if (!bookingState.active && isTriggered) {
      bookingState.active = true;
      bookingState.step = 1;
      
      const responses = {
        ja: "宿泊のご予約ですねにゃん！お手伝いするにゃん。まず、ご希望の【ご宿泊日】を教えてほしいにゃん？",
        en: "Great! Let's start your booking. First, what is your preferred check-in [Date], meow?",
        zh: "您要预订住宿是吗喵！我很乐意帮您。首先，请告诉我您希望的【入住日期】喵？",
        ko: "숙박 예약이시군요냥! 도와드릴게요냥. 우선 원하시는 【숙박 일정】을 말씀해주시겠어요냥?"
      };
      return responses[lang] || responses.ja;
    }

    if (bookingState.active) {
      if (bookingState.step === 1) {
        bookingState.date = text;
        bookingState.step = 2;
        const responses = {
          ja: `【${text}】のご宿泊だにゃんね。次に、ご利用の【人数】を教えてほしいにゃん？`,
          en: `Great, check-in date is [${text}], meow. Next, how many [Guests] will stay, meow?`,
          zh: `好的，入住日期是【${text}】喵。接下来，请问共有几位【入住人数】喵？`,
          ko: `【${text}】 숙박이시군요냥. 다음으로 이용하실 【인원수】를 말씀해주세요냥?`
        };
        return responses[lang] || responses.ja;
      }
      
      if (bookingState.step === 2) {
        bookingState.guests = text;
        bookingState.step = 3;
        const responses = {
          ja: `【${text}】だにゃんね。最後に、ご希望の【夕食プラン】を教えてほしいにゃん？\n（スタンダード創作 / ジンギスカン / 創作中華 / ヴィーガン）`,
          en: `Understood, [${text}] guests, meow. Finally, which [Dinner Plan] would you like, meow?\n(Standard Course / Jingisukan / Chinese / Vegan)`,
          zh: `收到，一共【${text}】位喵。最后，请问您想选择哪种【晚餐方案】喵？\n（标准创作套餐 / 成吉思汗烤肉锅 / 创意中华 / 素食特别料理）`,
          ko: `【${text}】이시군요냥. 마지막으로 원하시는 【석식 플랜】을 말씀해주세요냥?\n(스탠다드 창작 / 징기스칸 / 창작 중식 / 비건 특별 요리)`
        };
        return responses[lang] || responses.ja;
      }
      
      if (bookingState.step === 3) {
        bookingState.plan = text;
        bookingState.step = 4;
        bookingState.active = false; // 予約フェーズ終了
        
        const summary = {
          ja: `ありがとうございますにゃん！ご予約内容を確認するにゃん。\n\n・日程：${bookingState.date}\n・人数：${bookingState.guests}\n・夕食プラン：${bookingState.plan}\n\nこの内容で仮予約を承りましたにゃん！フロントにて最終手続きを完了いたしますにゃん。`,
          en: `Thank you so much, meow! Here is your booking details:\n\n- Date: ${bookingState.date}\n- Guests: ${bookingState.guests}\n- Dinner Plan: ${bookingState.plan}\n\nI have temporarily reserved this for you, meow! Our staff will finalize it at check-in.`,
          zh: `非常感谢喵！请确认您的预订内容：\n\n・日期：${bookingState.date}\n・人数：${bookingState.guests}\n・晚餐方案：${bookingState.plan}\n\n已经为您录入临时预订喵！前台将为您办理最终入住确认手续喵。`,
          ko: `감사합니다냥! 예약 내용을 확인해드릴게요냥.\n\n・일정: ${bookingState.date}\n・인원: ${bookingState.guests}\n・석식 플랜: ${bookingState.plan}\n\n이 내용으로 가예약을 접수했습니다냥! 프런트에서 최종 등록을 완료하겠습니다냥.`
        };
        return summary[lang] || summary.ja;
      }
    }

    return null;
  }

  // --- モック応答テーブル (APIキーがない場合、または失敗時の超高精度キーワード応答) ---
  function getMockResponse(text, lang) {
    const textLower = text.toLowerCase();
    
    // キーワード定義
    const keywords = {
      wifi: {
        triggers: ['wifi', 'wi-fi', 'ワイファイ', 'わいふぁい', 'パスワード', 'pass', 'ssid'],
        ja: "Wi-FiのSSIDは【AKASAWA_FREE_WiFi】、パスワードは【akasawaonsen100】だにゃん。無料で使い放題だにゃん！",
        en: "Guest Wi-Fi SSID is [AKASAWA_FREE_WiFi] and password is [akasawaonsen100], meow. It's completely free!",
        zh: "客房免费Wi-Fi的SSID是【AKASAWA_FREE_WiFi】，密码是【akasawaonsen100】喵。畅享免费高速网络喵！",
        ko: "와이파이 SSID는 【AKASAWA_FREE_WiFi】 이고 비밀번호는 【akasawaonsen100】 이다냥. 무료로 이용하실 수 있다냥!"
      },
      onsen: {
        triggers: ['温泉', 'おんせん', 'ぬる湯', '露天風呂', '貸切', '檜', 'ひのき', 'bath', 'hot spring'],
        ja: "当館の温泉は自家源泉100%のかけ流しぬる湯だにゃん。内湯は40度前後、露天は38度前後で、長湯にぴったりだにゃん。総檜の貸切露天風呂は50分1,000円（要予約）でプライベート温泉を楽しめるにゃん！",
        en: "Our hot spring is 100% natural, non-recirculating lukewarm spring, meow. Indoor is 40°C, outdoor is 38°C. Private Hinoki outdoor bath is available for 1000 JPY/50 min (booking required), meow!",
        zh: "我们这里的温泉是100%源泉自流的温汤温泉喵。室内温泉40℃左右，露天温泉38℃左右，非常适合长泡喵。总桧木建造的私汤露天温泉50分钟仅需1,000日元（需前台预约）喵！",
        ko: "저희 온천은 자체 원천 100%의 미온천이다냥. 실내탕은 약 40도, 노천탕은 약 38도로 천천히 오래 머물기에 최적이다냥. 편백나무 대여 노천탕은 50분에 1,000엔(예약 필요)으로 이용할 수 있다냥!"
      },
      dining: {
        triggers: ['料理', '夕食', '朝食', 'ご飯', 'ごはん', 'プラン', '食事', '中華', 'ヴィーガン', 'ジンギスカン', 'プラン', 'food', 'dinner', 'meal', 'vegan'],
        ja: "お夕食は和洋中を融合した『スタンダード創作コース』や、ウッドデッキ限定の『鹿×豚の赤沢風ジンギスカン鍋』、本格『創作中華』、そして木金日限定の『ヴィーガン特別料理』から選べるにゃん。朝食はお粥（中国粥）への無料変更も大人気だにゃん！",
        en: "We offer 'Standard Creative Course', Wood-deck 'Jingisukan (venison & pork)', authentic 'Creative Chinese', or 'Vegan Course' (Thu, Fri, Sun only), meow. For breakfast, you can change to Chinese Congee for free, meow!",
        zh: "晚餐您可以选择融合了中西日式的【标准创作套餐】、户外木台限定的【成吉思汗烤肉锅】、正宗的【创意中华】，或者限周四五日提供的【素食特别料理】喵。早餐还可以免费更换成中式热粥，非常受欢迎喵！",
        ko: "석식은 일중양 융합 『스탠다드 창작 코스』, 야외 테라스 전용 『사슴×돼지 징기스칸 냄비』, 정통 『창작 중식』, 목금일 한정 『비건 특별 요리』가 있다냥. 조식을 중국식 죽으로 무료 변경하시는 것도 인기다냥!"
      },
      cat: {
        triggers: ['猫', 'ねこ', 'ネコ', 'ニャンコ', '看板猫', 'cat'],
        ja: "当館には4匹の看板猫たちが暮らしているにゃん。ロビーや廊下、客室の近くをうろうろお散歩しているにゃん。もし見かけたら優しくなでてほしいにゃん！",
        en: "There are four cute resident cats living with us, meow. They walk around the lobby, corridors and near rooms. If you see them, please pet them gently, meow!",
        zh: "我们馆里一共生活着4只看板猫喵。它们总是在前厅、走廊或客房附近悠闲散步喵。如果您遇到它们，请温柔地摸摸它们喵！",
        ko: "여관에는 4마리의 마스코트 고양이들이 살고 있다냥. 로비나 복도, 객室 근처를 유유히 산책한다냥. 발견하시면 다정하게 쓰다듬어달라냥!"
      },
      checkout: {
        triggers: ['チェックアウト', '出る時間', '何時まで', 'checkout', 'check out'],
        ja: "チェックアウトは【午前10:00】だにゃん。朝ものんびりお湯に浸かってから出発してにゃん！",
        en: "Check-out time is [10:00 AM], meow. Take your time and enjoy your morning lukewarm bath before departure, meow!",
        zh: "退房时间是【上午 10:00】喵。早上也请舒舒服服地泡完温泉再悠闲地出发喵！",
        ko: "체크아웃 시간은 【오전 10:00】 이다냥. 아침에도 온천을 충분히 즐기신 후에 천천히 출발해달라냥!"
      },
      sightseeing: {
        triggers: ['観光', '散歩', '周辺', 'コンビニ', 'もみじ谷', '犬', 'レンタルドッグ', 'tour', 'sightseeing', 'walk', 'nearby'],
        ja: "周辺には綺麗な箒川（ほうきがわ）の散策路や、スリル満点の『もみじ谷大吊橋』があるにゃん。あと、宿の可愛いワンちゃんと一緒にお散歩できる『レンタルドッグ』や、オーナーの『あかさわツアー』もおすすめだにゃん。コンビニ（セブンイレブン）は徒歩10分だにゃん！",
        en: "You can enjoy Hoki River walk or visit the thrilling 'Momijidani Suspension Bridge', meow. We also recommend our 'Rental Dog walk' or host's 'Akasawa Tour', meow! Convenience store (7-Eleven) is 10 mins walk.",
        zh: "旅馆周边有美丽的帚川散步道，还有惊险刺激的【红叶谷大吊桥】喵。此外，和旅馆可爱的修狗一起散步的【租借狗狗体验】、老板亲自带队的【赤泽导览之旅】也非常推荐喵。便利店（7-Eleven）步行大约10分钟喵！",
        ko: "주변에는 아름다운 호키강 산책로와 아찔한 『모미지다니 대현수교』가 있다냥. 여관 강아지와 함께 산책하는 『렌탈 독 체험』이나 주인장의 『아카사와 탐방 투어』도 추천한다냥. 편의점(세븐일레븐)은 도보 10분 거리다냥!"
      }
    };

    // マッチング判定
    for (const key in keywords) {
      const match = keywords[key].triggers.some(t => textLower.includes(t));
      if (match) {
        return keywords[key][lang] || keywords[key].ja;
      }
    }

    // デフォルト応答
    const defaults = {
      ja: "何かお困りのことはにゃん？Wi-Fi情報、温泉の入り方、お食事、周辺の観光や、ご宿泊予約のことなど、何でも聞いてほしいにゃん！",
      en: "Is there anything I can help you with, meow? Feel free to ask about Wi-Fi, Hot Springs, Meals, Sightseeing or Room Booking, meow!",
      zh: "有什么我可以帮您的喵？您可以随时询问Wi-Fi密码、温泉指南、特色晚餐、周边观光或者住宿预订等内容喵！",
      ko: "도움이 필요하신가냥? 와이파이, 온천 이용법, 식사 메뉴, 주변 관광이나 숙박 예약 등 무엇이든 물어봐달라냥!"
    };

    return defaults[lang] || defaults.ja;
  }

  // --- 音声リスト読み込み検知用 ---
  // Web Speech APIのボイスリスト取得が非同期なため、ロードされるのをトリガー
  if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
      console.log('Voices updated. Female synthesis search matches prepared.');
    };
  }

})();
