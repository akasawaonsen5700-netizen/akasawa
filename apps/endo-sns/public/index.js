import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';
import { storage } from './firebase-init.js';

// Firebase SDK不要版 - すべてサーバーサイドAPI経由でデータ通信
function getApiUrl(endpoint) {
  const isEndoSns = window.location.pathname.includes('endo-sns') || window.location.pathname.includes('endo');
  return isEndoSns ? `/api/endo-${endpoint}` : `/api/${endpoint}`;
}

// スピナーアニメーション用スタイルの追加
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .video-status-container.initializing { background: #f3f4f6; border: 1px solid #e5e7eb; }
  .video-status-container.generating_audio { background: #f0f9ff; border: 1px solid #bae6fd; }
  .video-status-container.rendering_video { background: #fffbeb; border: 1px solid #fef3c7; }
  .video-status-container.failed { background: #fef2f2; border: 1px solid #fecaca; }
`;
document.head.appendChild(style);
const defaults = {
  ownerName: '遠藤正俊',
  hotelName: '赤沢温泉旅館',
  officialSite: 'https://akasawaonsen.com/',
  phone: '0287-46-5700',
  brandCopy: '世界を植林してきた博士が、日本の『枯れ葉』に見た、失われた魂の救済'
};
// --- ① 投稿登録フォーム of 制御 ---
const form = document.getElementById('uploadForm');
const message = document.getElementById('formMessage');
const channelCbs = document.querySelectorAll('input[name="channelSelect"]');
const ownerComment = document.getElementById('ownerComment');
const simpleTag = document.getElementById('simpleTag');
const visibility = document.getElementById('visibility');
const ngMemo = document.getElementById('ngMemo');
const mediaFilesInput = document.getElementById('mediaFiles');
const voiceFileInput = document.getElementById('voiceFile');

const setMessage = (text, isError = false) => {
  message.textContent = text;
  message.style.color = isError ? '#ef4444' : '#10b981';
};

// ファイルアップロードヘルパー
async function uploadFiles(files, channel) {
  const results = [];
  for (const file of files) {
    const path = `submissions/${channel}/${Date.now()}-${crypto.randomUUID()}-${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file, { contentType: file.type });
    const url = await getDownloadURL(fileRef);
    results.push({
      name: file.name,
      type: file.type,
      size: file.size,
      storagePath: path,
      url
    });
  }
  return results;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  const selectedChannels = [...channelCbs].filter(cb => cb.checked).map(cb => cb.value);
  if (!selectedChannels.length) {
    setMessage('投稿先チャンネルを少なくとも1つ選択してください。', true);
    return;
  }

  let pollInterval = null;
  let pollCount = 0;

  try {
    let assets = [];
    const mediaFiles = mediaFilesInput ? [...mediaFilesInput.files] : [];
    if (mediaFiles.length > 0) {
      setMessage('Firebase Storage へ背景アセットをアップロード中…');
      assets = await uploadFiles(mediaFiles, 'common');
    }

    let voiceUrl = null;
    const voiceFiles = voiceFileInput ? [...voiceFileInput.files] : [];
    if (voiceFiles.length > 0) {
      setMessage('Firebase Storage へ音声アセットをアップロード中…');
      const uploadedVoice = await uploadFiles(voiceFiles, 'voices');
      if (uploadedVoice.length > 0) {
        voiceUrl = uploadedVoice[0].url;
      }
    }

    setMessage('登録処理を開始しています…');
    
    const channelSettings = {};
    for (const channel of selectedChannels) {
      channelSettings[channel] = {
        assets: assets,
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
      assets: assets,
      voiceUrl: voiceUrl,
      brandSnapshot: {
        ownerName: defaults.ownerName,
        hotelName: defaults.hotelName,
        officialSite: defaults.officialSite,
        phone: defaults.phone,
        brandCopy: defaults.brandCopy
      }
    };

    const response = await fetch(getApiUrl('submit-metadata'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '登録に失敗しました');
    }

    const submissionId = data.id;
    setMessage('⏳ データベースにメタデータを登録しました。動画の自動生成を開始します…');
    form.reset();
    await loadQueue();

    // UI進捗ポーリングの開始 (2秒間隔)
    pollInterval = setInterval(async () => {
      pollCount++;
      try {
        const res = await fetch(getApiUrl('list-submissions'));
        if (!res.ok) return;
        const listData = await res.json();
        const target = listData.submissions?.find(s => s.id === submissionId);
        
        if (target && target.videoStatus) {
          let statusText = '自動生成の初期化中...';
          let isDone = false;
          
          if (target.videoStatus === 'generating_audio') {
            statusText = '🎙️ 遠藤正俊のクローン音声を合成中...';
          } else if (target.videoStatus === 'rendering_video') {
            statusText = '🎬 プレミアム縦型動画（Remotion）を書き出し中...';
          } else if (target.videoStatus === 'completed') {
            statusText = '✅ 動画と下書きの自動生成がすべて完了しました！';
            isDone = true;
          } else if (target.videoStatus === 'failed') {
            statusText = `❌ 動画生成に失敗しました: ${target.videoError || '不明なエラー'}`;
            isDone = true;
          }
          
          setMessage(`${statusText} (${pollCount * 2}秒経過...)`, target.videoStatus === 'failed');
          
          if (isDone) {
            clearInterval(pollInterval);
            await loadQueue(); // 完了または失敗時に最新情報でリストを再描画
          }
        }
      } catch (e) {
        console.error('Progress polling error:', e);
      }
    }, 2000);

  } catch (error) {
    if (pollInterval) clearInterval(pollInterval);
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
let currentPreviewMedias = []; // 背景アセット配列用
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
                    data-medias="${escapeHtml(assets.map(a => a.url).filter(Boolean).join(','))}"
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
    const response = await fetch(getApiUrl('list-submissions'));
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'データ取得に失敗しました');
    }
    const data = await response.json();
    const rows = data.submissions || [];

    if (data.cartesiaVoices && data.cartesiaVoices.length > 0) {
      console.log('====== CARTESIA VOICES (DEBUGINFO) ======');
      data.cartesiaVoices.forEach(v => {
        console.log(`[Name]: ${v.name} -> [ID/UUID]: ${v.id}`);
      });
      console.log('==========================================');
    }

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
            <div style="display: flex; align-items: center; gap: 10px;">
              <button class="delete-btn" data-id="${row.id}" style="padding: 4px 10px; background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">🗑️ 削除</button>
              <div class="status ${escapeHtml(row.status || 'draft')}">${escapeHtml(row.status || 'draft')}</div>
            </div>
          </div>
          <div class="submission-body">
            <p><strong>台本テキスト:</strong> ${escapeHtml(row.ownerComment || 'なし')}</p>
            <p><strong>自動カテゴリ:</strong> ${escapeHtml(row.classification?.primary || '未分類')} / ${escapeHtml((row.classification?.secondary || []).join(', '))}</p>
            <p><strong>リスク判定:</strong> ${renderRisk(row.risk)}</p>
            ${row.assets && row.assets.length > 0 ? `
              <div style="margin: 10px 0; padding: 10px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
                <strong style="font-size: 13px; color: #4b5563;">📷 登録された背景画像・動画:</strong>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
                  ${row.assets.map(renderAsset).join('')}
                </div>
              </div>
            ` : ''}
            
            ${row.videoUrl ? `
              <div class="completed-video-container" style="margin: 14px 0; padding: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
                <strong style="color: #166534; font-size: 14px; display: block; margin-bottom: 8px;">🟢 自動生成された完成動画 (MP4):</strong>
                <video src="${escapeHtml(row.videoUrl)}" controls style="width: 100%; max-width: 360px; height: auto; border-radius: 8px; border: 1px solid #dcfce7; background: #000;"></video>
                <div style="margin-top: 10px;">
                  <a href="${escapeHtml(row.videoUrl)}" target="_blank" download="${row.id}.mp4" style="display: inline-block; background: #16a34a; color: white; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: bold; text-align: center; border: 1px solid #16a34a;">📥 動画ファイルをダウンロード</a>
                </div>
              </div>
            ` : `
              <div class="video-status-container ${escapeHtml(row.videoStatus || 'initializing')}" style="margin: 14px 0; padding: 14px; border-radius: 12px; font-size: 13px;">
                ${(() => {
                  const status = row.videoStatus || 'initializing';
                  if (status === 'generating_audio') {
                    return `
                      <div style="color: #0284c7; display: flex; align-items: center; gap: 8px; font-weight: bold;">
                        <span class="spinner" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #0284c7; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
                        🎙️ 遠藤正俊のクローン音声を合成中...
                      </div>
                      <p style="margin: 6px 0 0; color: #6b7280; font-size: 12px;">AIが台本テキストからナレーション音声を生成しています。少々お待ちください。</p>
                    `;
                  } else if (status === 'rendering_video') {
                    return `
                      <div style="color: #d97706; display: flex; align-items: center; gap: 8px; font-weight: bold;">
                        <span class="spinner" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #d97706; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
                        🎬 プレミアム縦型動画（Remotion）を書き出し中...
                      </div>
                      <p style="margin: 6px 0 0; color: #6b7280; font-size: 12px;">映像アセットと合成音声を組み合わせて、縦型動画ファイルをエンコードしています。</p>
                    `;
                  } else if (status === 'failed') {
                    return `
                      <div style="color: #dc2626; font-weight: bold;">
                        ❌ 動画自動生成に失敗しました
                      </div>
                      <p style="margin: 6px 0 0; color: #7f1d1d; font-size: 12px; background: #fee2e2; padding: 8px; border-radius: 6px; border: 1px solid #fecaca;">
                        エラー内容: ${escapeHtml(row.videoError || '不明な内部エラーが発生しました。')}
                      </p>
                    `;
                  } else {
                    return `
                      <div style="color: #6b7280; display: flex; align-items: center; gap: 8px;">
                        <span class="spinner" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #6b7280; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
                        ⏳ 動画自動生成タスクを初期化中...
                      </div>
                    `;
                  }
                })()}
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
        const response = await fetch(getApiUrl('generate-voice'), {
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
      openPreview(d.id, d.text, d.voice, d.medias, d.mediaType, d.video);
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
        const response = await fetch(getApiUrl('approve-post'), {
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
        const response = await fetch(getApiUrl('approve-post'), {
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
        const response = await fetch(getApiUrl('approve-post'), {
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

  // 投稿データの削除
  [...queueEl.querySelectorAll('.delete-btn')].forEach(button => {
    button.addEventListener('click', async () => {
      const { id } = button.dataset;
      if (!confirm('この投稿ドラフトデータを完全に削除します。よろしいですか？\n※動画や音声データ、承認履歴を含むすべての情報が削除されます。')) return;
      
      try {
        button.disabled = true;
        button.textContent = '削除中...';
        const response = await fetch(getApiUrl('delete-submission'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '削除処理に失敗しました');
        }
        alert('データを完全に削除しました。');
        await loadQueue();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = '🗑️ 削除';
      }
    });
  });
}

// --- ③ ビデオプレビューモーダル制御 ---
function openPreview(submissionId, text, voiceUrl, mediaUrlsStr, mediaType, videoUrl) {
  currentPreviewId = submissionId;
  currentPreviewText = text;
  currentPreviewMedias = mediaUrlsStr ? mediaUrlsStr.split(',').map(u => u.trim()).filter(Boolean) : [];
  
  reelVideo.muted = false;
  reelVideo.style.display = 'none';
  const mockScreen = document.getElementById('reelMockScreen');
  mockScreen.style.display = 'block';
  
  if (videoUrl) {
    isPlayingRealVideo = true;
    reelVideo.src = videoUrl;
    reelVideo.style.display = 'block';
    mockScreen.style.display = 'none';
    
    narrationAudio.removeAttribute('src');
    reelTextOverlay.innerHTML = '<div class="vertical-reel-text" style="font-size: 24px; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.5); padding: 10px; border-radius: 8px;">自動レンダリング動画再生中</div>';
  } else {
    isPlayingRealVideo = false;
    
    // 最初の背景アセットを設定
    const defaultBgs = ['/bg-premium.png', '/bg-premium2.png', '/bg-premium3.png'];
    const initialBg = currentPreviewMedias[0] || defaultBgs[0];
    const isVideoBg = initialBg.endsWith('.mp4') || initialBg.includes('video') || initialBg.includes('preview');

    if (isVideoBg) {
      reelVideo.src = initialBg;
      reelVideo.style.display = 'block';
      mockScreen.style.display = 'none';
    } else {
      reelImage.src = initialBg;
      mockScreen.style.display = 'block';
      reelVideo.style.display = 'none';
    }

    narrationAudio.src = voiceUrl || '';
    bgmAudio.src = 'https://assets.mixkit.co/active_storage/sfx/2433/2433-84.wav';
    bgmAudio.volume = 0.08;
    reelTextOverlay.innerHTML = '';
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
      
      if (reelVideo.ended) {
        stopPreview();
      }
    }, 100);
    return;
  }
  
  narrationAudio.play().catch(e => console.error(e));
  bgmAudio.play().catch(e => console.error(e));
  
  if (reelVideo.style.display === 'block') {
    reelVideo.play().catch(e => console.warn(e));
  }

  // メタ指示語（ラベル）を削除
  const cleanedText = currentPreviewText
    .replace(/(冒頭フック|フック|台本|締めの一言|締め|ナレーション|タイトル)[:：\s]*/gi, '')
    .trim();

  // テロップ同期ロジック
  const rawLines = cleanedText.split(/[。\n\?？！!]/).map(l => l.trim()).filter(Boolean);

  // 1文が長すぎる場合、読点「、」でさらに細かく分割して、テロップが２〜３行に綺麗に収まるようにする
  const lines = [];
  for (const line of rawLines) {
    if (line.length <= 25) {
      lines.push(line);
    } else {
      const subParts = line.split(/[、,]/).map(p => p.trim()).filter(Boolean);
      let currentPart = '';
      for (const part of subParts) {
        if ((currentPart + part).length <= 25) {
          currentPart += (currentPart ? '、' : '') + part;
        } else {
          if (currentPart) lines.push(currentPart + '、');
          currentPart = part;
        }
      }
      if (currentPart) lines.push(currentPart);
    }
  }

  reelTextOverlay.innerHTML = '';
  
  previewTimerInterval = setInterval(() => {
    const cur = narrationAudio.currentTime;
    const dur = narrationAudio.duration || 30;
    reelTimer.textContent = `${cur.toFixed(1)}s / ${dur.toFixed(1)}s`;
    
    if (narrationAudio.ended) {
      stopPreview();
    }
  }, 100);

  // 1行ずつのテロップ表示タイマー
  const showLines = () => {
    const dur = narrationAudio.duration || 12; // ナレーション再生時間
    const timePerLine = (dur / lines.length) * 1000; // 1行あたりのミリ秒数

    lines.forEach((line, index) => {
      textAnimationTimeout = setTimeout(() => {
        // 同期して背景画像を切り替える
        const defaultBgs = ['/bg-premium.png', '/bg-premium2.png', '/bg-premium3.png'];
        const bgs = currentPreviewMedias.length > 0 ? currentPreviewMedias : defaultBgs;
        const bgIndex = index % bgs.length;
        const currentBg = bgs[bgIndex];

        const mockScreen = document.getElementById('reelMockScreen');
        const isVideoBg = currentBg.endsWith('.mp4') || currentBg.includes('video') || currentBg.includes('preview');
        if (isVideoBg) {
          reelVideo.src = currentBg;
          reelVideo.style.display = 'block';
          mockScreen.style.display = 'none';
          reelVideo.play().catch(e => console.warn(e));
        } else {
          reelImage.src = currentBg;
          mockScreen.style.display = 'block';
          reelVideo.style.display = 'none';
        }

        // 前のテキストをクリアして新テキストを追加（フェード効果付き）
        reelTextOverlay.innerHTML = `<div class="vertical-reel-text">${escapeHtml(line)}</div>`;
        const activeText = reelTextOverlay.querySelector('.vertical-reel-text');
        
        // 文字を一文字ずつバラしてディレイ表示する演出
        const text = activeText.textContent;
        activeText.innerHTML = '';
        text.split('').forEach((char, charIdx) => {
          const span = document.createElement('span');
          span.textContent = char;
          span.style.opacity = '0';
          span.style.transform = 'translateY(10px)';
          span.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          span.style.display = 'inline-block';
          activeText.appendChild(span);
          
          setTimeout(() => {
            span.style.opacity = '1';
            span.style.transform = 'translateY(0)';
          }, charIdx * 80);
        });
      }, index * timePerLine);
    });
  };

  if (narrationAudio.readyState >= 1) {
    showLines();
  } else {
    narrationAudio.addEventListener('loadedmetadata', showLines, { once: true });
  }
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
    
    const response = await fetch(getApiUrl('approve-post'), {
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
    
    const response = await fetch(getApiUrl('approve-post'), {
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
