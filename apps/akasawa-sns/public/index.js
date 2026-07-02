import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';
import { storage, apiBase, defaults } from './firebase-init.js';

const form = document.getElementById('uploadForm');
const message = document.getElementById('formMessage');
const channelCbs = document.querySelectorAll('input[name="channelSelect"]');
const mediaFiles = document.getElementById('mediaFiles');
const publishAtInput = document.getElementById('publishAt');
const ownerComment = document.getElementById('ownerComment');
const shotDate = document.getElementById('shotDate');
const locationInput = document.getElementById('location');
const catName = document.getElementById('catName');
const simpleTag = document.getElementById('simpleTag');
const visibility = document.getElementById('visibility');
const ngMemo = document.getElementById('ngMemo');

const setMessage = (text, isError = false) => {
  message.textContent = text;
  message.style.color = isError ? '#b91c1c' : '#166534';
};

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

  const files = mediaFiles ? [...mediaFiles.files] : [];
  if (!files.length) {
    setMessage('画像・動画ファイルを選択してください。', true);
    return;
  }

  try {
    setMessage('Firebase Storage へアセットをアップロード中…');
    
    // 共通アセットとしてアップロード
    const assets = await uploadFiles(files, 'common');
    
    const publishAtVal = publishAtInput?.value ? new Date(publishAtInput.value).toISOString() : null;

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
      assets, // 共通アセット
      publishAt: publishAtVal, // 共通の公開希望日時
      brandSnapshot: {
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
  } catch (error) {
    console.error(error);
    setMessage(error.message || 'エラーが発生しました。', true);
  }
});
