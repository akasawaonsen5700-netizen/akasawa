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
    ja: { code: 'ja-JP', voiceKeyword: ['kyoko', 'nanami', 'google 日本語', 'haruka', 'sayaka', 'yuri', 'sin-ji', 'mei-mei'], systemName: 'コンシェルジュ' },
    en: { code: 'en-US', voiceKeyword: ['zira', 'samantha', 'karen', 'moira', 'tessa', 'veena', 'google us english', 'female'], systemName: 'Concierge' },
    zh: { code: 'zh-CN', voiceKeyword: ['ting-ting', 'tingting', 'hui-hui', 'huihui', 'yaoyao', 'google 普通话', 'female'], systemName: '客服助手' },
    ko: { code: 'ko-KR', voiceKeyword: ['sun-hi', 'sunhi', 'yuna', 'google 한국어', 'siri', 'female'], systemName: '컨시어지' }
  };

  // HTML UI要素
  let messagesContainer, voiceToggleBtn, micBtn, textForm, textInput, waveIndicator, footerTip, voiceStatus;

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
    // 音声オンオフ切り替え
    if (voiceToggleBtn) {
      voiceToggleBtn.addEventListener('click', () => {
        isVoiceEnabled = !isVoiceEnabled;
        const wavePath = document.getElementById('speaker-wave-path');
        
        if (isVoiceEnabled) {
          if (voiceStatus) {
            voiceStatus.setAttribute('data-i18n', 'chat_voice_on');
            voiceStatus.textContent = getTranslatedText('chat_voice_on');
          }
          if (wavePath) wavePath.style.display = 'block';
          showToastMessage(getTranslatedText('chat_voice_on'));
        } else {
          if (voiceStatus) {
            voiceStatus.setAttribute('data-i18n', 'chat_voice_off');
            voiceStatus.textContent = getTranslatedText('chat_voice_off');
          }
          if (wavePath) wavePath.style.display = 'none';
          stopSpeaking();
          showToastMessage(getTranslatedText('chat_voice_off'));
        }
      });
    }

    // マイクボタンクリック (音声入力)
    if (micBtn) {
      micBtn.addEventListener('click', () => {
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      });
    }

    // テキスト送信
    if (textForm) {
      textForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = textInput.value.trim();
        if (!message) return;
        
        handleUserMessage(message);
        textInput.value = '';
      });
    }

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
      ja: {
        chat_welcome: "こんにちは。赤沢温泉旅館のAI音声コンシェルジュです。客室のご案内や、宿泊予約のお手伝いをいたします。何でもお気軽にお尋ねください。",
        chat_placeholder: "メッセージを入力...",
        chat_listening: "聞き取り中...",
        chat_processing: "考え中...",
        chat_voice_on: "音声オン",
        chat_voice_off: "音声オフ",
        chat_mic_start: "タップして話す",
        chat_mic_stop: "タップして完了",
        chat_err_not_allowed: "マイクの使用が許可されていないか、非セキュア環境（HTTPS接続が必要）のため音声入力が利用できません。",
        chat_err_no_speech: "音声が検知されませんでした。もう一度お試しください。",
        chat_err_network: "ネットワークエラーが発生しました。音声認識に失敗しました。",
        chat_err_default: "音声認識エラーが発生しました。",
        chat_err_tts: "音声の出力に失敗しました。音量設定や画面のタップ状態をご確認ください。"
      },
      en: {
        chat_welcome: "Hello. I'm your AI Voice Concierge. I can assist you with room guides and hotel reservations. Please feel free to ask.",
        chat_placeholder: "Type a message...",
        chat_listening: "Listening...",
        chat_processing: "Thinking...",
        chat_voice_on: "Voice On",
        chat_voice_off: "Voice Off",
        chat_mic_start: "Tap to talk",
        chat_mic_stop: "Tap to stop",
        chat_err_not_allowed: "Microphone access is denied, or voice input is unavailable due to a non-secure environment (HTTPS required).",
        chat_err_no_speech: "No speech was detected. Please try again.",
        chat_err_network: "A network error occurred during speech recognition.",
        chat_err_default: "An error occurred with speech recognition.",
        chat_err_tts: "Failed to play audio. Please check your volume settings or tap the screen first."
      },
      zh: {
        chat_welcome: "您好，我是您的AI语音管家。我可以为您提供客房指南和酒店预订服务。请随时提问。",
        chat_placeholder: "输入消息...",
        chat_listening: "正在倾听...",
        chat_processing: "正在思考...",
        chat_voice_on: "语音开启",
        chat_voice_off: "语音关闭",
        chat_mic_start: "轻触说话",
        chat_mic_stop: "轻触结束",
        chat_err_not_allowed: "麦克风访问被拒绝，或者由于非安全环境（需要HTTPS）导致语音输入不可用。",
        chat_err_no_speech: "未检测到语音。请再试一次。",
        chat_err_network: "语音识别过程中发生网络错误。",
        chat_err_default: "语音识别发生错误。",
        chat_err_tts: "无法播放音频。请检查音量设置，或先点击屏幕。"
      },
      ko: {
        chat_welcome: "안녕하세요. AI 음성 컨시어지입니다. 객실 안내 및 호텔 예약을 도와드릴 수 있습니다. 편하게 말씀해 주세요.",
        chat_placeholder: "메시지 입력...",
        chat_listening: "듣고 있음...",
        chat_processing: "생각 중...",
        chat_voice_on: "음성 켜짐",
        chat_voice_off: "음성 꺼짐",
        chat_mic_start: "탭하여 말하기",
        chat_mic_stop: "탭하여 완료",
        chat_err_not_allowed: "마이크 액세스가 거부되었거나 안전하지 않은 환경(HTTPS 필요)으로 인해 음성 입력을 사용할 수 없습니다.",
        chat_err_no_speech: "음성이 감지되지 않았습니다. 다시 시도해 주세요.",
        chat_err_network: "음성 인식 중 네트워크 오류가 발생했습니다.",
        chat_err_default: "음성 인식 오류가 발생했습니다.",
        chat_err_tts: "오디오를 재생하지 못했습니다. 볼륨 설정을 확인하거나 화면을 먼저 탭해 주세요."
      }
    };
    const userLang = langConfig[lang] ? lang : 'ja';
    return fallback[userLang][key] || fallback['ja'][key] || '';
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
      // 自動再生ポリシーなどの影響による再生失敗時にユーザーへ通知
      if (e.error === 'not-allowed') {
        showToastMessage(getTranslatedText('chat_err_tts'));
      }
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
      // 音声認識非対応の場合、マイククリック時に警告を出すようにする
      if (micBtn) {
        micBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          showToastMessage(getTranslatedText('chat_err_not_allowed'));
        });
      }
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      isRecording = true;
      if (micBtn) micBtn.classList.add('recording');
      if (waveIndicator) {
        waveIndicator.classList.remove('hidden');
        const listenText = waveIndicator.querySelector('.wave-text');
        if (listenText) {
          listenText.textContent = getTranslatedText('chat_listening');
        }
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
      
      // エラータイプに応じたユーザー通知
      if (event.error === 'not-allowed') {
        showToastMessage(getTranslatedText('chat_err_not_allowed'));
      } else if (event.error === 'no-speech') {
        showToastMessage(getTranslatedText('chat_err_no_speech'));
      } else if (event.error === 'network') {
        showToastMessage(getTranslatedText('chat_err_network'));
      } else {
        showToastMessage(getTranslatedText('chat_err_default'));
      }
    };

    recognition.onend = () => {
      isRecording = false;
      if (micBtn) micBtn.classList.remove('recording');
      if (waveIndicator) waveIndicator.classList.add('hidden');
      if (footerTip) {
        footerTip.textContent = getTranslatedText('chat_mic_start');
      }
    };
  }

  function startRecording() {
    // 非セキュアかつlocalhost以外の場合は、API呼び出し前にエラー通知を行う
    const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isSecure) {
      showToastMessage(getTranslatedText('chat_err_not_allowed'));
      return;
    }

    if (!recognition) {
      showToastMessage(getTranslatedText('chat_err_not_allowed'));
      return;
    }
    stopSpeaking(); // 発話中なら止める
    
    const currentLang = document.documentElement.lang || 'ja';
    const config = langConfig[currentLang] || langConfig.ja;
    recognition.lang = config.code;

    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      showToastMessage(getTranslatedText('chat_err_default'));
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
    if (!text || !text.trim()) return;

    // ユーザー発言を画面に表示
    appendMessage(text, 'user');
    
    // 「考え中...」表示
    const processingId = appendProcessingIndicator();
    
    // AIに応答を要求
    getAIResponse(text).then((reply) => {
      removeProcessingIndicator(processingId);
      appendMessage(reply, 'bot');
      speak(reply);
    }).catch((err) => {
      console.error('handleUserMessage error:', err);
      removeProcessingIndicator(processingId);
      const errMsg = getTranslatedText('chat_err_default');
      appendMessage(errMsg, 'bot');
    });
  }

  // メッセージのDOM追加
  function appendMessage(text, sender) {
    // messagesContainerが未取得の場合は再取得を試みる
    if (!messagesContainer) {
      messagesContainer = document.getElementById('chat-messages');
    }
    if (!messagesContainer) {
      console.error('chat-messages element not found');
      return;
    }

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
    if (!messagesContainer) {
      messagesContainer = document.getElementById('chat-messages');
    }
    if (!messagesContainer) return 'none';

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
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
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
You are the AI Voice Concierge (👩) at Akasawa Onsen Ryokan (赤沢温泉旅館).
You must answer questions about the ryokan accurately based on the following facts.
Please act as a polite and friendly female concierge.

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
- Use a polite, formal and helpful Japanese tone (e.g. "〜でございます", "〜いたします").
`,
      en: baseInstruction + `
- Answer in English.
- Use a polite, friendly, and helpful tone.
`,
      zh: baseInstruction + `
- Answer in Simplified Chinese (简体中文).
- Use a polite and hospitable tone.
`,
      ko: baseInstruction + `
- Answer in Korean.
- Use a polite and formal tone (e.g. "〜습니다", "〜합니다").
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
        ja: "宿泊のご予約ですね。お手伝いいたします。まず、ご希望の【ご宿泊日】を教えていただけますでしょうか？",
        en: "Certainly. I can assist you with your booking. First, what is your preferred check-in [Date]?",
        zh: "您需要预订住宿是吗？我很乐意为您服务。首先，请告诉我您希望的【入住日期】是多少？",
        ko: "숙박 예약이시군요. 도와드리겠습니다. 우선 원하시는 【숙박 일정】을 말씀해주시겠습니까?"
      };
      return responses[lang] || responses.ja;
    }

    if (bookingState.active) {
      if (bookingState.step === 1) {
        bookingState.date = text;
        bookingState.step = 2;
        const responses = {
          ja: `【${text}】のご宿泊でございますね。次に、ご利用の【人数】を教えていただけますでしょうか？`,
          en: `Understood, check-in date is [${text}]. Next, how many [Guests] will be staying?`,
          zh: `好的，入住日期是【${text}】。接下来，请问共有几位【入住人数】？`,
          ko: `【${text}】 숙박이시군요. 다음으로 이용하실 【인원수】를 말씀해주시겠습니까?`
        };
        return responses[lang] || responses.ja;
      }
      
      if (bookingState.step === 2) {
        bookingState.guests = text;
        bookingState.step = 3;
        const responses = {
          ja: `【${text}】でございますね。最後に、ご希望の【夕食プラン】を教えていただけますでしょうか？\n（スタンダード創作 / ジンギスカン / 創作中華 / ヴィーガン）`,
          en: `Understood, [${text}] guests. Finally, which [Dinner Plan] would you prefer?\n(Standard Course / Jingisukan / Chinese / Vegan)`,
          zh: `好的，一共【${text}】位。最后，请问您想选择哪种【晚餐方案】？\n（标准创作套餐 / 成吉思汗烤肉锅 / 创意中华 / 素食特别料理）`,
          ko: `【${text}】이시군요. 마지막으로 원하시는 【석식 플랜】을 말씀해주시겠습니까?\n(스탠다드 창작 / 징기스칸 / 창작 중식 / 비건 특별 요리)`
        };
        return responses[lang] || responses.ja;
      }
      
      if (bookingState.step === 3) {
        bookingState.plan = text;
        bookingState.step = 4;
        bookingState.active = false; // 予約フェーズ終了
        
        const summary = {
          ja: `ありがとうございます。ご予約内容を確認いたします。\n\n・日程：${bookingState.date}\n・人数：${bookingState.guests}\n・夕食プラン：${bookingState.plan}\n\nこの内容で仮予約を承りました。フロントにて最終手続きを完了いたします。`,
          en: `Thank you so much. Here are your booking details:\n\n- Date: ${bookingState.date}\n- Guests: ${bookingState.guests}\n- Dinner Plan: ${bookingState.plan}\n\nI have temporarily reserved this for you. Our staff will finalize it at check-in.`,
          zh: `非常感谢您的预订！请确认您的预订内容：\n\n・日期：${bookingState.date}\n・人数：${bookingState.guests}\n・晚餐方案：${bookingState.plan}\n\n已经为您录入临时预订！前台将为您办理最终入住确认手续。`,
          ko: `감사합니다. 예약 내용을 확인해드리겠습니다.\n\n・일정: ${bookingState.date}\n・인원: ${bookingState.guests}\n・석식 플랜: ${bookingState.plan}\n\n이 내용으로 가예약을 접수했습니다. 프런트에서 최종 등록을 완료하겠습니다.`
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
        ja: "客室フリーWi-FiのSSIDは【AKASAWA_FREE_WiFi】、パスワードは【akasawaonsen100】でございます。無料でご利用いただけます。",
        en: "The guest Wi-Fi SSID is [AKASAWA_FREE_WiFi] and the password is [akasawaonsen100]. It is completely free to use.",
        zh: "客房免费Wi-Fi的SSID是【AKASAWA_FREE_WiFi】，密码是【akasawaonsen100】。您可以免费使用高速网络。",
        ko: "와이파이 SSID는 【AKASAWA_FREE_WiFi】 이고 비밀번호는 【akasawaonsen100】 입니다. 무료로 이용하실 수 있습니다."
      },
      onsen: {
        triggers: ['温泉', 'おんせん', 'ぬる湯', '露天風呂', '貸切', '檜', 'ひのき', 'bath', 'hot spring'],
        ja: "当館の温泉は自家源泉100%のかけ流しぬる湯でございます。内湯は40度前後、露天は38度前後で、長湯にぴったりでございます。総檜の貸切露天風呂は50分1,000円（要予約）でプライベート温泉をお楽しみいただけます。",
        en: "Our hot spring is 100% natural, non-recirculating lukewarm spring. The indoor bath is around 40°C, and the outdoor bath is around 38°C, which is perfect for a long, relaxing soak. The private Hinoki outdoor bath is also available for 1000 JPY per 50 minutes (reservation required).",
        zh: "我们这里的温泉是100%源泉自流的温汤温泉。室内温泉40℃左右，露天温泉38℃左右，非常适合长时间浸泡。此外，总桧木建造的私汤露天温泉50分钟仅需1,000日元（需提前预约）。",
        ko: "저희 온천은 자체 원천 100%의 미온천입니다. 실내탕은 약 40도, 노천탕은 약 38도로 천천히 오래 머물기에 최적입니다. 편백나무 대여 노천탕은 50분에 1,000엔(예약 필요)으로 이용할 수 있습니다."
      },
      dining: {
        triggers: ['料理', '夕食', '朝食', 'ご飯', 'ごはん', 'プラン', '食事', '中華', 'ヴィーガン', 'ジンギスカン', 'プラン', 'food', 'dinner', 'meal', 'vegan'],
        ja: "お夕食は和洋中を融合した『スタンダード創作コース』や、ウッドデッキ限定の『鹿×豚の赤沢風ジンギスカン鍋』、本格『創作中華』、そして木金日限定の『ヴィーガン特別料理』からお選びいただけます。朝食はお粥（中国粥）への無料変更もご好評をいただいております。",
        en: "For dinner, you can choose from the 'Standard Creative Course', the wood-deck exclusive 'Jingisukan (venison & pork)', authentic 'Creative Chinese', or the 'Vegan Course' (available on Thu, Fri, and Sun only). For breakfast, changing to Chinese Congee for free is also very popular.",
        zh: "晚餐您可以选择融合了中西日式的【标准创作套餐】、户外木台限定的【成吉思汗烤肉锅】、正宗的【创意中华】，或者限周四五日提供的【素食特别料理】。早餐还可以免费更换成中式热粥，非常受欢迎。",
        ko: "석식은 일중양 융합 『스탠다드 창작 코스』, 야외 테라스 전용 『사슴×돼지 징기스칸 냄비』, 정통 『창작 중식』, 목금일 한정 『비건 특별 요리』가 준비되어 있습니다. 조식을 중국식 죽으로 무료 변경하시는 것도 매우 인기입니다."
      },
      cat: {
        triggers: ['猫', 'ねこ', 'ネコ', 'ニャンコ', '看板猫', 'cat'],
        ja: "当館には4匹の看板猫たちが暮らしております。ロビーや廊下、客室の近くを気ままにお散歩しております。もし見かけられましたら、優しく見守っていただけますと幸いです。",
        en: "We have four resident cats living at our inn. They leisurely walk around the lobby, corridors, and near guest rooms. If you see them, please watch over them gently.",
        zh: "旅馆内一共生活着4只可爱的看板猫。它们经常在大厅、走廊或客房附近悠闲散步。如果您遇到它们，请温柔地关照它们。",
        ko: "여관에는 4마리의 마스코트 고양이들이 살고 있습니다. 로비나 복도, 객실 근처를 유유히 산책하곤 합니다. 발견하시면 다정하게 지켜봐 주시기 바랍니다."
      },
      checkout: {
        triggers: ['チェックアウト', '出る時間', '何時まで', 'checkout', 'check out'],
        ja: "チェックアウトは【午前10:00】でございます。朝ものんびりお湯に浸かってからご出発くださいませ。",
        en: "Check-out time is [10:00 AM]. Please take your time and enjoy a lukewarm bath in the morning before your departure.",
        zh: "退房时间是【上午 10:00】。早上也请舒舒服服地泡完温泉再悠闲地出发。",
        ko: "체크아웃 시간 is 【오전 10:00】 입니다. 아침에도 온천을 충분히 즐기신 후에 천천히 출발해 주십시오."
      },
      sightseeing: {
        triggers: ['観光', '散歩', '周辺', 'コンビニ', 'もみじ谷', '犬', 'レンタルドッグ', 'tour', 'sightseeing', 'walk', 'nearby'],
        ja: "周辺には綺麗な箒川（ほうきがわ）の散策路や、スリル満点の『もみじ谷大吊橋』がございます。また、宿の可愛いワンちゃんと一緒にお散歩できる『レンタルドッグ』や、当館オーナーによる『あかさわツアー』もおすすめでございます。コンビニ（セブンイレブン）は徒歩10分ほどの場所にございます。",
        en: "Nearby, there are beautiful walking paths along the Hoki River and the thrilling 'Momijidani Suspension Bridge'. We also recommend our 'Rental Dog Walk' with our cute dogs or the owner's 'Akasawa Tour'. A convenience store (7-Eleven) is a 10-minute walk away.",
        zh: "旅馆周边有美丽的帚川散步道，还有惊险刺激的【红叶谷大吊桥】。此外，和旅馆可爱的迎宾犬一起散步的【租借狗狗体验】、老板亲自带队的【赤泽导览之旅】也非常推荐。便利店（7-Eleven）步行大约10分钟。",
        ko: "주변에는 아름다운 호키강 산책로와 아찔한 『모미지다니 대현수교』가 있습니다. 여관 강아지와 함께 산책하는 『렌탈 독 체험』이나 주인장의 『아카사와 탐방 투어』도 추천합니다. 편의점(세븐일레븐)은 도보 10분 거리입니다."
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
      ja: "何かお困りのことはございますでしょうか？Wi-Fi情報、温泉の入り方、お食事、周辺の観光や、ご宿泊予約のことなど、何でもお気軽にお尋ねくださいませ。",
      en: "Is there anything I can help you with? Please feel free to ask about Wi-Fi, Hot Springs, Meals, Sightseeing, or Room Bookings.",
      zh: "请问有什么我可以帮您的？您可以随时询问关于Wi-Fi密码、温泉指南、特色晚餐、周边观光或者住宿预订等内容。",
      ko: "도움이 필요하신 부분이 있으신가요? 와이파이, 온천 이용법, 식사 메뉴, 주변 관광이나 숙박 예약 등 무엇이든 편하게 물어봐 주십시오."
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
