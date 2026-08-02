const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'apps', 'akasawa-ml', 'public', 'app.js');
const rawContent = fs.readFileSync(filePath, 'utf8');

const isCRLF = rawContent.includes('\r\n');
let content = rawContent.replace(/\r\n/g, '\n');

// 置換対象の try 内の if (currentMode === 'csv') から else 手前まで
const target = `  try {
    if (currentMode === 'csv') {
      const chunkSize = 100;
      for (let i = 0; i < targets.length; i += chunkSize) {
        const chunk = targets.slice(i, i + chunkSize);
        el.dispatchBtn.textContent = \`一括配信中... (\${i + 1}〜\${Math.min(i + chunkSize, targets.length)} / \${targets.length})\`;
        
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

        let res;
        let result;
        try {
          res = await fetch('/api/dispatch-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payloads,
              scenario: state.scenario,
              channel: el.channelSelect.value
            })
          });
          result = await res.json();
        } catch (fetchErr) {
          // 通信・サーバー障害等の致命的エラーもログとして画面に残す
          state.logs.unshift({
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            customerName: \`【配信失敗】\${chunk.length}件の送信エラー\`,
            scenario: state.scenario,
            channel: el.channelSelect.value,
            status: 'error',
            totalCount: chunk.length,
            unreachedCount: chunk.length,
            unreachedDetails: chunk.map(p => \`・\${fullName(p)}: \${p.email || '連絡先なし'} (通信エラー/サーバー応答なし)\`).join('\\n'),
            message: \`【エラー詳細】送信処理中にサーバーエラーが発生しました: \${fetchErr.message}\`
          });
          persist();
          renderLogs();
          throw fetchErr;
        }

        if (!res.ok || !result.ok) {
          const errMsg = result.error || JSON.stringify(result);
          state.logs.unshift({
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            customerName: \`【配信失敗】\${chunk.length}件の送信エラー\`,
            scenario: state.scenario,
            channel: el.channelSelect.value,
            status: 'error',
            totalCount: chunk.length,
            unreachedCount: chunk.length,
            unreachedDetails: chunk.map(p => \`・\${fullName(p)}: \${p.email || '連絡先なし'}\`).join('\\n'),
            message: \`【エラー詳細】送信サーバーからエラーが返されました:\\n\${errMsg}\`
          });
          persist();
          renderLogs();
          throw new Error(errMsg);
        }

        // 送信完了ログの出力 (未到達リストと内訳の正確な集計)
        const results = result.results || {};
        const failedList = [];
        const skippedList = [];

        if (results.email) {
          const em = results.email;
          if (em.status === 'failed') {
            chunk.forEach(c => failedList.push(\`・\${fullName(c)}: メール送信エラー (\${em.error || 'サーバー応答なし'})\`));
          } else {
            if (em.failedNames) em.failedNames.forEach(n => failedList.push(\`・\${n}: メール送信エラー\`));
            if (em.skippedNames && em.skippedNames.length > 0) {
              skippedList.push(\`・メール送信スキップ (オプトアウト/アドレスなし等) \${em.skippedNames.length} 件\`);
            }
          }
        }

        if (results.line) {
          const ln = results.line;
          if (ln.status === 'failed') {
            chunk.forEach(c => failedList.push(\`・\${fullName(c)}: LINE送信エラー (\${ln.error || 'サーバー応答なし'})\`));
          } else {
            if (ln.failedNames) ln.failedNames.forEach(n => failedList.push(\`・\${n}: LINE送信エラー\`));
            if (ln.skippedNames && ln.skippedNames.length > 0) {
              skippedList.push(\`・LINE送信スキップ (ID未登録等) \${ln.skippedNames.length} 件\`);
            }
          }
        }

        const unreachedCount = failedList.length + (results.email?.skippedNames?.length || 0) + (results.line?.skippedNames?.length || 0);
        const unreachedDetails = (failedList.length > 0 || skippedList.length > 0)
          ? [...failedList, ...skippedList].join('\\n')
          : '';
        const hasErrors = result.hasErrors || false;

        state.logs.unshift({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          customerName: \`【一括配信】\${chunk.length}件の配信結果\`,
          scenario: state.scenario,
          channel,
          status: (unreachedCount > 0 || hasErrors ? 'error' : 'success'),
          totalCount: chunk.length,
          unreachedCount,
          unreachedDetails,
          message: \`【件名】\${payloads[0]?.subject || '(件名なし)'}\`
        });

        // 配信処理が実行された顧客は即座に選択解除する（再試行保護）
        chunk.forEach(c => {
          const idx = state.selectedCustomerIds.indexOf(c.id);
          if (idx !== -1) {
            state.selectedCustomerIds.splice(idx, 1);
          }
        });

        persist();
        renderCustomers();
        renderLogs();
      }
      alert(\`\${targets.length}件のバッチ配信処理をすべて完了しました\`);
    }`.replace(/\r\n/g, '\n');

const replacement = `  try {
    if (currentMode === 'csv') {
      let totalUnreached = 0;
      const failedNamesList = [];
      const skippedNamesList = [];

      // 配信処理全体を表すログレコードを1つだけ作成して追加
      const logId = crypto.randomUUID();
      const overallLog = {
        id: logId,
        createdAt: new Date().toISOString(),
        customerName: \`【一括配信】\${targets.length}件の配信結果\`,
        scenario: state.scenario,
        channel,
        status: 'sending', // 送信中
        totalCount: targets.length,
        unreachedCount: 0,
        unreachedDetails: '',
        message: \`【件名】\${buildMessage(targets[0]).subject || '(件名なし)'}\`
      };
      state.logs.unshift(overallLog);
      persist();
      renderLogs();

      const chunkSize = 100;
      for (let i = 0; i < targets.length; i += chunkSize) {
        const chunk = targets.slice(i, i + chunkSize);
        el.dispatchBtn.textContent = \`一括配信中... (\${i + 1}〜\${Math.min(i + chunkSize, targets.length)} / \${targets.length})\`;
        
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

        let res;
        let result;
        try {
          res = await fetch('/api/dispatch-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              payloads,
              scenario: state.scenario,
              channel: el.channelSelect.value
            })
          });
          result = await res.json();
        } catch (fetchErr) {
          // 通信・サーバー障害発生時：残りの全件を未到達として追加更新
          const remainingCount = targets.length - i;
          totalUnreached += remainingCount;
          chunk.forEach(c => failedNamesList.push(\`・\${fullName(c)}: 送信エラー (ネットワーク障害: \${fetchErr.message})\`));
          
          const foundLog = state.logs.find(l => l.id === logId);
          if (foundLog) {
            foundLog.status = 'error';
            foundLog.unreachedCount = totalUnreached;
            foundLog.unreachedDetails = [...failedNamesList, ...skippedNamesList].join('\\n');
            persist();
            renderLogs();
          }
          throw fetchErr;
        }

        if (!res.ok || !result.ok) {
          const errMsg = result.error || JSON.stringify(result);
          const remainingCount = targets.length - i;
          totalUnreached += remainingCount;
          chunk.forEach(c => failedNamesList.push(\`・\${fullName(c)}: 送信エラー (\${errMsg})\`));
          
          const foundLog = state.logs.find(l => l.id === logId);
          if (foundLog) {
            foundLog.status = 'error';
            foundLog.unreachedCount = totalUnreached;
            foundLog.unreachedDetails = [...failedNamesList, ...skippedNamesList].join('\\n');
            persist();
            renderLogs();
          }
          throw new Error(errMsg);
        }

        // 送信完了結果の合算と蓄積
        const results = result.results || {};
        let chunkUnreached = 0;

        if (results.email) {
          const em = results.email;
          if (em.status === 'failed') {
            chunk.forEach(c => failedNamesList.push(\`・\${fullName(c)}: メール送信エラー (\${em.error || 'サーバー応答なし'})\`));
            chunkUnreached += chunk.length;
          } else {
            if (em.failedNames) {
              em.failedNames.forEach(n => failedNamesList.push(\`・\${n}: メール送信エラー\`));
              chunkUnreached += em.failedNames.length;
            }
            if (em.skippedNames && em.skippedNames.length > 0) {
              skippedNamesList.push(\`・メール送信スキップ (オプトアウト等) \${em.skippedNames.length} 件\`);
              chunkUnreached += em.skippedNames.length;
            }
          }
        }

        if (results.line) {
          const ln = results.line;
          if (ln.status === 'failed') {
            chunk.forEach(c => failedNamesList.push(\`・\${fullName(c)}: LINE送信エラー (\${ln.error || 'サーバー応答なし'})\`));
            chunkUnreached += chunk.length;
          } else {
            if (ln.failedNames) {
              ln.failedNames.forEach(n => failedNamesList.push(\`・\${n}: LINE送信エラー\`));
              chunkUnreached += ln.failedNames.length;
            }
            if (ln.skippedNames && ln.skippedNames.length > 0) {
              skippedNamesList.push(\`・LINE送信スキップ (ID未登録等) \${ln.skippedNames.length} 件\`);
              chunkUnreached += ln.skippedNames.length;
            }
          }
        }

        totalUnreached += chunkUnreached;

        // 進行中のログの中間更新
        const foundLog = state.logs.find(l => l.id === logId);
        if (foundLog) {
          foundLog.unreachedCount = totalUnreached;
          foundLog.unreachedDetails = [...failedNamesList, ...skippedNamesList].join('\\n');
          persist();
          renderLogs();
        }

        // 配信処理が実行された顧客は即座に選択解除する（再試行保護）
        chunk.forEach(c => {
          const idx = state.selectedCustomerIds.indexOf(c.id);
          if (idx !== -1) {
            state.selectedCustomerIds.splice(idx, 1);
          }
        });

        persist();
        renderCustomers();
      }

      // すべてのチャンクが正常完了した後の最終ステータス更新
      const foundLog = state.logs.find(l => l.id === logId);
      if (foundLog) {
        foundLog.status = totalUnreached > 0 ? 'error' : 'success';
        persist();
        renderLogs();
      }

      alert(\`\${targets.length}件の配信処理が完了しました。\\n送信成功: \${targets.length - totalUnreached} 件\\n未送信/未到達: \${totalUnreached} 件\`);
    }`.replace(/\r\n/g, '\n');

if (!content.includes(target)) {
  console.error('Error: Target block not found in app.js!');
  process.exit(1);
}

content = content.replace(target, replacement);

if (isCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('app.js overall logging patch applied successfully!');
