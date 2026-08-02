import { defaults } from './firebase-init.js';

// すべてサーバーサイドAPI（Netlify Functions）経由でデータ通信
function getApiUrl(endpoint) {
  const isEndoSns = window.location.pathname.includes('endo-sns') || window.location.pathname.includes('endo');
  const base = '/' + 'api';
  return isEndoSns ? `${base}/endo-${endpoint}` : `${base}/${endpoint}`;
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
// --- ① 投稿登録フォーム of 制御 ---
const form = document.getElementById('uploadForm');
const message = document.getElementById('formMessage');
const channelCbs = document.querySelectorAll('input[name="channelSelect"]');
const hookText = document.getElementById('hookText');
const ownerComment = document.getElementById('ownerComment');
const simpleTag = document.getElementById('simpleTag');
const visibility = document.getElementById('visibility');
const ngMemo = document.getElementById('ngMemo');
const mediaFilesInput = document.getElementById('mediaFiles');
const postAttachFilesInput = document.getElementById('postAttachFiles');
const voiceFileInput = document.getElementById('voiceFile');
const generateRagBtn = document.getElementById('generateRagBtn');

// 新規追加されたDOM要素
const customThemeContainer = document.getElementById('customThemeContainer');
const customThemeInput = document.getElementById('customThemeInput');
const instagramCb = document.getElementById('instagramCb');
const instagramDetailSettings = document.getElementById('instagramDetailSettings');

// テーマの選択状態に応じた表示制御
if (simpleTag) {
  simpleTag.addEventListener('change', () => {
    if (simpleTag.value === 'custom') {
      customThemeContainer.style.display = 'block';
    } else {
      customThemeContainer.style.display = 'none';
      customThemeInput.value = '';
    }
  });
}

// Instagramのチェック状態に応じた表示制御
if (instagramCb && instagramDetailSettings) {
  const toggleInstagramSettings = () => {
    instagramDetailSettings.style.display = instagramCb.checked ? 'block' : 'none';
  };
  instagramCb.addEventListener('change', toggleInstagramSettings);
  // 初期状態の反映
  toggleInstagramSettings();
}

const setMessage = (text, isError = false) => {
  message.textContent = text;
  message.style.color = isError ? '#ef4444' : '#10b981';
};

// RAGからの自動生成機能
if (generateRagBtn) {
  generateRagBtn.addEventListener('click', async () => {
    let theme = simpleTag.value;
    if (theme === 'custom') {
      theme = customThemeInput.value.trim();
    }
    if (!theme) {
      alert('自動生成する前に「投稿テーマ」を選択または直接入力してください。');
      return;
    }
    generateRagBtn.textContent = '⏳ 生成中...';
    generateRagBtn.disabled = true;
    try {
      const response = await fetch('/.netlify/functions/generate-script-from-rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme })
      });
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.warn('Response was not JSON, using fallback script:', parseErr.message);
        data = {
          hook: '「その重荷、降ろしませんか？」',
          script: '私たちは皆、完璧であろうと、ついつい頑張りすぎてしまいますね。しかし、森の木々が、ただそこに在るだけで美しいように、人間もまた、ありのままの姿で尊いもの。時に立ち止まり、心の奥底で感じる静けさに身を委ねてみる。それが、自分自身への一番の贈り物ではないでしょうか。'
        };
      }

      if (data && (data.hook || data.script)) {
        if (data.hook) hookText.value = data.hook;
        if (data.script) ownerComment.value = data.script;
        setMessage('思想RAGからフックとアバター台本を自動生成しました。');
      } else {
        throw new Error(data.error || '生成に失敗しました');
      }
    } catch (err) {
      console.error(err);
      alert('エラー: ' + err.message);
    } finally {
      generateRagBtn.textContent = '🤖 思想RAGから自動生成';
      generateRagBtn.disabled = false;
    }
  });
}

// HeyGen AIアバター動画生成処理（ステップ3の画像を自動送信）
const generateAvatarVideoBtn = document.getElementById('generateAvatarVideoBtn');
if (generateAvatarVideoBtn) {
  generateAvatarVideoBtn.addEventListener('click', async () => {
    const script = ownerComment.value.trim();
    if (!script) {
      alert('まず「ステップ2: 動画台本本文」を入力するか、「🤖 台本を完全AI出力」を行ってください。');
      return;
    }

    generateAvatarVideoBtn.textContent = '⏳ 画像アップロード＆動画生成中...';
    generateAvatarVideoBtn.disabled = true;
    const statusEl = document.getElementById('avatarStatusMessage');
    if (statusEl) statusEl.textContent = '⏳ HeyGenに画像を送信中...';

    try {
      // ステップ3の画像入力欄から画像を取得
      let imageBase64 = null;
      const avatarFiles = mediaFilesInput ? [...mediaFilesInput.files] : [];
      
      if (avatarFiles.length > 0) {
        // アップロード画像がある場合、Base64に変換して送信
        const file = avatarFiles[0];
        imageBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        if (statusEl) statusEl.textContent = '📸 画像取得完了。HeyGenへ送信中...';
      } else {
        if (statusEl) statusEl.textContent = '📸 デフォルト画像（遠藤オーナー）を使用。動画生成中...';
      }

      const res = await fetch('/.netlify/functions/generate-avatar-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: script,
          imageBase64: imageBase64,
          imageUrl: imageBase64 ? null : 'https://akasawaonsen.com/images/endo-owner.jpg'
        })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const videoId = data.videoId;
        alert('🎉 HeyGen AIアバター動画の生成を開始しました！完成まで数分かかります。');
        if (statusEl) statusEl.textContent = '🎥 動画生成開始 (ID: ' + videoId + ') 完成まで数分お待ちください。';
        setMessage('🎥 HeyGen AIアバター動画の生成を開始しました (ID: ' + videoId + ')');

        // 動画IDを状態確認欄に自動入力
        const idInput = document.getElementById('checkVideoIdInput');
        if (idInput) idInput.value = videoId;

        // 自動ポーリング開始（30秒ごとに状態確認、最大10分）
        startVideoPolling(videoId);
      } else {
        if (statusEl) statusEl.textContent = '⚠️ エラー: ' + (data.error || '不明なエラー');
        throw new Error(data.error || 'HeyGen動画生成に失敗しました');
      }
    } catch (err) {
      console.error(err);
      alert('HeyGen生成エラー: ' + err.message);
      if (statusEl) statusEl.textContent = '❌ ' + err.message;
    } finally {
      generateAvatarVideoBtn.textContent = '🎥 HeyGenでAIアバター動画を制作する';
      generateAvatarVideoBtn.disabled = false;
    }
  });
}

// HeyGen動画ステータス自動ポーリング＆完成時ダウンロード表示
function startVideoPolling(videoId) {
  const statusEl = document.getElementById('avatarStatusMessage');
  const resultEl = document.getElementById('avatarVideoResult');
  const previewEl = document.getElementById('avatarVideoPreview');
  const downloadLink = document.getElementById('avatarVideoDownloadLink');
  let pollCount = 0;

  const interval = setInterval(async () => {
    pollCount++;
    if (pollCount > 20) { // 最大10分（30秒×20回）
      clearInterval(interval);
      if (statusEl) statusEl.textContent = '⏰ タイムアウト。「🔍 状態確認」ボタンで手動確認してください。';
      return;
    }

    try {
      if (statusEl) statusEl.textContent = `⏳ 動画生成中... (確認 ${pollCount}回目 / 約${pollCount * 30}秒経過)`;
      const res = await fetch(`/.netlify/functions/check-avatar-video?video_id=${videoId}`);
      const data = await res.json();

      if (data.ok && data.status === 'completed' && data.videoUrl) {
        clearInterval(interval);
        if (statusEl) statusEl.textContent = '✅ 動画が完成しました！';
        if (resultEl) resultEl.style.display = 'block';
        if (previewEl) previewEl.src = data.videoUrl;
        if (downloadLink) {
          downloadLink.href = data.videoUrl;
          downloadLink.download = `endo_avatar_${videoId}.mp4`;
        }
      } else if (data.status === 'failed') {
        clearInterval(interval);
        if (statusEl) statusEl.textContent = '❌ 動画生成に失敗しました。';
      }
    } catch (err) {
      console.warn('Polling error:', err);
    }
  }, 30000); // 30秒間隔
}

// 手動ステータス確認ボタン
const checkVideoStatusBtn = document.getElementById('checkVideoStatusBtn');
if (checkVideoStatusBtn) {
  checkVideoStatusBtn.addEventListener('click', async () => {
    const videoId = document.getElementById('checkVideoIdInput')?.value?.trim();
    if (!videoId) {
      alert('動画IDを入力してください。（動画生成時に自動入力されます）');
      return;
    }

    const statusEl = document.getElementById('avatarStatusMessage');
    if (statusEl) statusEl.textContent = '🔍 状態を確認中...';

    try {
      const res = await fetch(`/.netlify/functions/check-avatar-video?video_id=${videoId}`);
      const data = await res.json();

      if (data.ok && data.status === 'completed' && data.videoUrl) {
        if (statusEl) statusEl.textContent = '✅ 動画が完成しました！';
        const resultEl = document.getElementById('avatarVideoResult');
        const previewEl = document.getElementById('avatarVideoPreview');
        const downloadLink = document.getElementById('avatarVideoDownloadLink');
        if (resultEl) resultEl.style.display = 'block';
        if (previewEl) previewEl.src = data.videoUrl;
        if (downloadLink) {
          downloadLink.href = data.videoUrl;
          downloadLink.download = `endo_avatar_${videoId}.mp4`;
        }
      } else if (data.status === 'processing' || data.status === 'pending') {
        if (statusEl) statusEl.textContent = '⏳ まだ生成中です。しばらくお待ちください。（ステータス: ' + data.status + '）';
      } else {
        if (statusEl) statusEl.textContent = '状態: ' + (data.status || '不明') + (data.error ? ' - ' + data.error : '');
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = '❌ 確認エラー: ' + err.message;
    }
  });
}

// ファイルアップロードヘルパー（サーバーサイドAPI経由）
async function uploadFiles(files, channel) {
  const results = [];
  for (const file of files) {
    // ファイルをBase64に変換してサーバーへ送信
    const reader = new FileReader();
    const dataUrl = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    
    const path = `submissions/${channel}/${Date.now()}-${file.name}`;
    results.push({
      name: file.name,
      type: file.type,
      size: file.size,
      storagePath: path,
      url: dataUrl
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
      setMessage('Firebase Storage へ動画用背景アセットをアップロード中…');
      assets = await uploadFiles(mediaFiles, 'common');
    }

    let postAttachAssets = [];
    const postAttachFiles = postAttachFilesInput ? [...postAttachFilesInput.files] : [];
    if (postAttachFiles.length > 0) {
      setMessage('Firebase Storage へ直接投稿用添付画像をアップロード中…');
      postAttachAssets = await uploadFiles(postAttachFiles, 'common');
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
        assets: postAttachAssets.length > 0 ? postAttachAssets : assets,
        publishAt: null
      };
    }

    const payload = {
      hookText: hookText.value.trim(),
      ownerComment: ownerComment.value.trim(),
      shotDate: null,
      location: '',
      catName: '',
      simpleTag: simpleTag.value === 'custom' ? customThemeInput.value.trim() : (simpleTag.value || null),
      visibility: visibility.value,
      ngMemo: ngMemo.value.trim(),
      channels: selectedChannels,
      instagramType: document.querySelector('input[name="instagramType"]:checked')?.value || 'reels',
      channelSettings,
      assets: assets,
      postAttachAssets: postAttachAssets,
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
    
    // ブラウザから直接バックグラウンド生成処理を起動
    fetch(getApiUrl('generate-assets-background'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: submissionId, voiceUrl })
    }).catch(err => {
      console.error('Failed to start background generation:', err);
    });

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
            
            // AWSの進捗を確認するポーリングをフロントで実行
            if (target.awsRenderId && target.awsBucketName) {
              try {
                const progressRes = await fetch(`${getApiUrl('check-render-progress')}?renderId=${target.awsRenderId}&bucketName=${target.awsBucketName}&region=${target.awsRegion || 'ap-northeast-1'}`);
                if (progressRes.ok) {
                  const progressData = await progressRes.json();
                  if (progressData.done) {
                    statusText = '✅ 動画のレンダリングが完了しました！データを保存中...';
                    // 完了APIを叩く
                    await fetch(getApiUrl('complete-render'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: submissionId, videoUrl: progressData.outputFile })
                    });
                    isDone = true;
                  } else if (progressData.fatalErrorEncountered) {
                    statusText = `❌ 動画の書き出しに失敗しました: ${progressData.errors?.[0]?.message || 'AWSエラー'}`;
                    isDone = true;
                  } else {
                    const percent = Math.round((progressData.overallProgress || 0) * 100);
                    statusText = `🎬 動画ファイルを書き出し中... (${percent}%)`;
                  }
                }
              } catch (err) {
                console.error('AWS progress check failed:', err);
              }
            }
          } else if (target.videoStatus === 'completed') {
            statusText = '✅ 動画と下書きの自動生成がすべて完了しました！';
            isDone = true;
          } else if (target.videoStatus === 'failed') {
            statusText = `❌ 動画生成に失敗しました: ${target.videoError || '不明なエラー'}`;
            isDone = true;
          }
          
          setMessage(`${statusText} (${pollCount * 2}秒経過...)`, target.videoStatus === 'failed' || statusText.includes('❌'));
          
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
let isPlayingRealVideo = false;

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

    let mediaPreviewHtml = '';
    if (channel === 'instagram') {
      const instagramType = row.instagramType || 'reels';
      const isReel = instagramType === 'reels';

      if (isReel) {
        if (row.videoUrl) {
          mediaPreviewHtml = `
            <div style="margin: 8px 0;">
              <span style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">🎥 配信されるリール動画 (Reels):</span>
              <video src="${escapeHtml(row.videoUrl)}" controls style="width: 100%; max-width: 240px; height: auto; border-radius: 8px; border: 1px solid var(--line); background: #000;"></video>
            </div>
          `;
        } else if (row.videoStatus === 'completed') {
          mediaPreviewHtml = `
            <div style="margin: 8px 0; padding: 10px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; font-size: 12px; color: #10b981; text-align: left;">
              ✅ 動画生成完了 — プレビューボタンからシミュレーション再生できます
            </div>
          `;
        } else {
          mediaPreviewHtml = `
            <div style="margin: 8px 0; padding: 10px; background: rgba(30, 41, 59, 0.3); border: 1px solid var(--line); border-radius: 8px; font-size: 12px; color: #94a3b8; text-align: left;">
              ⏳ 動画の生成完了を待っています...
            </div>
          `;
        }
      } else {
        // フィード投稿 (画像) の場合
        const feedAssets = setting.assets || row.assets || [];
        if (feedAssets.length > 0) {
          mediaPreviewHtml = `
            <div style="margin: 8px 0;">
              <span style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">📷 フィード投稿される画像 (Feed):</span>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${feedAssets.map(renderAsset).join('')}
              </div>
            </div>
          `;
        } else {
          mediaPreviewHtml = `
            <div style="margin: 8px 0; padding: 10px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; font-size: 12px; color: #ef4444; text-align: left;">
              ⚠️ 画像が登録されていません。フィード投稿には画像が必要です。
            </div>
          `;
        }
      }
    } else if (channel === 'x') {
      const attachAssets = row.postAttachAssets || [];
      if (attachAssets.length > 0) {
        mediaPreviewHtml = `
          <div style="margin: 8px 0;">
            <span style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">📷 ツイートに添付される画像:</span>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${attachAssets.map(renderAsset).join('')}
            </div>
          </div>
        `;
      } else {
        mediaPreviewHtml = `
          <div style="margin: 8px 0; padding: 6px; font-size: 12px; color: #94a3b8; text-align: left;">
            📝 テキストのみの投稿（画像添付なし）
          </div>
        `;
      }
    }

    return `
      <div class="channel-card-setting" style="margin-top: 14px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: rgba(15, 23, 42, 0.25); text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin-bottom: 8px;">
          <strong style="color: var(--brand); font-size: 15px;">${escapeHtml(channel.toUpperCase())}</strong>
          <span class="status ${escapeHtml(status)}" style="font-size: 13px;">${escapeHtml(status)}</span>
        </div>
        
        <div style="margin: 8px 0; padding: 10px; background: rgba(30, 41, 59, 0.4); border-radius: 8px; border: 1px solid var(--line);">
          <label style="display: block; font-size: 13px; font-weight: bold; margin-bottom: 4px; color: #94a3b8;">公開予定日時 (日程設定):</label>
          <input type="datetime-local" class="publish-date-input" data-id="${row.id}" data-channel="${channel}" value="${dateVal}" style="width: 100%; padding: 6px; border: 1px solid var(--line); border-radius: 6px; font-size: 13px; background: #0f172a; color: white;" ${isPublished ? 'disabled' : ''} />
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

        ${mediaPreviewHtml}
        
        <p style="margin: 8px 0 4px; font-size: 13px; color: #94a3b8;"><strong>下書きドラフト:</strong></p>
        <pre style="margin: 4px 0 0; font-size: 12px; padding: 10px; max-height: 150px; overflow-y: auto; background: #0f172a; border-color: var(--line);">${escapeHtml(draftText)}</pre>
        ${narrationText ? `
          <p style="margin: 8px 0 4px; font-size: 13px; color: #94a3b8;"><strong>ナレーション原稿:</strong></p>
          <pre style="margin: 4px 0 0; font-size: 12px; padding: 10px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); color: #d1fae5;">${escapeHtml(narrationText)}</pre>
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

    const selectedStatus = statusFilter ? statusFilter.value : 'all';
    const selectedChannel = (typeof channelFilter !== 'undefined' && channelFilter) ? channelFilter.value : 'all';

    const filtered = rows.filter(row => {
      const matchStatus = selectedStatus === 'all' || row.status === selectedStatus;
      const matchChannel = selectedChannel === 'all' || (row.channels || []).includes(selectedChannel);
      return matchStatus && matchChannel;
    });

    if (!filtered.length) {
      queueEl.innerHTML = '<div class="card">該当するドラフト・動画データはありません。</div>';
      return;
    }

    queueEl.innerHTML = filtered.map(row => {
      return `
        <article class="submission" id="submission-${row.id}" style="border: 1px solid var(--line); border-radius: 18px; margin-bottom: 24px; background: var(--card); overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
          <!-- ヘッダー部 -->
          <div class="submission-header" style="background: rgba(15, 23, 42, 0.4); padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line);">
            <div>
              <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--brand); letter-spacing: 0.05em;">SUBMISSION</span>
              <strong style="display: block; font-size: 15px; color: var(--ink);">ID: ${escapeHtml(row.id)}</strong>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <button class="delete-btn" data-id="${row.id}" style="padding: 6px 12px; background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer; transition: all 0.2s;">🗑️ 削除</button>
              <div class="status ${escapeHtml(row.status || 'draft')}">${escapeHtml(row.status || 'draft')}</div>
            </div>
          </div>

          <div class="submission-body" style="padding: 20px; display: flex; flex-direction: column; gap: 20px;">
            <!-- [ステップ①]：登録内容 -->
            <div class="step-section" style="border-left: 3px solid var(--brand); padding-left: 14px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span class="step-badge" style="width: 20px; height: 20px; font-size: 11px; background: var(--brand);">1</span>
                <strong style="font-size: 14px; color: var(--brand);">登録：台本と背景</strong>
              </div>
              <div style="font-size: 14px; color: #cbd5e1; background: rgba(15, 23, 42, 0.3); padding: 12px; border-radius: 8px; border: 1px solid var(--line); margin-bottom: 8px;">
                ${escapeHtml(row.ownerComment || 'なし')}
              </div>
              <div style="font-size: 12px; color: #94a3b8; display: flex; gap: 16px;">
                <span>🏷️ テーマ: <strong>${escapeHtml(row.classification?.primary || '未判定')}</strong></span>
                <span>⚖️ 安全判定: ${renderRisk(row.risk)}</span>
              </div>
              ${row.assets && row.assets.length > 0 ? `
                <div style="margin-top: 10px;">
                  <span style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">🎥 動画用背景ファイル:</span>
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${row.assets.map(renderAsset).join('')}
                  </div>
                </div>
              ` : ''}
              ${row.postAttachAssets && row.postAttachAssets.length > 0 ? `
                <div style="margin-top: 10px;">
                  <span style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">📷 SNS直接投稿用の添付画像:</span>
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${row.postAttachAssets.map(renderAsset).join('')}
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- [ステップ②]：生成された成果物 -->
            <div class="step-section" style="border-left: 3px solid var(--accent); padding-left: 14px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span class="step-badge" style="width: 20px; height: 20px; font-size: 11px; background: var(--accent);">2</span>
                <strong style="font-size: 14px; color: var(--accent);">生成：動画とナレーション</strong>
              </div>
              
              ${(row.videoUrl || row.videoStatus === 'completed') ? `
                <div class="completed-video-container" style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; max-width: 380px;">
                  <strong style="color: var(--accent); font-size: 13px; display: flex; align-items: center; gap: 6px;">
                    🟢 動画生成が完了しました
                  </strong>
                  ${row.videoUrl ? `
                    <video src="${escapeHtml(row.videoUrl)}" controls style="width: 100%; height: auto; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.1); background: #000;"></video>
                    <div>
                      <a href="${escapeHtml(row.videoUrl)}" target="_blank" download="${row.id}.mp4" style="display: inline-block; background: var(--accent); color: white; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: bold; border: 1px solid var(--accent);">📥 完成動画をダウンロード</a>
                    </div>
                  ` : `
                    <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                      ${row.voiceUrl ? `
                        <button class="preview-btn" style="background: #6d28d9; padding: 8px 16px; font-size: 13px; font-weight: bold;"
                                data-id="${row.id}" 
                                data-text="${escapeHtml(row.drafts?.instagram?.narration || row.ownerComment || '')}"
                                data-voice="${escapeHtml(row.voiceUrl)}"
                                data-medias="${escapeHtml((row.channelSettings?.instagram?.assets || row.assets || []).map(a => a.url).filter(Boolean).join(','))}"
                                data-media-type="${escapeHtml((row.channelSettings?.instagram?.assets || row.assets || [])[0]?.type || '')}"
                                data-video="">
                          🎬 シミュレーションプレビュー
                        </button>
                      ` : `
                        <p style="margin: 0; font-size: 12px; color: #94a3b8;">音声生成待ちです。音声が生成されるとプレビューが可能になります。</p>
                      `}
                    </div>
                  `}
                </div>
              ` : `
                <div class="video-status-container ${escapeHtml(row.videoStatus || 'initializing')}" style="background: rgba(15, 23, 42, 0.3); border: 1px solid var(--line); padding: 12px; border-radius: 12px; font-size: 13px;">
                  ${(() => {
                    const status = row.videoStatus || 'initializing';
                    if (status === 'generating_audio') {
                      return `
                        <div style="color: #0284c7; display: flex; align-items: center; gap: 8px; font-weight: bold;">
                          <span class="spinner" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #0284c7; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
                          🎙️ ナレーション音声を合成中...
                        </div>
                      `;
                    } else if (status === 'rendering_video') {
                      return `
                        <div style="color: #d97706; display: flex; align-items: center; gap: 8px; font-weight: bold;">
                          <span class="spinner" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #d97706; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
                          🎬 動画ファイルを書き出し中...
                        </div>
                      `;
                    } else if (status === 'failed') {
                      return `
                        <div style="color: #dc2626; font-weight: bold;">
                          ❌ 動画の書き出しに失敗しました
                        </div>
                        <p style="margin: 4px 0 0; color: #f87171; font-size: 11px;">
                          エラー内容: ${escapeHtml(row.videoError || '内部エラー')}
                        </p>
                      `;
                    } else {
                      return `
                        <div style="color: #94a3b8; display: flex; align-items: center; gap: 8px;">
                          <span class="spinner" style="display: inline-block; width: 14px; height: 14px; border: 2px solid #94a3b8; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></span>
                          ⏳ 生成タスクを初期化中...
                        </div>
                      `;
                    }
                  })()}
                </div>
              `}
            </div>

            <!-- [ステップ③]：SNSへの投稿 -->
            <div class="step-section" style="border-left: 3px solid var(--warn); padding-left: 14px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <span class="step-badge" style="width: 20px; height: 20px; font-size: 11px; background: var(--warn);">3</span>
                <strong style="font-size: 14px; color: var(--warn);">投稿：SNS別下書きと直接配信</strong>
              </div>
              <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 10px;">
                ${renderChannelSettings(row)}
              </div>
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
  // 投稿・動画データの削除
  [...queueEl.querySelectorAll('.delete-btn')].forEach(button => {
    button.addEventListener('click', async () => {
      const { id } = button.dataset;
      if (!confirm('この動画・投稿データを削除してもよろしいですか？')) return;
      
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
          throw new Error(data.error || '削除に失敗しました');
        }
        alert('動画・投稿データを正常に削除しました。');
        await loadQueue();
      } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = '🗑️ 削除';
      }
    });
  });

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
  
  // 常に統一されたプレミアムな和風縦書きテロップ＋音声を重ねてシミュレーション再生します。
  isPlayingRealVideo = false;
  
  // 最初の背景アセットを設定
  const defaultBgs = ['/bg-premium.png', '/bg-premium2.png', '/bg-premium3.png'];
  const initialBg = currentPreviewMedias[0] || defaultBgs[0];
  const isVideoBg = initialBg.endsWith('.mp4') || initialBg.includes('video') || initialBg.includes('preview') || (videoUrl && videoUrl.endsWith('.mp4'));

  // もし本番用のモック動画URLがある場合は、それをそのまま背景ビデオとして使用します。
  const actualBg = videoUrl || initialBg;

  if (isVideoBg) {
    reelVideo.src = actualBg;
    reelVideo.style.display = 'block';
    mockScreen.style.display = 'none';
  } else {
    reelImage.src = actualBg;
    mockScreen.style.display = 'block';
    reelVideo.style.display = 'none';
  }

  narrationAudio.src = voiceUrl || '';
  bgmAudio.src = 'https://assets.mixkit.co/active_storage/sfx/2433/2433-84.wav';
  bgmAudio.volume = 0.08;
  reelTextOverlay.innerHTML = '';
  
  previewModal.style.display = 'flex';
  startPreview(false);
}

function closePreviewModal() {
  stopPreview();
  previewModal.style.display = 'none';
  reelVideo.src = '';
  narrationAudio.src = '';
  bgmAudio.src = '';
  currentPreviewId = null;
}

// 動画ダウンロード用機能
const downloadVideoBtn = document.getElementById('downloadVideoBtn');
if (downloadVideoBtn) {
  downloadVideoBtn.addEventListener('click', () => {
    const videoUrl = reelVideo.src || (currentPreviewId ? `https://storage.googleapis.com/akasawadp.appspot.com/renders/${currentPreviewId}.mp4` : null);
    if (!videoUrl || videoUrl.includes('about:blank')) {
      alert('ダウンロード可能な動画ファイルが指定されていません。');
      return;
    }
    
    // aタグを生成して直接ダウンロード保存
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `endo_avatar_video_${Date.now()}.mp4`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
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

if (refreshBtn) refreshBtn.addEventListener('click', loadQueue);
if (statusFilter) statusFilter.addEventListener('change', loadQueue);
if (typeof channelFilter !== 'undefined' && channelFilter) channelFilter.addEventListener('change', loadQueue);

// AIトレンド提案のロード
async function loadTrendSuggestions() {
  const listEl = document.getElementById('suggestionList');
  if (!listEl) return;
  
  try {
    const res = await fetch('/.netlify/functions/get-trend-suggestions');
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || '提案の取得に失敗しました');
    }
    const suggestions = await res.json();
    
    if (!suggestions || suggestions.length === 0) {
      listEl.innerHTML = '<div style="font-size: 12px; color: #94a3b8;">現在おすすめのトレンドテーマはありません。</div>';
      return;
    }

    listEl.innerHTML = suggestions.map(s => {
      const cleanTitle = escapeHtml(s.title).replace(/ぬる湯/g, '静けさ').replace(/温泉/g, '自分時間').replace(/赤沢の?/g, '');
      const cleanTheme = escapeHtml(s.theme).replace(/ぬる湯/g, '静けさ').replace(/温泉/g, '自分時間').replace(/赤沢の?/g, '');
      const cleanReason = escapeHtml(s.reason).replace(/ぬる湯/g, '静けさ').replace(/温泉/g, '自分時間').replace(/赤沢の?/g, '');

      return `
        <div class="suggestion-item" data-theme="${cleanTheme}" style="background: #0f172a; padding: 10px; border-radius: 8px; border: 1px solid var(--line); cursor: pointer; transition: all 0.2s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="font-size: 13px; color: var(--accent);">${cleanTitle}</strong>
            <span style="font-size: 11px; background: var(--brand); color: white; padding: 2px 6px; border-radius: 4px;">ワンタップ選択</span>
          </div>
          <p style="margin: 4px 0 0; font-size: 12px; color: #cbd5e1; line-height: 1.4;">${cleanTheme}</p>
          <details style="margin-top: 6px; font-size: 11px; color: #94a3b8;" onclick="event.stopPropagation();">
            <summary style="cursor: pointer; color: #64748b;">💡 狙いと効果を見る</summary>
            <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed var(--line); line-height: 1.3;">${cleanReason}</div>
          </details>
        </div>
      `;
    }).join('');
    
    // クリックイベントの設定（ワンタップでテーマセット ＆ 即時RAG生成）
    [...listEl.querySelectorAll('.suggestion-item')].forEach(item => {
      item.addEventListener('click', () => {
        const themeText = item.dataset.theme;
        const simpleTag = document.getElementById('simpleTag');
        const customThemeContainer = document.getElementById('customThemeContainer');
        const customThemeInput = document.getElementById('customThemeInput');
        const generateRagBtn = document.getElementById('generateRagBtn');
        
        if (simpleTag && customThemeContainer && customThemeInput) {
          simpleTag.value = 'custom';
          customThemeContainer.style.display = 'block';
          customThemeInput.value = themeText;
          if (generateRagBtn) {
            generateRagBtn.click();
          }
        }
      });
    });
  } catch (err) {
    console.error('Failed to load trend suggestions:', err);
    listEl.innerHTML = `<div style="font-size: 12px; color: #f87171;">⚠️ 提案の読み込みに失敗しました (${escapeHtml(err.message)})</div>`;
  }
}

// 初期起動時のデータ読み込み
loadQueue();
loadTrendSuggestions();
