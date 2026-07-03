// Firebase SDK不要版 - すべてサーバーサイドAPI経由でデータ通信
const apiBase = '/api';
const defaults = {
  ownerName: '遠藤正俊',
  hotelName: '赤沢温泉旅館',
  officialSite: 'https://akasawaonsen.com/',
  phone: '0287-46-5700',
  brandCopy: '世界を植林してきた博士が、日本の『枯れ葉』に見た、失われた魂の救済'
};

// --- ① 投稿登録フォームの制御 ---
const form = document.getElementById('uploadForm');
const message = document.getElementById('formMessage');
const channelCbs = document.querySelectorAll('input[name="channelSelect"]');
const ownerComment = document.getElementById('ownerComment');
const simpleTag = document.getElementById('simpleTag');
const visibility = document.getElementById('visibility');
const ngMemo = document.getElementById('ngMemo');
const voiceFileInput = document.getElementById('voiceFile');

const setMessage = (text, isError = false) => {
  message.textContent = text;
  message.style.color = isError ? '#ef4444' : '#10b981';
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const selectedChannels = [...channelCbs].filter(cb => cb.checked).map(cb => cb.value);
  if (!selectedChannels.length) {
    setMessage('投稿先チャンネルを少なくとも1つ選択してください。', true);
    return;
  }

  try {
    // 音声ファイルがある場合はサーバー側で処理させるため、ここではスキップ
    // （voiceUrlはnullのままにし、サーバー側のCartesiaクローン音声自動生成に任せる）
    let uploadedVoiceUrl = null;

    setMessage('登録処理とAI下書き・動画の自動生成を開始しています…');
    
    const channelSettings = {};
    for (const channel of selectedChannels) {
      channelSettings[channel] = {
        assets: [],
        publishAt: null
      };
    }

    const payload = {
      ownerComment: ownerComment.value.trim(),
      shotDate: null,
      location: '',
      catName: '',
      simpleTag: simpleTag.value || null,
      visibility: visibility.value,
      ngMemo: ngMemo.value.trim(),
      channels: selectedChannels,
      channelSettings,
      assets: [],
      voiceUrl: uploadedVoiceUrl,
      brandSnapshot: {
        ownerName: defaults.ownerName,
        hotelName: defaults.hotelName,
        officialSite: defaults.officialSite,
        phone: defaults.phone,
        brandCopy: defaults.brandCopy
      }
    };

    const response = await fetch(`${apiBase}/submit-metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '登録に失敗しました');
    }

    setMessage(`✅ 登録完了！動画と下書きが自動生成されます。下の一覧で進捗を確認してください。`);
    form.reset();
    
    // 登録成功時に下部の一覧を即座にリフレッシュする
    await loadQueue();
  } catch (error) {
    console.error(error);
    setMessage(error.message || 'エラーが発生しました。', true);
  }
});


// --- ② 下部：投稿キュー ＆ 動画管理ダッシュボードの制御 ---
const queueEl = document.getElementById('queue');
const refreshBtn = document.getElementById('refreshBtn');
const statusFilter = document.getElementById('statusFilter');
const channelFilter = document.getElementById('channelFilter');

// モーダル要素
const previewModal = document.getElementById('previewModal');
const closeBtn = document.querySelector('.close-btn');
const reelVideo = document.getElementById('reelVideo');
const reelImage = document.getElementById('reelImage');
const reelTextOverlay = document.getElementById('reelTextOverlay');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const modalApproveBtn = document.getElementById('modalApproveBtn');
const modalPublishNowBtn = document.getElementById('modalPublishNowBtn');
const reelTimer = document.getElementById('reelTimer');
const narrationAudio = document.getElementById('narrationAudio');
const bgmAudio = document.getElementById('bgmAudio');

let currentPreviewId = null;
let previewTimerInterval = null;
let currentPreviewText = '';
let textAnimationTimeout = null;

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderAsset(asset) {
  const isVideo = asset.type && asset.type.startsWith('video/');
  if (isVideo) {
    return `<video class="asset-preview" src="${escapeHtml(asset.url)}" controls style="width: 100%; border-radius: 8px; border: 1px solid var(--line);"></video>`;
  }
  return `<img class="asset-preview" src="${escapeHtml(asset.url)}" style="width: 100%; border-radius: 8px; border: 1px solid var(--line);" />`;
}

function renderRisk(risk) {
  if (!risk) return '<span style="color: #6b7280;">未判定</span>';
  const color = risk.requiresReview ? '#ef4444' : '#10b981';
  const label = risk.requiresReview ? '⚠️ 要レビュー' : '🟢 低リスク';
  return `<span style="color: ${color}; font-weight: bold;">${label} (${escapeHtml(risk.reason || '安全')})</span>`;
}

function renderChannelSettings(row) {
  const channels = row.channels || [];
  const settings = row.channelSettings || {};
  const statuses = row.channelStatuses || {};
  
  return channels.map(channel => {
    const setting = settings[channel] || {};
    const status = statuses[channel] || row.status || 'draft';
    const assets = setting.assets || [];
    const draftText = row.drafts?.[channel]?.text || '下書きなし';
    const narrationText = row.drafts?.[channel]?.narration || '';

    let dateVal = '';
    if (setting.publishAt) {
      try {
        const d = new Date(setting.publishAt);
        const tzoffset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
        dateVal = localISOTime;
      } catch (e) {}
    }

    const isPublished = status === 'published';

    let extraButtonsHtml = '';
    if (channel === 'instagram' && narrationText) {
      const hasVoice = !!row.voiceUrl;
      extraButtonsHtml = `
        <div style="margin-top: 10px; display: flex; gap: 8px; align-items: center;">
          <button class="voice-btn ${hasVoice ? 'has-voice' : ''}" 
                  data-id="${row.id}" 
                  data-text="${escapeHtml(narrationText)}"
                  ${isPublished ? 'disabled' : ''}>
            ${hasVoice ? '🎙️ AI音声再生成' : '🎙️ Gemini AI音声生成'}
          </button>
          ${hasVoice ? `
            <button class="preview-btn" 
                    data-id="${row.id}" 
                    data-text="${escapeHtml(narrationText)}"
                    data-voice="${escapeHtml(row.voiceUrl)}"
                    data-media="${escapeHtml(assets[0]?.url || '')}"
                    data-media-type="${escapeHtml(assets[0]?.type || '')}"
                    data-video="${escapeHtml(row.videoUrl || '')}">
              🎬 動画プレビュー ${row.videoUrl ? '⚡' : ''}
            </button>
          ` : ''}
        </div>
        ${hasVoice ? `
          <div style="margin-top: 6px;">
            <audio src="${escapeHtml(row.voiceUrl)}" controls style="width: 100%; height: 32px;"></audio>
          </div>
        ` : ''}
      `;
    }

    return `
      <div class="channel-card-setting" style="margin-top: 14px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: #fafaf9;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin-bottom: 8px;">
          <strong style="color: var(--brand); font-size: 15px;">${escapeHtml(channel.toUpperCase())}</strong>
          <span class="status ${escapeHtml(status)}" style="font-size: 13px;">${escapeHtml(status)}</span>
        </div>
        
        <div style="margin: 8px 0; padding: 10px; background: #f3f4f6; border-radius: 8px;">
          <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px; color: #374151;">公開予定日時 (日程設定):</label>
          <input type="datetime-local" class="publish-date-input" data-id="${row.id}" data-channel="${channel}" value="${dateVal}" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px;" ${isPublished ? 'disabled' : ''} />
        </div>

        <div style="margin: 8px 0; display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="good ch-approve-btn" data-id="${row.id}" data-channel="${channel}" style="padding: 6px 12px; font-size: 12px;" ${isPublished ? 'disabled' : ''}>
            このチャンネルを承認・日程保存
          </button>
          <button class="good ch-publish-btn" data-id="${row.id}" data-channel="${channel}" style="padding: 6px 12px; font-size: 12px; background-color: #0284c7; border-color: #0284c7;" ${isPublished ? 'disabled' : ''}>
            📲 今すぐ投稿
          </button>
          <button class="danger ch-reject-btn" data-id="${row.id}" data-channel="${channel}" style="padding: 6px 12px; font-size: 12px;" ${isPublished ? 'disabled' : ''}>
            却下
          </button>
        </div>

        <div class="asset-grid" style="margin: 8px 0;">
          ${assets.map(renderAsset).join('')}
        </div>
        <p style="margin: 4px 0; font-size: 13px;"><strong>下書きドラフト:</strong></p>
        <pre style="margin: 4px 0 0; font-size: 12px; padding: 10px; max-height: 150px; overflow-y: auto;">${escapeHtml(draftText)}</pre>
        ${narrationText ? `
          <p style="margin: 8px 0 4px; font-size: 13px;"><strong>ナレーション原稿:</strong></p>
          <pre style="margin: 4px 0 0; font-size: 12px; padding: 10px; background: #f0fdf4; border-color: #bbf7d0;">${escapeHtml(narrationText)}</pre>
        ` : ''}
        ${extraButtonsHtml}
      </div>
    `;
  }).join('');
}

async function loadQueue() {
  queueEl.innerHTML = '<div class="card">データを読み込み中…</div>';
  try {
    // サーバーサイドAPI経由でFirestoreからデータを取得（Firebase SDK不要）
    const response = await fetch(`${apiBase}/list-submissions`);
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'データ取得に失敗しました');
    }
    const { submissions: rows } = await response.json();

    const filtered = rows.filter(row => {
      const matchStatus = statusFilter.value === 'all' || row.status === statusFilter.value;
      const matchChannel = channelFilter.value === 'all' || (row.channels || []).includes(channelFilter.value);
      return matchStatus && matchChannel;
    });

    if (!filtered.length) {
      queueEl.innerHTML = '<div class="card">該当するドラフト・動画データはありません。</div>';
      return;
    }

    queueEl.innerHTML = filtered.map(row => {
      return `
        <article class="submission" id="submission-${row.id}">
          <div class="submission-header">
            <div>
              <strong>ID: ${escapeHtml(row.id)}</strong>
              <div class="small">${(row.channels || []).join(', ')}</div>
            </div>
            <div class="status ${escapeHtml(row.status || 'draft')}">${escapeHtml(row.status || 'draft')}</div>
          </div>
          <div class="submission-body">
            <p><strong>台本テキスト:</strong> ${escapeHtml(row.ownerComment || 'なし')}</p>
            <p><strong>自動カテゴリ:</strong> ${escapeHtml(row.classification?.primary || '未分類')} / ${escapeHtml((row.classification?.secondary || []).join(', '))}</p>
            <p><strong>リスク判定:</strong> ${renderRisk(row.risk)}</p>
            
            ${row.videoUrl ? `
              <div class="completed-video-container" style="margin: 14px 0; padding: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
                <strong style="color: #166534; font-size: 14px; display: block; margin-bottom: 8px;">🟢 自動生成された完成動画 (MP4):</strong>
                <video src="${escapeHtml(row.videoUrl)}" controls style="width: 100%; max-width: 360px; height: auto; border-radius: 8px; border: 1px solid #dcfce7; background: #000;"></video>
                <div style="margin-top: 10px;">
                  <a href="${escapeHtml(row.videoUrl)}" target="_blank" download="${row.id}.mp4" style="display: inline-block; background: #16a34a; color: white; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: bold; text-align: center; border: 1px solid #16a34a;">📥 動画ファイルをダウンロード</a>
                </div>
              </div>
            ` : `
              <div style="margin: 14px 0; padding: 10px; background: #fafaf9; border: 1px dashed var(--line); border-radius: 8px; font-size: 13px; color: #6b7280;">
                ⏳ 動画は現在バックグラウンドで自動生成（レンダリング）中です。数分後に🔄ボタンで更新してください。
              </div>
            `}

            <div style="margin-top: 16px;">
              <h4 style="margin: 0 0 8px; font-size: 15px; color: var(--brand);">チャンネル別配信設定</h4>
              ${renderChannelSettings(row)}
            </div>
          </div>
        </article>
      `;
    }).join('');

    attachEvents();
  } catch (error) {
    console.error(error);
    queueEl.innerHTML = `<div class="card" style="color: #ef4444;">データの読み込みに失敗しました: ${escapeHtml(error.message)}</div>`;
  }
}

function attachEvents() {
  // AI音声再生成
  [...queueEl.querySelectorAll('.voice-btn')].forEach(button => {
    button.addEventListener('click', async () => {
      const { id, text } = button.dataset;
      try {
        button.disabled = true;
        button.textContent = '音声再生成中...';
        const response = await fetch(`${apiBase}/generate-voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, text })
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '再生成に失敗しました');
        }
        alert('音声が新しく合成されました。');
        await loadQueue();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = '🎙️ AI音声再生成';
      }
    });
  });

  // 動画プレビュー
  [...queueEl.querySelectorAll('.preview-btn')].forEach(button => {
    button.addEventListener('click', () => {
      const d = button.dataset;
      openPreview(d.id, d.text, d.voice, d.media, d.mediaType, d.video);
    });
  });

  // チャンネル別承認・日程保存
  [...queueEl.querySelectorAll('.ch-approve-btn')].forEach(button => {
    button.addEventListener('click', async () => {
      const { id, channel } = button.dataset;
      const input = queueEl.querySelector(`.publish-date-input[data-id="${id}"][data-channel="${channel}"]`);
      const publishAtVal = input?.value ? new Date(input.value).toISOString() : null;
      
      try {
        button.disabled = true;
        button.textContent = '保存中...';
        const response = await fetch(`${apiBase}/approve-post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'approve', channel, publishAt: publishAtVal })
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '承認・日程保存に失敗しました');
        }
        alert(`${channel.toUpperCase()}を承認し、公開日程を保存しました。`);
        await loadQueue();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = 'このチャンネルを承認・日程保存';
      }
    });
  });

  // チャンネル別即時投稿
  [...queueEl.querySelectorAll('.ch-publish-btn')].forEach(button => {
    button.addEventListener('click', async () => {
      const { id, channel } = button.dataset;
      if (!confirm(`${channel.toUpperCase()}へ今すぐ直接投稿します。よろしいですか？`)) return;
      
      try {
        button.disabled = true;
        button.textContent = '投稿中...';
        const response = await fetch(`${apiBase}/approve-post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'publish_now', channel })
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '即時投稿に失敗しました');
        }
        alert(`${channel.toUpperCase()}へ直接投稿を完了しました！`);
        await loadQueue();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = '📲 今すぐ投稿';
      }
    });
  });

  // チャンネル別却下
  [...queueEl.querySelectorAll('.ch-reject-btn')].forEach(button => {
    button.addEventListener('click', async () => {
      const { id, channel } = button.dataset;
      try {
        button.disabled = true;
        button.textContent = '却下中...';
        const response = await fetch(`${apiBase}/approve-post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, action: 'reject', channel })
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '却下処理に失敗しました');
        }
        alert(`${channel.toUpperCase()}の下書きを却下しました。`);
        await loadQueue();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = '却下';
      }
    });
  });
}

// --- ③ ビデオプレビューモーダル制御 ---
function openPreview(submissionId, text, voiceUrl, mediaUrl, mediaType, videoUrl) {
  currentPreviewId = submissionId;
  currentPreviewText = text;
  
  reelVideo.muted = false;
  reelVideo.style.display = 'none';
  const mockScreen = document.getElementById('reelMockScreen');
  mockScreen.style.display = 'block';
  
  if (videoUrl) {
    reelVideo.src = videoUrl;
    reelVideo.style.display = 'block';
    mockScreen.style.display = 'none';
  } else {
    reelImage.src = mediaUrl || '';
    narrationAudio.src = voiceUrl || '';
    bgmAudio.src = '';
    bgmAudio.volume = 0.15;
  }
  
  previewModal.style.display = 'flex';
  startPreview(!!videoUrl);
}

function closePreviewModal() {
  stopPreview();
  previewModal.style.display = 'none';
  reelVideo.src = '';
  narrationAudio.src = '';
  bgmAudio.src = '';
  currentPreviewId = null;
}

function startPreview(isRealVideo = false) {
  playBtn.disabled = true;
  pauseBtn.disabled = false;
  
  if (isRealVideo) {
    reelVideo.play().catch(e => console.error(e));
    previewTimerInterval = setInterval(() => {
      const cur = reelVideo.currentTime.toFixed(1);
      const dur = reelVideo.duration ? reelVideo.duration.toFixed(1) : '30.0';
      reelTimer.textContent = `${cur}s / ${dur}s`;
    }, 100);
    return;
  }
  
  narrationAudio.play().catch(e => console.error(e));
  bgmAudio.play().catch(e => console.error(e));
  
  const startTime = Date.now();
  const duration = 30000;
  
  previewTimerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const seconds = (elapsed / 1000).toFixed(1);
    reelTimer.textContent = `${seconds}s / 30.0s`;
    
    if (elapsed >= duration) {
      stopPreview();
    }
  }, 100);
  
  let index = 0;
  const chars = currentPreviewText.split('');
  reelTextOverlay.textContent = '';
  
  function showNextChar() {
    if (index < chars.length) {
      reelTextOverlay.textContent += chars[index];
      index++;
      textAnimationTimeout = setTimeout(showNextChar, 100);
    }
  }
  showNextChar();
}

function stopPreview() {
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  
  clearInterval(previewTimerInterval);
  clearTimeout(textAnimationTimeout);
  
  reelVideo.pause();
  narrationAudio.pause();
  bgmAudio.pause();
}

// プレビューコントローラバインド
playBtn.addEventListener('click', () => startPreview(reelVideo.style.display === 'block'));
pauseBtn.addEventListener('click', stopPreview);
closeBtn.addEventListener('click', closePreviewModal);
window.addEventListener('click', (e) => {
  if (e.target === previewModal) closePreviewModal();
});

modalApproveBtn.addEventListener('click', async () => {
  if (!currentPreviewId) return;
  try {
    modalApproveBtn.disabled = true;
    modalApproveBtn.textContent = '承認中...';
    
    const response = await fetch(`${apiBase}/approve-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentPreviewId, action: 'approve', channel: 'instagram' })
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '動画承認失敗');
    }
    
    alert('動画(Instagram)を承認しました。');
    closePreviewModal();
    await loadQueue();
  } catch (error) {
    alert(error.message);
  } finally {
    modalApproveBtn.disabled = false;
    modalApproveBtn.textContent = 'この動画を承認';
  }
});

modalPublishNowBtn.addEventListener('click', async () => {
  if (!currentPreviewId) return;
  try {
    modalPublishNowBtn.disabled = true;
    modalPublishNowBtn.textContent = '投稿中...';
    
    const response = await fetch(`${apiBase}/approve-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentPreviewId, action: 'publish_now', channel: 'instagram' })
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '動画投稿失敗');
    }
    
    alert('動画(Instagram)を即時投稿しました！');
    closePreviewModal();
    await loadQueue();
  } catch (error) {
    alert(error.message);
  } finally {
    modalPublishNowBtn.disabled = false;
    modalPublishNowBtn.textContent = '📲 今すぐ投稿';
  }
});

refreshBtn.addEventListener('click', loadQueue);
statusFilter.addEventListener('change', loadQueue);
channelFilter.addEventListener('change', loadQueue);

// 初期起動時のデータ読み込み
loadQueue();
