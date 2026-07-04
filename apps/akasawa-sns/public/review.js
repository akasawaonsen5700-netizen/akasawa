const apiBase = '/api';

const queueEl = document.getElementById('queue');
const statusFilter = document.getElementById('statusFilter');
const channelFilter = document.getElementById('channelFilter');
const refreshBtn = document.getElementById('refreshBtn');

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

function renderDrafts(drafts = {}) {
  const parts = Object.entries(drafts).map(([channel, body]) => {
    return `<h4>${channel}</h4><pre>${escapeHtml(body?.text || '')}</pre>`;
  });
  return parts.join('');
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

    return `
      <div style="margin-top: 14px; padding: 14px; border: 1px solid var(--line); border-radius: 12px; background: #fafaf9;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 6px; margin-bottom: 8px;">
          <strong style="color: var(--brand); font-size: 15px;">${escapeHtml(channel.toUpperCase())}</strong>
          <span class="status ${escapeHtml(status)}" style="font-size: 13px;">${escapeHtml(status)}</span>
        </div>
        <p style="margin: 4px 0; font-size: 13px;"><strong>公開予定日時:</strong> ${escapeHtml(publishAt)}</p>
        <div class="asset-grid" style="margin: 8px 0;">
          ${assets.map(renderAsset).join('')}
        </div>
        <p style="margin: 4px 0; font-size: 13px;"><strong>下書きドラフト:</strong></p>
        <pre style="margin: 4px 0 0; font-size: 12px; padding: 10px;">${escapeHtml(draftText)}</pre>
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

async function loadQueue() {
  queueEl.innerHTML = '<div class="card">読み込み中…</div>';
  let rows = [];
  try {
    const res = await fetch(`${apiBase}/list-submissions`);
    if (!res.ok) {
      throw new Error('一覧の取得に失敗しました');
    }
    const data = await res.json();
    rows = data.submissions || [];
  } catch (error) {
    console.error(error);
    queueEl.innerHTML = `<div class="card" style="color: #b91c1c;">エラー: ${escapeHtml(error.message)}</div>`;
    return;
  }

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
            <strong>${escapeHtml(row.id)}</strong>
            <div class="small">${escapeHtml(row.location || '場所未入力')} / ${(row.channels || []).join(', ')}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="delete-btn" data-id="${row.id}" style="padding: 4px 10px; background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">🗑️ 削除</button>
            <div class="status ${escapeHtml(row.status || 'draft')}">${escapeHtml(row.status || 'draft')}</div>
          </div>
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
            <button class="warn" data-action="regenerate" data-id="${row.id}">再生成</button>
            <button class="danger" data-action="reject" data-id="${row.id}">却下</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

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

  // 投稿データの削除
  [...queueEl.querySelectorAll('.delete-btn')].forEach(button => {
    button.addEventListener('click', async () => {
      const { id } = button.dataset;
      if (!confirm('この投稿ドラフトデータを完全に削除します。よろしいですか？\n※動画や音声データ、承認履歴を含むすべての情報が削除されます。')) return;
      
      try {
        button.disabled = true;
        button.textContent = '削除中...';
        const response = await fetch(`${apiBase}/delete-submission`, {
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

refreshBtn.addEventListener('click', loadQueue);
statusFilter.addEventListener('change', loadQueue);
channelFilter.addEventListener('change', loadQueue);
loadQueue();
