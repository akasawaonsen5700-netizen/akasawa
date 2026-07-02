import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';
import { storage, apiBase, defaults } from './firebase-init.js';

const form = document.getElementById('uploadForm');
const message = document.getElementById('formMessage');
const channelCbs = document.querySelectorAll('input[name="channelSelect"]');
const channelSettingsContainer = document.getElementById('channelSettingsContainer');
const ownerComment = document.getElementById('ownerComment');
const shotDate = document.getElementById('shotDate');
const locationInput = document.getElementById('location');
const catName = document.getElementById('catName');
const simpleTag = document.getElementById('simpleTag');
const visibility = document.getElementById('visibility');
const ngMemo = document.getElementById('ngMemo');

const setMessage = (text, isError = false) => {
  message.textContent = text;
  message.style.color = isError ? '#ef4444' : '#10b981';
};

// チャンネル設定パネルの生成関数
const createPanel = (channel) => {
  const panel = document.createElement('div');
  panel.className = 'channel-panel';
  panel.id = `panel-${channel}`;
  panel.innerHTML = `
    <h3>${channel.toUpperCase()} 個別設定</h3>
    <div class="grid-2">
      <div>
        <label for="files-${channel}">画像・動画</label>
        <input id="files-${channel}" type="file" accept="image/*,video/*" multiple required />
        <div class="help">${channel.toUpperCase()}用のファイルをアップロード（必須）</div>
      </div>
      <div>
        <label for="publishAt-${channel}">希望公開日時</label>
        <input id="publishAt-${channel}" type="datetime-local" />
        <div class="help">未指定時はAIの自動提案スケジュールが適用されます</div>
      </div>
    </div>
  `;
  channelSettingsContainer.appendChild(panel);
};

// チャンネル選択時の動的パネル生成
channelCbs.forEach(cb => {
  // 初期ロード時の状態を反映
  if (cb.checked) {
    createPanel(cb.value);
  }

  cb.addEventListener('change', () => {
    const channel = cb.value;
    if (cb.checked) {
      createPanel(channel);
    } else {
      const panel = document.getElementById(`panel-${channel}`);
      if (panel) panel.remove();
    }
  });
});

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

  try {
    setMessage('Firebase Storage へ各チャンネルのアセットをアップロード中…');
    
    const channelSettings = {};
    for (const channel of selectedChannels) {
      const fileInput = document.getElementById(`files-${channel}`);
      const files = fileInput ? [...fileInput.files] : [];
      if (!files.length) {
        throw new Error(`${channel.toUpperCase()}の画像・動画ファイルを選択してください。`);
      }

      setMessage(`${channel.toUpperCase()} のアセットをアップロード中…`);
      const assets = await uploadFiles(files, channel);
      
      const publishAtInput = document.getElementById(`publishAt-${channel}`);
      const publishAtVal = publishAtInput?.value ? new Date(publishAtInput.value).toISOString() : null;
      
      channelSettings[channel] = {
        assets,
        publishAt: publishAtVal
      };
    }

    setMessage('下書き生成を開始しています…');
    
    const payload = {
      ownerComment: ownerComment.value.trim(),
      shotDate: shotDate.value || null,
      location: locationInput.value.trim(),
      catName: catName.value.trim(),
      simpleTag: simpleTag.value || null,
      visibility: visibility.value,
      ngMemo: ngMemo.value.trim(),
      channels: selectedChannels,
      channelSettings,
      assets: Object.values(channelSettings)[0].assets, // 後方互換性のためのフォールバック
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

    setMessage(`登録完了: ${data.id} / ステータス: ${data.status}`);
    form.reset();
    channelSettingsContainer.innerHTML = '';
    // デフォルトチェックのパネルを再生成
    channelCbs.forEach(cb => {
      if (cb.checked) {
        createPanel(cb.value);
      }
    });
  } catch (error) {
    console.error(error);
    setMessage(error.message || 'エラーが発生しました。', true);
  }
});
