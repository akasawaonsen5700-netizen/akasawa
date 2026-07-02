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
const reelTimer = document.getElementById('reelTimer');
const narrationAudio = document.getElementById('narrationAudio');
const bgmAudio = document.getElementById('bgmAudio');

let previewTimerInterval = null;
let currentPreviewText = '';
let textAnimationTimeout = null;

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
    const publishAt = setting.publishAt || row.publishAt || '自動提案';
    const assets = setting.assets || [];
    const draftText = row.drafts?.[channel]?.text || '下書きなし';
    const narrationText = row.drafts?.[channel]?.narration || '';

    let extraButtonsHtml = '';
    // Instagramかつ、下書きにナレーション原稿がある場合
    if (channel === 'instagram' && narrationText) {
      const hasVoice = !!row.voiceUrl;
      extraButtonsHtml = `
        <div style="margin-top: 10px; display: flex; gap: 8px; align-items: center;">
          <button class="voice-btn ${hasVoice ? 'has-voice' : ''}" 
                  data-id="${row.id}" 
                  data-text="${escapeHtml(narrationText)}">
            ${hasVoice ? '🎙️ AI音声再生成' : '🎙️ Gemini AI音声生成'}
          </button>
          ${hasVoice ? `
            <button class="preview-btn" 
                    data-id="${row.id}" 
                    data-text="${escapeHtml(narrationText)}"
                    data-voice="${escapeHtml(row.voiceUrl)}"
                    data-media="${escapeHtml(assets[0]?.url || '')}"
                    data-media-type="${escapeHtml(assets[0]?.type || '')}">
              🎬 動画プレビュー
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
        <p style="margin: 4px 0; font-size: 13px;"><strong>公開予定日時:</strong> ${escapeHtml(publishAt)}</p>
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
function openPreview(text, voiceUrl, mediaUrl, mediaType) {
  currentPreviewText = text;
  
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
  
  // モーダル表示
  previewModal.style.display = 'flex';
  
  // 再生ボタンの初期化
  playBtn.disabled = false;
  pauseBtn.disabled = true;
  reelTimer.textContent = '0.0s / 0.0s';
  reelTextOverlay.innerHTML = '';
}

function closePreviewModal() {
  stopPreview();
  previewModal.style.display = 'none';
}

function startPreview() {
  playBtn.disabled = true;
  pauseBtn.disabled = false;

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
          
          <div style="margin-top: 16px;">
            <h4 style="margin: 0 0 8px; font-size: 15px; color: var(--brand);">チャンネル別配信設定</h4>
            ${renderChannelSettings(row)}
          </div>

          <div class="actions" style="margin-top: 18px;">
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
      openPreview(d.text, d.voice, d.media, d.mediaType);
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

refreshBtn.addEventListener('click', loadQueue);
statusFilter.addEventListener('change', loadQueue);
channelFilter.addEventListener('change', loadQueue);
loadQueue();
