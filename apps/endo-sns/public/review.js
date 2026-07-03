import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { db, apiBase } from './firebase-init.js';

const queueEl = document.getElementById('queue');
const statusFilter = document.getElementById('statusFilter');
const channelFilter = document.getElementById('channelFilter');
const refreshBtn = document.getElementById('refreshBtn');

// プレビューモーダル関連要素
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
let isPlayingRealVideo = false;

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderAsset(asset) {
  if ((asset.type || '').startsWith('video/')) {
    return `<video controls src="${asset.url}"></video>`;
  }
  return `<img src="${asset.url}" alt="uploaded asset" />`;
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

    // 日程値のパース（ローカル時間用のYYYY-MM-DDTHH:mm形式へ変換）
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

function renderRisk(risk = {}) {
  const flags = risk.flags || [];
  if (!flags.length) return '<span class="pill">自動承認候補</span>';
  return flags.map(flag => `<span class="pill">${escapeHtml(flag)}</span>`).join('');
}

async function updateStatus(id, action) {
  const publishAt = prompt('公開日時を変更する場合は YYYY-MM-DDTHH:mm 形式で入力。変更しない場合は空欄。', '');
  const response = await fetch(`${apiBase}/approve-post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action, publishAt: publishAt || null })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || '更新失敗');
  }
  return data;
}

// プレビュー表示ロジック
function openPreview(submissionId, text, voiceUrl, mediaUrl, mediaType, videoUrl) {
  currentPreviewId = submissionId;
  currentPreviewText = text;
  
  // 初期化としてビデオをミュートにしておく
  reelVideo.muted = true;

  if (videoUrl) {
    isPlayingRealVideo = true;
    reelVideo.src = videoUrl;
    reelVideo.style.display = 'block';
    reelImage.style.display = 'none';
    
    narrationAudio.removeAttribute('src');
    reelTextOverlay.innerHTML = '<div class="vertical-reel-text" style="font-size: 24px; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.5); padding: 10px; border-radius: 8px;">自動レンダリング動画再生中</div>';
  } else {
    isPlayingRealVideo = false;
    // メディアの設定
    if (mediaType.startsWith('video/')) {
      reelVideo.src = mediaUrl;
      reelVideo.style.display = 'block';
      reelImage.style.display = 'none';
    } else {
      reelImage.src = mediaUrl || 'https://assets.mixkit.co/posts/music/preview/mixkit-forest-river-in-morning-1335-large.mp4';
      reelImage.style.display = 'block';
      reelVideo.style.display = 'none';
    }

    // オーディオの設定
    narrationAudio.src = voiceUrl;
    reelTextOverlay.innerHTML = '';
  }
  
  // モーダル表示
  previewModal.style.display = 'flex';
  
  // 再生ボタンの初期化
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  reelTimer.textContent = '0.0s / 0.0s';
}

function closePreviewModal() {
  stopPreview();
  previewModal.style.display = 'none';
}

function startPreview() {
  playBtn.disabled = true;
  pauseBtn.disabled = false;

  if (isPlayingRealVideo) {
    reelVideo.muted = false; // 音声を有効化
    reelVideo.volume = 1.0;
    reelVideo.play().catch(e => console.warn(e));
    
    // タイマー更新
    previewTimerInterval = setInterval(() => {
      const cur = reelVideo.currentTime;
      const dur = reelVideo.duration || 60;
      reelTimer.textContent = `${cur.toFixed(1)}s / ${dur.toFixed(1)}s`;
      
      if (reelVideo.ended) {
        stopPreview();
      }
    }, 100);
    return;
  }

  // BGMとナレーションを同時再生
  bgmAudio.volume = 0.08;
  bgmAudio.play().catch(e => console.warn(e));
  
  narrationAudio.volume = 1.0;
  narrationAudio.play().catch(e => console.warn(e));
  
  if (reelVideo.style.display === 'block') {
    reelVideo.play().catch(e => console.warn(e));
  }

  // テロップ同期ロジック
  const lines = currentPreviewText.split(/[。\n\?？！!]/).map(l => l.trim()).filter(Boolean);
  reelTextOverlay.innerHTML = '';
  
  // タイマー更新
  previewTimerInterval = setInterval(() => {
    const cur = narrationAudio.currentTime;
    const dur = narrationAudio.duration || 60;
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
  
  if (isPlayingRealVideo) {
    reelVideo.pause();
    reelVideo.muted = true;
    return;
  }

  narrationAudio.pause();
  bgmAudio.pause();
  reelVideo.pause();
  
  reelTextOverlay.innerHTML = '';
}

async function loadQueue() {
  queueEl.innerHTML = '<div class="card">読み込み中…</div>';
  const snapshot = await getDocs(query(collection(db, 'submissions'), orderBy('createdAt', 'desc'), limit(50)));
  const rows = [];
  snapshot.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));

  const filtered = rows.filter(row => {
    const matchStatus = statusFilter.value === 'all' || row.status === statusFilter.value;
    const matchChannel = channelFilter.value === 'all' || (row.channels || []).includes(channelFilter.value);
    return matchStatus && matchChannel;
  });

  if (!filtered.length) {
    queueEl.innerHTML = '<div class="card">該当データがありません。</div>';
    return;
  }

  queueEl.innerHTML = filtered.map(row => {
    return `
      <article class="submission">
        <div class="submission-header">
          <div>
            <strong>ID: ${escapeHtml(row.id)}</strong>
            <div class="small">${escapeHtml(row.location || '場所未入力')} / ${(row.channels || []).join(', ')}</div>
          </div>
          <div class="status ${escapeHtml(row.status || 'draft')}">${escapeHtml(row.status || 'draft')}</div>
        </div>
        <div class="submission-body">
          <p><strong>オーナーメモ:</strong> ${escapeHtml(row.ownerComment || 'なし')}</p>
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
              ⏳ 動画は現在バックグラウンドで自動生成（レンダリング）中です。数分後に画面をリロードしてください。
            </div>
          `}

          <div style="margin-top: 16px;">
            <h4 style="margin: 0 0 8px; font-size: 15px; color: var(--brand);">チャンネル別配信設定</h4>
            ${renderChannelSettings(row)}
          </div>

          <div class="actions" style="margin-top: 18px;">
            <button class="good" data-action="publish_now" data-id="${row.id}" style="background-color: #0284c7; border-color: #0284c7;">📲 今すぐ投稿</button>
            <button class="good" data-action="approve" data-id="${row.id}">承認</button>
            <button class="warn" data-action="regenerate" data-id="${row.id}">下書き再生成</button>
            <button class="danger" data-action="reject" data-id="${row.id}">却下</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // 承認等の共通アクションイベント付与
  [...queueEl.querySelectorAll('button[data-action]')].forEach(button => {
    button.addEventListener('click', async () => {
      try {
        button.disabled = true;
        await updateStatus(button.dataset.id, button.dataset.action);
        await loadQueue();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
      }
    });
  });

  // AI音声生成ボタンイベント付与
  [...queueEl.querySelectorAll('.voice-btn')].forEach(button => {
    button.addEventListener('click', async () => {
      try {
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = '🎙️ Gemini音声生成中...';
        
        const response = await fetch(`${apiBase}/generate-voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: button.dataset.text,
            submissionId: button.dataset.id,
            voiceName: 'Charon' // 落ち着いた男性ボイス
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || '音声生成失敗');
        }

        alert('Geminiによるナレーション音声を生成・保存しました。');
        await loadQueue();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = '🎙️ Gemini AI音声生成';
      }
    });
  });

  // 動画プレビューボタンイベント付与
  [...queueEl.querySelectorAll('.preview-btn')].forEach(button => {
    button.addEventListener('click', () => {
      const d = button.dataset;
      openPreview(d.id, d.text, d.voice, d.media, d.mediaType, d.video);
    });
  });

  // チャンネル別承認・日程保存イベント
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

  // チャンネル別即時投稿イベント
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

  // チャンネル別却下イベント
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

// プレビューコントローラ動作
playBtn.addEventListener('click', startPreview);
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
loadQueue();
