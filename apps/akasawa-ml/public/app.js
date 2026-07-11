const STORAGE_KEYS = {
  customers: 'akasawa_demo_customers',
  logs: 'akasawa_demo_logs'
};

const state = {
  scenario: 'reservation_confirm',
  customers: load(STORAGE_KEYS.customers, []),
  logs: load(STORAGE_KEYS.logs, [])
};

const templates = {
  reservation_confirm: {
    emailSubject: '【赤沢温泉旅館】ご予約ありがとうございます',
    message: ({ name, reservationId, checkInDate }) =>
      `${name} 様\n\nご予約ありがとうございます。\n予約番号: ${reservationId || '未設定'}\nご宿泊日: ${fmtDate(checkInDate)}\n\n当館は「猫 × ぬる湯 × 渓流 × 静養」が特徴の宿です。\n・天然ぬる湯（38〜40℃前後）\n・猫が館内におります\n・送迎は事前予約制です\n・最終バス時刻は事前確認をお願いします\n\nご不明点があればご連絡ください。\n赤沢温泉旅館`
  },
  pre_stay_3days: {
    emailSubject: '【赤沢温泉旅館】ご宿泊3日前のご案内',
    message: ({ name, checkInDate }) =>
      `${name} 様\n\n${fmtDate(checkInDate)} ご宿泊前のご案内です。\n\n・アクセス方法の最終確認\n・送迎ご希望の方は締切前にご連絡ください\n・猫 / 自然環境 / ぬる湯の特徴を事前にご確認ください\n\n当日はお気をつけてお越しください。\n赤沢温泉旅館`
  },
  post_stay_thanks: {
    emailSubject: '【赤沢温泉旅館】ご宿泊ありがとうございました',
    message: ({ name }) =>
      `${name} 様\n\nこのたびはご宿泊ありがとうございました。\nご感想をお聞かせいただけると励みになります。\n\nまた、猫とぬる湯と静けさの時間を味わいにいらしてください。\n赤沢温泉旅館`
  },
  repeat_offer: {
    emailSubject: '【赤沢温泉旅館】再訪ご優待のご案内',
    message: ({ name, tags }) => {
      const tagText = tags.includes('猫好き') ? '看板猫の近況もぜひお楽しみください。' : tags.includes('長湯好き') ? 'ぬる湯でゆっくり過ごす静養滞在におすすめです。' : '季節の静養滞在をご案内します。';
      return `${name} 様\n\n再訪者さま向けのご案内です。\n${tagText}\n\nLINE登録者限定のご優待や、静かな季節のおすすめ日程もご案内できます。\n赤沢温泉旅館`;
    }
  }
};

const el = {
  customerForm: document.getElementById('customerForm'),
  customerTableBody: document.getElementById('customerTableBody'),
  logList: document.getElementById('logList'),
  csvFile: document.getElementById('csvFile'),
  searchInput: document.getElementById('searchInput'),
  tagFilter: document.getElementById('tagFilter'),
  selectAll: document.getElementById('selectAll'),
  previewBtn: document.getElementById('previewBtn'),
  dispatchBtn: document.getElementById('dispatchBtn'),
  previewBox: document.getElementById('previewBox'),
  channelSelect: document.getElementById('channelSelect'),
  audienceSelect: document.getElementById('audienceSelect'),
  customMessage: document.getElementById('customMessage'),
  seedBtn: document.getElementById('seedBtn'),
  clearBtn: document.getElementById('clearBtn'),
  downloadSampleBtn: document.getElementById('downloadSampleBtn'),
  logItemTemplate: document.getElementById('logItemTemplate')
};

document.querySelectorAll('.scenario').forEach(btn => {
  btn.addEventListener('click', () => {
    state.scenario = btn.dataset.scenario;
    document.querySelectorAll('.scenario').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    preview();
  });
});

document.querySelector('.scenario').classList.add('active');

el.customerForm.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(el.customerForm);
  const customer = normalizeCustomer(Object.fromEntries(fd.entries()));
  state.customers.unshift(customer);
  persist();
  el.customerForm.reset();
  el.customerForm.source.value = 'manual';
  el.customerForm.language.value = 'ja';
  render();
});

el.csvFile.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = parseCsv(text).map(row => {
    const mapped = mapJapaneseHeaders(row);
    return normalizeCustomer(mapped);
  }).filter(x => x.lastName || x.email || x.lineUserId);
  state.customers = [...rows, ...state.customers];
  persist();
  render();
  alert(`${rows.length}件を取り込みました`);
});

el.searchInput.addEventListener('input', render);
el.tagFilter.addEventListener('change', render);
el.selectAll.addEventListener('change', () => {
  document.querySelectorAll('.row-select').forEach(cb => cb.checked = el.selectAll.checked);
});

el.previewBtn.addEventListener('click', preview);
el.dispatchBtn.addEventListener('click', dispatchMessages);
el.seedBtn.addEventListener('click', seedCustomers);
el.clearBtn.addEventListener('click', clearAll);
el.downloadSampleBtn.addEventListener('click', downloadSampleCsv);

function preview() {
  const targets = getTargets();
  if (!targets.length) {
    el.previewBox.classList.remove('hidden');
    el.previewBox.textContent = '対象顧客がいません。';
    return;
  }
  const message = buildMessage(targets[0]);
  el.previewBox.classList.remove('hidden');
  el.previewBox.textContent = `件名: ${message.subject}\n\n${message.body}`;
}

async function dispatchMessages() {
  const targets = getTargets();
  if (!targets.length) return alert('対象顧客がいません');

  el.dispatchBtn.disabled = true;
  el.dispatchBtn.textContent = '配信中...';

  try {
    const requests = targets.map(async customer => {
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
      return result;
    });

    await Promise.all(requests);
    persist();
    renderLogs();
    alert(`${targets.length}件の配信処理を実行しました`);
  } catch (err) {
    alert(`配信エラー: ${err.message}`);
  } finally {
    el.dispatchBtn.disabled = false;
    el.dispatchBtn.textContent = '配信実行';
  }
}

function getTargets() {
  const audience = el.audienceSelect.value;
  if (audience === 'all') return filteredCustomers();
  const selectedIds = [...document.querySelectorAll('.row-select:checked')].map(x => x.value);
  if (selectedIds.length) return state.customers.filter(c => selectedIds.includes(c.id));
  return filteredCustomers();
}

function buildMessage(customer) {
  const tpl = templates[state.scenario];
  const body = `${tpl.message(customer)}${el.customMessage.value ? `\n\n${el.customMessage.value}` : ''}`;
  return { subject: tpl.emailSubject, body };
}

function render() {
  renderCustomers();
  renderLogs();
  renderTagFilter();
}

function renderCustomers() {
  const list = filteredCustomers();
  el.customerTableBody.innerHTML = list.map(customer => `
    <tr>
      <td><input class="row-select" type="checkbox" value="${customer.id}" /></td>
      <td>${escapeHtml(fullName(customer))}</td>
      <td>${escapeHtml(customer.source || '-')}</td>
      <td>${escapeHtml(customer.email || customer.lineUserId || customer.phone || '-')}</td>
      <td>${escapeHtml(fmtDate(customer.checkInDate))} ~ ${escapeHtml(fmtDate(customer.checkOutDate))}</td>
      <td>${customer.tags.map(tag => `<span class="badge">${escapeHtml(tag)}</span>`).join(' ')}</td>
      <td>${Number(customer.stayCount || 0)}</td>
    </tr>
  `).join('');
}

function renderLogs() {
  el.logList.innerHTML = '';
  state.logs.slice(0, 30).forEach(log => {
    const node = el.logItemTemplate.content.cloneNode(true);
    node.querySelector('.log-title').textContent = `${log.customerName} / ${labelScenario(log.scenario)} / ${log.channel}`;
    node.querySelector('.log-status').textContent = log.status;
    node.querySelector('.log-meta').textContent = new Date(log.createdAt).toLocaleString('ja-JP');
    node.querySelector('.log-body').textContent = log.message;
    el.logList.appendChild(node);
  });
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
  return state.customers.filter(c => {
    const hay = `${fullName(c)} ${c.email || ''} ${c.lineUserId || ''} ${c.tags.join(' ')}`.toLowerCase();
    const matchQ = !q || hay.includes(q);
    const matchTag = !tag || c.tags.includes(tag);
    return matchQ && matchTag;
  });
}

function seedCustomers() {
  const today = new Date();
  const addDays = n => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);
  const seeds = [
    normalizeCustomer({ source: 'staysee', lastName: '山田', firstName: '花', email: 'hana@example.com', lineUserId: 'U-demo-hana', language: 'ja', tags: '猫好き,女性ひとり旅', checkInDate: addDays(3), checkOutDate: addDays(4), reservationId: 'ST-1001', stayCount: 2 }),
    normalizeCustomer({ source: 'neppan', lastName: '佐藤', firstName: '健', email: 'ken@example.com', lineUserId: 'U-demo-ken', language: 'ja', tags: '長湯好き,静かな部屋希望', checkInDate: addDays(7), checkOutDate: addDays(8), reservationId: 'NP-2001', stayCount: 1 }),
    normalizeCustomer({ source: 'manual', lastName: 'Wang', firstName: 'Li', email: 'li@example.com', lineUserId: '', language: 'zh', tags: 'inbound,repeat', checkInDate: addDays(-2), checkOutDate: addDays(-1), reservationId: 'IN-3001', stayCount: 3 })
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
    'source,lastName,firstName,email,lineUserId,phone,language,tags,checkInDate,checkOutDate,reservationId,stayCount',
    'staysee,山田,花,hana@example.com,U-demo-hana,09000000001,ja,"猫好き,女性ひとり旅",2026-07-10,2026-07-11,ST-1001,2',
    'neppan,佐藤,健,ken@example.com,U-demo-ken,09000000002,ja,"長湯好き,静かな部屋希望",2026-07-15,2026-07-16,NP-2001,1'
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
  return {
    id: input.id || crypto.randomUUID(),
    source: (input.source || 'manual').trim(),
    lastName: (input.lastName || '').trim(),
    firstName: (input.firstName || '').trim(),
    email: (input.email || '').trim(),
    lineUserId: (input.lineUserId || '').trim(),
    phone: (input.phone || '').trim(),
    language: (input.language || 'ja').trim(),
    tags: Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(',').map(x => x.trim()).filter(Boolean),
    checkInDate: input.checkInDate || '',
    checkOutDate: input.checkOutDate || '',
    reservationId: (input.reservationId || '').trim(),
    stayCount: Number(input.stayCount || 0)
  };
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
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

function fullName(customer) { return `${customer.lastName || ''} ${customer.firstName || ''}`.trim() || '名称未設定'; }
function fmtDate(value) { return value ? new Date(value).toLocaleDateString('ja-JP') : '-'; }
function labelScenario(key) {
  return ({ reservation_confirm: '予約直後', pre_stay_3days: '宿泊3日前', post_stay_thanks: '宿泊翌日', repeat_offer: '再訪促進' })[key] || key;
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
    source: ['流入元', '予約経路', 'source']
  };

  const normalizedRow = {};
  
  for (const [engKey, jpKeys] of Object.entries(mapping)) {
    const foundKey = Object.keys(row).find(k => {
      const kl = k.trim().toLowerCase();
      return jpKeys.some(jpKey => kl === jpKey.toLowerCase() || kl.includes(jpKey.toLowerCase()));
    });
    normalizedRow[engKey] = foundKey ? row[foundKey] : '';
  }
  
  // 姓名が「名前」「氏名」として1つのカラムに入っている場合のフォールバック分割処理
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

render();
preview();
