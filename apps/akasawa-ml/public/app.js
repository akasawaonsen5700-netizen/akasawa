const STORAGE_KEYS = {
  customers: 'akasawa_demo_customers',
  logs: 'akasawa_demo_logs'
};

const state = {
  scenario: 'custom',
  customers: load(STORAGE_KEYS.customers, []),
  logs: load(STORAGE_KEYS.logs, [])
};

const templates = {
  reservation_confirm: {
    emailSubject: '【赤沢温泉旅館】ご予約ありがとうございます',
    message: ({ greeting, reservationId, checkInDate }) =>
      `${greeting}\n\nご不明な点がございましたら、下記のお問い合わせフォームよりご連絡ください。\nhttps://akasawaonsen.com/inquire/`
  },
  pre_stay_3days: {
    emailSubject: '【赤沢温泉旅館】ご宿泊3日前のご案内',
    message: ({ greeting, checkInDate }) =>
      `${greeting}\n\n${fmtDate(checkInDate)} ご宿泊前のご案内です。\n\n・アクセス方法の最終確認\n・送迎ご希望の方は締切前にご連絡ください\n・猫 / 自然環境 / ぬる湯の特徴を事前にご確認ください\n\n当日はお気をつけてお越しください。\nご質問等ございましたら、下記よりお問い合わせください。\nhttps://akasawaonsen.com/inquire/`
  },
  post_stay_thanks: {
    emailSubject: '【赤沢温泉旅館】ご宿泊ありがとうございました',
    message: ({ greeting }) =>
      `${greeting}\n\nこのたびはご宿泊ありがとうございました。\nご感想をお聞かせいただけると励みになります。\n\nまた、猫とぬる湯と静けさの時間を味わいにいらしてください。\nその他、ご不明点などがございましたら下記よりお問い合わせください。\nhttps://akasawaonsen.com/inquire/`
  },
  repeat_offer: {
    emailSubject: '【赤沢温泉旅館】再訪ご優待のご案内',
    message: ({ greeting, tags }) => {
      const tagText = tags.includes('猫好き') ? '看板猫の近況もぜひお楽しみください。' : tags.includes('長湯好き') ? 'ぬる湯でゆっくり過ごす静養滞在におすすめです。' : '季節の静養滞在をご案内します。';
      return `${greeting}\n\n再訪者さま向けのご案内です。\n${tagText}\n\nLINE登録者限定のご優待や、静かな季節のおすすめ日程もご案内できます。\nお問い合わせやご相談は下記フォームより承ります。\nhttps://akasawaonsen.com/inquire/`;
    }
  },
  custom: {
    emailSubject: '',
    message: () => ''
  }
};

const SIGNATURE = `
------------------------------
赤沢温泉株式会社/赤沢温泉旅館 遠藤正俊
〒329-2921 栃木県那須塩原市塩原1149
TEL: 0287-46-5700　FAX：0287-46-5699
公式サイト：https://akasawaonsen.com/
------------------------------`;

const el = {
  customerForm: document.getElementById('customerForm'),
  customerTableBody: document.getElementById('customerTableBody'),
  customerTableContainer: document.getElementById('customerTableContainer'),
  customerSummary: document.getElementById('customerSummary'),
  toggleCustomerListBtn: document.getElementById('toggleCustomerListBtn'),
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
  customSubject: document.getElementById('customSubject'),
  customMessage: document.getElementById('customMessage'),
  seedBtn: document.getElementById('seedBtn'),
  clearBtn: document.getElementById('clearBtn'),
  clearPreviewBtn: document.getElementById('clearPreviewBtn'),
  downloadSampleBtn: document.getElementById('downloadSampleBtn'),
  logItemTemplate: document.getElementById('logItemTemplate')
};

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

el.customerTableBody.addEventListener('click', e => {
  if (e.target.classList.contains('delete-customer-btn')) {
    const id = e.target.dataset.id;
    deleteCustomer(id);
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
    el.previewBox.textContent = '対象顧客がいません。';
    return;
  }
  const message = buildMessage(targets[0]);
  el.previewBox.classList.remove('hidden');
  el.previewBox.textContent = `件名: ${message.subject}\n\n${message.body}`;
}

async function dispatchMessages() {
  const mode = document.querySelector('input[name="dispatchMode"]:checked').value;
  const targets = mode === 'batch' ? state.customers : getTargets();

  if (!targets.length) return alert('対象顧客がいません');

  el.dispatchBtn.disabled = true;
  el.dispatchBtn.textContent = '配信中...';

  try {
    if (mode === 'batch') {
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
            message: msg.body
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

        state.logs.unshift({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          customerName: `【一括配信】${chunk.length}件のバッチ送信`,
          scenario: state.scenario,
          channel: el.channelSelect.value,
          status: 'success',
          response: result,
          message: `【件名】${payloads[0]?.subject}\n\n...（他 ${chunk.length}件一括送信）`
        });
        persist();
        renderLogs();
      }
      alert(`${targets.length}件のバッチ配信処理をすべて完了しました`);
    } else {
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
        if (!res.ok || !result.ok) {
          console.error('API Dispatch Error Details:', result);
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
        return result;
      });

      await Promise.all(requests);
      persist();
      renderLogs();
      alert(`${targets.length}件の個別配信処理を実行しました`);
    }
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
}

function renderCustomers() {
  const list = filteredCustomers();
  el.customerSummary.textContent = `${state.customers.length}件 読み込み済み`;
  
  // if list > 500, maybe warning or just render it. The browser can handle 5000 rows.
  el.customerTableBody.innerHTML = list.map(customer => `
    <tr>
      <td><input class="row-select" type="checkbox" value="${customer.id}" /></td>
      <td>${escapeHtml(fullName(customer))}</td>
      <td>${escapeHtml(customer.source || '-')}</td>
      <td>${escapeHtml(customer.email || customer.lineUserId || customer.phone || '-')}</td>
      <td>${escapeHtml(fmtDate(customer.checkInDate))} ~ ${escapeHtml(fmtDate(customer.checkOutDate))}</td>
      <td>${customer.tags.map(tag => `<span class="badge">${escapeHtml(tag)}</span>`).join(' ')}</td>
      <td>${Number(customer.stayCount || 0)}</td>
      <td><button class="danger delete-customer-btn" data-id="${customer.id}" style="padding: 2px 8px; font-size: 11px; margin: 0;">削除</button></td>
    </tr>
  `).join('');
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
  return ({ reservation_confirm: '予約直後', pre_stay_3days: '宿泊3日前', post_stay_thanks: '宿泊翌日', repeat_offer: '再訪促進', custom: '自由入力' })[key] || key;
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
      // 1文字のキー（「姓」「名」「氏」など）は完全一致のみを許可し、誤爆（「氏名」が「氏」と「名」両方に一致してしまう等）を防ぐ
      return jpKeys.some(jpKey => 
        kl === jpKey.toLowerCase() || (jpKey.length > 1 && kl.includes(jpKey.toLowerCase()))
      );
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

function deleteCustomer(id) {
  if (!confirm('この顧客データを削除しますか？')) return;
  state.customers = state.customers.filter(c => c.id !== id);
  persist();
  render();
}

render();
preview();
