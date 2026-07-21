const STORAGE_KEYS = {
  customers: 'akasawa_demo_customers',
  logs: 'akasawa_demo_logs'
};

const state = {
  scenario: 'custom',
  customers: load(STORAGE_KEYS.customers, []),
  logs: load(STORAGE_KEYS.logs, [])
};

let currentMode = 'csv';

const templates = {
  seasonal: {
    emailSubject: '【赤沢温泉旅館】季節のお便り',
    message: ({ greeting }) =>
      `${greeting}\n\n平素より赤沢温泉旅館をご愛顧いただき、誠にありがとうございます。\n\n季節の変わり目となりましたが、いかがお過ごしでしょうか。\n当館の看板猫たちも、ぽかぽかとした日差しの中、のんびりと日向ぼっこを楽しんでおります。\n\n豊かな自然と、じんわり温まる「ぬる湯」をご用意してお待ちしております。\nぜひまた、日常の喧騒を離れて静かな時間をお過ごしにいらしてください。\n\nご予約・お問い合わせは下記より承ります。\nhttps://akasawaonsen.com/`
  },
  special_plan: {
    emailSubject: '【赤沢温泉旅館】LINE・メルマガ会員様限定 特別プランのご案内',
    message: ({ greeting }) =>
      `${greeting}\n\nいつも赤沢温泉旅館をご利用いただきありがとうございます。\n\n本日は、過去にご宿泊いただいたお客様限定の「特別プラン」のご案内です。\n\n【会員様限定特典】\n・アーリーチェックイン（14:00〜）無料\n・夕食時のドリンク1杯サービス\n\nご希望の日程が埋まってしまう前に、ぜひ下記より詳細をご確認くださいませ。\nご来館を心よりお待ち申し上げております。\n\nhttps://akasawaonsen.com/`
  },
  re_engagement: {
    emailSubject: '【赤沢温泉旅館】ご無沙汰しております。いかがお過ごしでしょうか',
    message: ({ greeting }) =>
      `${greeting}\n\n赤沢温泉旅館でございます。\n前回のご宿泊からしばらく経ちましたが、その後いかがお過ごしでしょうか。\n\n当館の「ぬる湯」は、長湯することで心身の疲れをじんわりと癒やす効果がございます。\n日々のお疲れが溜まっているようでしたら、ぜひまた当館の温泉と猫たちに癒やされにお越しください。\n\nまたお目にかかれる日を、スタッフ・猫一同、楽しみにお待ち申し上げております。\n\nhttps://akasawaonsen.com/`
  },
  custom: {
    emailSubject: '',
    message: ({ greeting }) => `${greeting}`
  }
};

const isSubdir = window.location.pathname.includes('/akasawa-ml');
const SIGNATURE = `
------------------------------
赤沢温泉株式会社/赤沢温泉旅館 遠藤正俊
〒329-2921 栃木県那須塩原市塩原1149
TEL: 0287-46-5700　FAX：0287-46-5699
公式サイト：https://akasawaonsen.com/
------------------------------
※メール配信の停止（もういらない）をご希望の方は、下記URLよりお手続きをお願いいたします。
${window.location.origin}${isSubdir ? '/akasawa-ml' : ''}/unsubscribe.html`;

const el = {
  tabCsv: document.getElementById('tabCsv'),
  tabManual: document.getElementById('tabManual'),
  modeCsv: document.getElementById('modeCsv'),
  modeManual: document.getElementById('modeManual'),
  
  customerForm: document.getElementById('customerForm'),
  customerTableBody: document.getElementById('customerTableBody'),
  customerTableContainer: document.getElementById('customerTableContainer'),
  customerSummary: document.getElementById('customerSummary'),
  toggleCustomerListBtn: document.getElementById('toggleCustomerListBtn'),
  logList: document.getElementById('logList'),
  csvFile: document.getElementById('csvFile'),
  searchInput: document.getElementById('searchInput'),
  tagFilter: document.getElementById('tagFilter'),
  csvFilter: document.getElementById('csvFilter'),
  manualEmail: document.getElementById('manualEmail'),
  manualLineId: document.getElementById('manualLineId'),
  manualUnsubscribed: document.getElementById('manualUnsubscribed'),
  manualUnsubAlert: document.getElementById('manualUnsubAlert'),
  manualResubscribeBtn: document.getElementById('manualResubscribeBtn'),
  selectAll: document.getElementById('selectAll'),
  previewBtn: document.getElementById('previewBtn'),
  dispatchBtn: document.getElementById('dispatchBtn'),
  previewBox: document.getElementById('previewBox'),
  channelSelect: document.getElementById('channelSelect'),
  customSubject: document.getElementById('customSubject'),
  customMessage: document.getElementById('customMessage'),
  seedBtn: document.getElementById('seedBtn'),
  clearBtn: document.getElementById('clearBtn'),
  clearPreviewBtn: document.getElementById('clearPreviewBtn'),
  downloadSampleBtn: document.getElementById('downloadSampleBtn'),
  logItemTemplate: document.getElementById('logItemTemplate')
};

// タブ切り替え処理
el.tabCsv.addEventListener('click', () => setMode('csv'));
el.tabManual.addEventListener('click', () => setMode('manual'));

function setMode(mode) {
  currentMode = mode;
  if (mode === 'csv') {
    el.tabCsv.classList.remove('ghost');
    el.tabCsv.style.border = 'none';
    el.tabManual.classList.add('ghost');
    el.tabManual.style.border = '1px solid var(--line)';
    
    el.modeCsv.style.display = 'contents';
    el.modeManual.style.display = 'none';
  } else {
    el.tabManual.classList.remove('ghost');
    el.tabManual.style.border = 'none';
    el.tabCsv.classList.add('ghost');
    el.tabCsv.style.border = '1px solid var(--line)';
    
    el.modeManual.style.display = 'contents';
    el.modeCsv.style.display = 'none';
  }
  preview();
}

// 入力フォームの変更時にプレビューを更新
el.customerForm.addEventListener('input', () => {
  if (currentMode === 'manual') {
    checkManualEmailStatus();
    preview();
  }
});

document.querySelectorAll('.scenario').forEach(btn => {
  btn.addEventListener('click', () => {
    state.scenario = btn.dataset.scenario;
    document.querySelectorAll('.scenario').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    el.customSubject.value = templates[state.scenario].emailSubject;
    preview();
  });
});

document.querySelectorAll('.scenario').forEach(x => x.classList.remove('active'));
document.querySelector(`[data-scenario="${state.scenario}"]`).classList.add('active');
el.customSubject.value = templates[state.scenario].emailSubject;

el.csvFile.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const fileName = file.name;
  const text = await file.text();
  const rows = parseCsv(text).map(row => {
    const mapped = mapJapaneseHeaders(row);
    mapped.importFileName = fileName;
    mapped.importedAt = new Date().toISOString();
    return normalizeCustomer(mapped);
  }).filter(x => x.lastName || x.email || x.lineUserId);
  state.customers = [...rows, ...state.customers];
  persist();
  render();
  alert(`${rows.length}件を取り込みました`);
});

el.searchInput.addEventListener('input', render);
el.tagFilter.addEventListener('change', render);
el.csvFilter.addEventListener('change', render);
el.selectAll.addEventListener('change', () => {
  document.querySelectorAll('.row-select').forEach(cb => cb.checked = el.selectAll.checked);
});

el.toggleCustomerListBtn.addEventListener('click', () => {
  el.customerTableContainer.classList.toggle('hidden');
  const isHidden = el.customerTableContainer.classList.contains('hidden');
  el.toggleCustomerListBtn.textContent = isHidden ? 'リストを確認' : 'リストを隠す';
});

el.previewBtn.addEventListener('click', preview);
el.clearPreviewBtn.addEventListener('click', () => {
  el.previewBox.classList.add('hidden');
  el.previewBox.textContent = '';
});
el.customSubject.addEventListener('input', preview);
el.customMessage.addEventListener('input', preview);
el.dispatchBtn.addEventListener('click', dispatchMessages);
el.seedBtn.addEventListener('click', seedCustomers);
el.clearBtn.addEventListener('click', clearAll);
el.downloadSampleBtn.addEventListener('click', downloadSampleCsv);
el.manualResubscribeBtn.addEventListener('click', handleManualResubscribe);

el.customerTableBody.addEventListener('click', e => {
  if (e.target.classList.contains('delete-customer-btn')) {
    const id = e.target.dataset.id;
    deleteCustomer(id);
  } else if (e.target.classList.contains('toggle-subscribe-btn')) {
    const id = e.target.dataset.id;
    toggleSubscription(id);
  } else if (e.target.classList.contains('dispatch-single-btn')) {
    const id = e.target.dataset.id;
    dispatchSingleMessage(id);
  }
});

el.logList.addEventListener('click', e => {
  if (e.target.classList.contains('delete-log-btn')) {
    const i = parseInt(e.target.dataset.index, 10);
    state.logs.splice(i, 1);
    persist();
    renderLogs();
  }
});

function preview() {
  const targets = getTargets();
  if (!targets.length) {
    el.previewBox.classList.remove('hidden');
    el.previewBox.textContent = '対象顧客がいません。手入力モードの場合はメールアドレスまたはLINE IDを入力してください。';
    return;
  }
  const message = buildMessage(targets[0]);
  el.previewBox.classList.remove('hidden');
  el.previewBox.textContent = `件名: ${message.subject}\n\n${message.body}`;
}

async function dispatchMessages() {
  const targets = getTargets();
  if (!targets.length) return alert('対象顧客がいません。手入力の場合はメールアドレスまたはLINE IDが必須です。');

  el.dispatchBtn.disabled = true;
  el.dispatchBtn.textContent = '配信中...';

  try {
    if (currentMode === 'csv') {
      const chunkSize = 100;
      for (let i = 0; i < targets.length; i += chunkSize) {
        const chunk = targets.slice(i, i + chunkSize);
        el.dispatchBtn.textContent = `一括配信中... (${i + 1}〜${Math.min(i + chunkSize, targets.length)} / ${targets.length})`;
        
        const payloads = chunk.map(customer => {
          const msg = buildMessage(customer);
          return {
            email: customer.email,
            lineUserId: customer.lineUserId,
            subject: msg.subject,
            message: msg.body,
            customerName: fullName(customer)
          };
        });

        const res = await fetch('/api/dispatch-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payloads,
            scenario: state.scenario,
            channel: el.channelSelect.value
          })
        });

        const result = await res.json();
        if (!res.ok || !result.ok) throw new Error(result.error || JSON.stringify(result));

        let errLog = '';
        if (result.results) {
          const skipped = new Set();
          const failed = new Set();
          result.results.forEach(r => {
            if (r.skippedNames) r.skippedNames.forEach(n => skipped.add(n));
            if (r.failedNames) r.failedNames.forEach(n => failed.add(n));
          });
          
          if (failed.size > 0 || skipped.size > 0) {
            errLog += '\n\n❌ 以下の宛先には送信できませんでした:\n';
            failed.forEach(n => errLog += `・${n} (送信エラー)\n`);
            skipped.forEach(n => errLog += `・${n} (宛先アドレスなし)\n`);
          }
        }

        state.logs.unshift({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          customerName: `【一括配信】${chunk.length}件のバッチ送信`,
          scenario: state.scenario,
          channel: el.channelSelect.value,
          status: (errLog ? 'error' : 'success'),
          response: result,
          message: `【件名】${payloads[0]?.subject}\n\n...（他 ${chunk.length}件一括送信）${errLog}`
        });
        persist();
        renderLogs();
      }
      alert(`${targets.length}件のバッチ配信処理をすべて完了しました`);
    } else {
      // Manual Mode
      const customer = targets[0];
      const message = buildMessage(customer);
      const payload = {
        customer,
        scenario: state.scenario,
        channel: el.channelSelect.value,
        subject: message.subject,
        message: message.body
      };
      
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || JSON.stringify(result));
      }
      
      state.logs.unshift({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        customerName: fullName(customer),
        scenario: state.scenario,
        channel: el.channelSelect.value,
        status: result.ok ? 'success' : 'error',
        response: result,
        message: message.body
      });
      
      persist();
      renderLogs();
      alert(`個別手入力での配信が完了しました`);
      el.customerForm.reset();
      preview(); // reset preview
    }
  } catch (err) {
    alert(`配信エラー: ${err.message}`);
  } finally {
    el.dispatchBtn.disabled = false;
    el.dispatchBtn.textContent = '配信実行';
  }
}

function getTargets() {
  if (currentMode === 'manual') {
    const fd = new FormData(el.customerForm);
    const customer = normalizeCustomer(Object.fromEntries(fd.entries()));
    if (!customer.email && !customer.lineUserId) return [];
    if (customer.unsubscribed) return []; // 配信停止の場合は送信対象外
    return [customer];
  } else {
    // 常にチェックボックスの状態（絞り込み時は絞り込まれた結果）を正とする
    const selectedIds = [...document.querySelectorAll('.row-select:checked')].map(x => x.value);
    return state.customers.filter(c => selectedIds.includes(c.id) && !c.unsubscribed);
  }
}

function buildMessage(customer) {
  const tpl = templates[state.scenario];
  const name = fullName(customer);
  const customerWithFullName = {
    ...customer,
    name,
    greeting: name === '赤沢温泉旅館ご利用者様' ? '赤沢温泉旅館ご利用者様' : `${name} 様`
  };
  const tplMsg = tpl.message(customerWithFullName);
  const customMsg = el.customMessage.value;
  const body = [tplMsg, customMsg].filter(Boolean).join('\n\n') + '\n' + SIGNATURE;
  const subject = el.customSubject.value.trim() || tpl.emailSubject;
  return { subject, body };
}

function render() {
  renderCustomers();
  renderLogs();
  renderTagFilter();
  renderCsvFilter();
}

function renderCustomers() {
  const list = filteredCustomers();
  el.customerSummary.textContent = `${state.customers.length}件 読み込み済み`;
  
  el.customerTableBody.innerHTML = list.map(customer => {
    const isUnsubscribed = !!customer.unsubscribed;
    
    // 左端のチェックボックス列: 配信停止の場合は「復活する」ボタンにする
    const checkboxHtml = isUnsubscribed 
      ? `<button class="danger toggle-subscribe-btn" data-id="${customer.id}" style="background-color:#d32f2f; color:white; font-size:10px; padding: 4px 8px; border:none; border-radius: 4px; display: inline-block; cursor:pointer; width:auto; font-weight:bold; min-height:0; white-space:nowrap;">配信停止(復活する)</button>`
      : `<input class="row-select" type="checkbox" value="${customer.id}" checked />`;
    
    const sendBtnHtml = isUnsubscribed
      ? `<button class="ghost" disabled style="padding: 2px 8px; font-size: 11px; margin: 0; min-height: 0; white-space: nowrap; opacity: 0.5; cursor: not-allowed; border: 1px solid var(--line);">送信</button>`
      : `<button class="primary dispatch-single-btn" data-id="${customer.id}" style="padding: 2px 8px; font-size: 11px; margin: 0; min-height: 0; white-space: nowrap; background: linear-gradient(90deg, #33a0ff 0%, #6ad2ff 100%); color: #04111d;">送信</button>`;

    return `
      <tr style="${isUnsubscribed ? 'opacity: 0.7; background-color: #fafafa;' : ''}">
        <td style="vertical-align: middle; text-align: center;">${checkboxHtml}</td>
        <td>${escapeHtml(fullName(customer))}</td>
        <td>${escapeHtml(customer.source || '-')}</td>
        <td style="${isUnsubscribed ? 'color: #aebad8;' : ''}">${escapeHtml(customer.email || customer.lineUserId || customer.phone || '-')}</td>
        <td>${escapeHtml(fmtDate(customer.checkInDate))} ~ ${escapeHtml(fmtDate(customer.checkOutDate))}</td>
        <td>${customer.tags.map(tag => `<span class="badge">${escapeHtml(tag)}</span>`).join(' ')}</td>
        <td>${Number(customer.stayCount || 0)}</td>
        <td>
          <div style="display:flex; gap:4px;">
            ${sendBtnHtml}
            <button class="ghost toggle-subscribe-btn" data-id="${customer.id}" style="padding: 2px 8px; font-size: 11px; margin: 0; min-height: 0; white-space: nowrap; border: 1px solid var(--line);">
              ${isUnsubscribed ? '購読再開' : '配信停止'}
            </button>
            <button class="danger delete-customer-btn" data-id="${customer.id}" style="padding: 2px 8px; font-size: 11px; margin: 0; min-height: 0; white-space: nowrap;">削除</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderLogs() {
  if (state.logs.length === 0) { el.logList.innerHTML = '<p class="text-secondary text-sm">履歴はありません。</p>'; return; }
  el.logList.innerHTML = state.logs.map((log, i) => `
    <div class="card bg-gray-50 text-sm" style="margin-bottom: 8px;">
      <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
        <strong>${escapeHtml(log.customerName)} / ${labelScenario(log.scenario)} / ${log.channel}</strong>
        <div>
          <span class="text-xs" style="color: ${log.status === 'success' ? '#2e7d32' : '#d32f2f'}; margin-right: 8px;">${log.status}</span>
          <button class="danger delete-log-btn" data-index="${i}" style="padding: 2px 6px; font-size: 10px; min-height: 0;">削除</button>
        </div>
      </div>
      <div class="text-xs text-secondary">${new Date(log.createdAt).toLocaleString('ja-JP')}</div>
      <div style="white-space: pre-wrap; font-size: 12px; margin-top: 4px; border-top: 1px solid #ddd; padding-top: 4px;">${escapeHtml(log.message)}</div>
    </div>
  `).join('');
}

function renderTagFilter() {
  const current = el.tagFilter.value;
  const tags = [...new Set(state.customers.flatMap(c => c.tags))].filter(Boolean).sort();
  el.tagFilter.innerHTML = `<option value="">全タグ</option>${tags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('')}`;
  el.tagFilter.value = tags.includes(current) ? current : '';
}

function filteredCustomers() {
  const q = el.searchInput.value.trim().toLowerCase();
  const tag = el.tagFilter.value;
  const csvFile = el.csvFilter.value;
  return state.customers.filter(c => {
    const hay = `${fullName(c)} ${c.email || ''} ${c.lineUserId || ''} ${c.tags.join(' ')}`.toLowerCase();
    const matchQ = !q || hay.includes(q);
    const matchTag = !tag || c.tags.includes(tag);
    const matchCsv = !csvFile || c.importFileName === csvFile;
    return matchQ && matchTag && matchCsv;
  });
}

function seedCustomers() {
  const today = new Date();
  const addDays = n => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);
  const seeds = [
    normalizeCustomer({ source: 'staysee', lastName: '山田', firstName: '花', email: 'hana@example.com', lineUserId: 'U-demo-hana', language: 'ja', tags: '猫好き,女性ひとり旅', checkInDate: addDays(3), checkOutDate: addDays(4), reservationId: 'ST-1001', stayCount: 2, importFileName: 'sample_staysee.csv' }),
    normalizeCustomer({ source: 'neppan', lastName: '佐藤', firstName: '健', email: 'ken@example.com', lineUserId: 'U-demo-ken', language: 'ja', tags: '長湯好き,静かな部屋希望', checkInDate: addDays(7), checkOutDate: addDays(8), reservationId: 'NP-2001', stayCount: 1, importFileName: 'sample_neppan.csv' }),
    normalizeCustomer({ source: 'staysee', lastName: '鈴木', firstName: '一郎', email: 'ichiro@example.com', lineUserId: 'U-demo-ichiro', language: 'ja', tags: 'リピーター', checkInDate: addDays(1), checkOutDate: addDays(2), reservationId: 'ST-0999', stayCount: 5, unsubscribed: true, importFileName: 'sample_staysee.csv' })
  ];
  state.customers = [...seeds, ...state.customers];
  persist();
  render();
}

function clearAll() {
  if (!confirm('本当に全データを削除しますか？')) return;
  state.customers = [];
  state.logs = [];
  persist();
  render();
}

function downloadSampleCsv() {
  const csv = [
    'source,lastName,firstName,email,lineUserId,phone,language,tags,checkInDate,checkOutDate,reservationId,stayCount,unsubscribed',
    'staysee,山田,花,hana@example.com,U-demo-hana,09000000001,ja,"猫好き,女性ひとり旅",2026-07-10,2026-07-11,ST-1001,2,',
    'neppan,佐藤,健,ken@example.com,U-demo-ken,09000000002,ja,"長湯好き,静かな部屋希望",2026-07-15,2026-07-16,NP-2001,1,',
    'staysee,鈴木,一郎,ichiro@example.com,U-demo-ichiro,09000000003,ja,"リピーター",2026-07-18,2026-07-19,ST-0999,5,配信停止'
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'akasawa_customers_sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeCustomer(input) {
  const email = (input.email || '').trim();
  const lineUserId = (input.lineUserId || '').trim();

  // 既存のリスト内に、同一メールアドレスまたはLINE IDで配信停止になっている人がいるか確認
  const isAlreadyUnsubscribed = (typeof state !== 'undefined' && state.customers) && state.customers.some(c => 
    c.unsubscribed && 
    ((email && c.email === email) || (lineUserId && c.lineUserId === lineUserId))
  );

  const inputUnsubscribed = input.unsubscribed === true || 
    String(input.unsubscribed || '').toLowerCase() === 'true' || 
    String(input.unsubscribed || '') === '1' || 
    String(input.unsubscribed || '').includes('停止') || 
    String(input.unsubscribed || '').includes('不要') || 
    String(input.unsubscribed || '').includes('いらない');

  return {
    id: input.id || crypto.randomUUID(),
    source: (input.source || 'manual').trim(),
    lastName: (input.lastName || '').trim(),
    firstName: (input.firstName || '').trim(),
    email,
    lineUserId,
    phone: (input.phone || '').trim(),
    language: (input.language || 'ja').trim(),
    tags: Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(',').map(x => x.trim()).filter(Boolean),
    checkInDate: input.checkInDate || '',
    checkOutDate: input.checkOutDate || '',
    reservationId: (input.reservationId || '').trim(),
    stayCount: Number(input.stayCount || 0),
    unsubscribed: isAlreadyUnsubscribed || inputUnsubscribed,
    importFileName: input.importFileName || '',
    importedAt: input.importedAt || ''
  };
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  
  const firstLineStr = lines[0].toLowerCase();
  const hasKnownHeader = firstLineStr.includes('メール') || firstLineStr.includes('email') || firstLineStr.includes('名前') || firstLineStr.includes('姓') || firstLineStr.includes('名');
  const hasAtSymbol = firstLineStr.includes('@');
  const isHeaderless = !hasKnownHeader && hasAtSymbol;

  if (isHeaderless) {
    return lines.map(line => {
      const cols = splitCsvLine(line);
      const email = cols.find(c => c.includes('@')) || '';
      const name = cols.find(c => c !== email && c.match(/[^\x01-\x7E]/)) || cols.find(c => c !== email && c.match(/[a-zA-Z]/)) || '';
      return {
        'メールアドレス': email,
        '氏名': name
      };
    });
  }

  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const cols = splitCsvLine(line);
    return headers.reduce((acc, header, idx) => {
      acc[header] = cols[idx] || '';
      return acc;
    }, {});
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function persist() {
  localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(state.customers));
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(state.logs));
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function fullName(customer) { return `${customer.lastName || ''} ${customer.firstName || ''}`.trim() || '赤沢温泉旅館ご利用者様'; }
function fmtDate(value) { return value ? new Date(value).toLocaleDateString('ja-JP') : '-'; }
function labelScenario(key) {
  return ({ seasonal: '季節のお便り', special_plan: '特別プラン', re_engagement: 'ご無沙汰', custom: '自由入力' })[key] || key;
}
function escapeHtml(str) {
  return String(str).replace(/[&<>\"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

function mapJapaneseHeaders(row) {
  const mapping = {
    lastName: ['姓', '名字', '苗字', '氏', 'お名前(姓)', 'last name', 'lastname'],
    firstName: ['名', '名前', 'お名前(名)', 'first name', 'firstname'],
    email: ['メールアドレス', 'メール', 'e-mail', 'email', 'アドレス'],
    phone: ['電話番号', '電話', 'tel', 'phone'],
    lineUserId: ['line', 'lineid', 'lineユーザーid', 'line_user_id'],
    checkInDate: ['チェックイン日', 'チェックイン', 'check-in', 'checkin', '宿泊日', 'ご宿泊日', '宿泊日(開始)', 'ご宿泊日(開始)', 'ご宿泊日(開始日)'],
    checkOutDate: ['チェックアウト日', 'チェックアウト', 'check-out', 'checkout', '宿泊日(終了)', 'ご宿泊日(終了)', '宿泊日(終了日)'],
    reservationId: ['予約番号', '予約id', '予約no', '受付番号', 'reservation_id', 'reservationid'],
    stayCount: ['宿泊回数', '宿泊回数(累計)', '利用回数', '回数', 'stay_count', 'staycount'],
    tags: ['タグ', '属性', 'tags', 'tag'],
    source: ['流入元', '予約経路', 'source'],
    unsubscribed: ['配信停止', '配信除外', '購読解除', 'メール不要', 'unsubscribed', 'optout', '送信不要', 'もういらない', 'オプトアウト']
  };

  const normalizedRow = {};
  
  for (const [engKey, jpKeys] of Object.entries(mapping)) {
    const foundKey = Object.keys(row).find(k => {
      const kl = k.trim().toLowerCase();
      return jpKeys.some(jpKey => 
        kl === jpKey.toLowerCase() || (jpKey.length > 1 && kl.includes(jpKey.toLowerCase()))
      );
    });
    normalizedRow[engKey] = foundKey ? row[foundKey] : '';
  }
  
  if (!normalizedRow.lastName && !normalizedRow.firstName) {
    const nameKeys = ['お名前', '名前', '氏名', '顧客名', 'name'];
    const foundNameKey = Object.keys(row).find(k => {
      const kl = k.trim().toLowerCase();
      return nameKeys.some(nk => kl === nk.toLowerCase() || kl.includes(nk.toLowerCase()));
    });
    if (foundNameKey && row[foundNameKey]) {
      const fullNameVal = row[foundNameKey].trim();
      const parts = fullNameVal.split(/[\s　]+/);
      if (parts.length >= 2) {
        normalizedRow.lastName = parts[0];
        normalizedRow.firstName = parts.slice(1).join(' ');
      } else {
        normalizedRow.lastName = fullNameVal;
        normalizedRow.firstName = '';
      }
    }
  }

  return normalizedRow;
}

function deleteCustomer(id) {
  if (!confirm('この顧客データを削除しますか？')) return;
  state.customers = state.customers.filter(c => c.id !== id);
  persist();
  render();
}

function toggleSubscription(id) {
  const targetCustomer = state.customers.find(c => c.id === id);
  if (!targetCustomer) return;
  
  const targetEmail = targetCustomer.email;
  const targetLineId = targetCustomer.lineUserId;
  const newStatus = !targetCustomer.unsubscribed;
  
  // 同一の連絡先（email / lineUserId）を持つ全ての顧客を連動して切り替える
  state.customers.forEach(c => {
    const matchesEmail = targetEmail && c.email === targetEmail;
    const matchesLine = targetLineId && c.lineUserId === targetLineId;
    if (c.id === id || matchesEmail || matchesLine) {
      c.unsubscribed = newStatus;
    }
  });
  
  persist();
  render();
}

function renderCsvFilter() {
  const current = el.csvFilter.value;
  const fileNames = [...new Set(state.customers.map(c => c.importFileName))].filter(Boolean).sort();
  el.csvFilter.innerHTML = `<option value="">すべてのCSV</option>${fileNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}`;
  el.csvFilter.value = fileNames.includes(current) ? current : '';
}

async function dispatchSingleMessage(id) {
  const customer = state.customers.find(c => c.id === id);
  if (!customer) return;
  if (customer.unsubscribed) {
    alert('配信停止中のお客様には送信できません。');
    return;
  }
  const name = fullName(customer);
  if (!confirm(`${name} 様へ個別に現在のメッセージを送信しますか？`)) return;

  const btn = document.querySelector(`.dispatch-single-btn[data-id="${id}"]`);
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '送信中...';

  try {
    const message = buildMessage(customer);
    const payload = {
      customer,
      scenario: state.scenario,
      channel: el.channelSelect.value,
      subject: message.subject,
      message: message.body
    };
    
    const res = await fetch('/api/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok || !result.ok) throw new Error(result.error || JSON.stringify(result));
    
    state.logs.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      customerName: name,
      scenario: state.scenario,
      channel: el.channelSelect.value,
      status: 'success',
      response: result,
      message: message.body
    });
    persist();
    render();
    alert(`${name} 様への個別送信が完了しました`);
  } catch (err) {
    alert(`個別送信エラー: ${err.message}`);
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function checkManualEmailStatus() {
  const email = el.manualEmail.value.trim();
  const lineUserId = el.manualLineId.value.trim();
  
  if (!email && !lineUserId) {
    el.manualUnsubAlert.style.display = 'none';
    return;
  }
  
  const isAlreadyUnsubscribed = state.customers.some(c => 
    c.unsubscribed && 
    ((email && c.email === email) || (lineUserId && c.lineUserId === lineUserId))
  );
  
  if (isAlreadyUnsubscribed) {
    el.manualUnsubscribed.checked = true;
    el.manualUnsubAlert.style.display = 'flex';
  } else {
    el.manualUnsubAlert.style.display = 'none';
  }
}

function handleManualResubscribe() {
  const email = el.manualEmail.value.trim();
  const lineUserId = el.manualLineId.value.trim();
  
  if (!email && !lineUserId) return;
  
  // 同一の連絡先を持つ全ての既存顧客を復活させる
  state.customers.forEach(c => {
    const matchesEmail = email && c.email === email;
    const matchesLine = lineUserId && c.lineUserId === lineUserId;
    if (matchesEmail || matchesLine) {
      c.unsubscribed = false;
    }
  });
  
  persist();
  render();
  
  el.manualUnsubscribed.checked = false;
  el.manualUnsubAlert.style.display = 'none';
  preview();
  alert('この連絡先の配信停止状態を解除し、配信を復活させました。');
}

render();
setMode('csv');
