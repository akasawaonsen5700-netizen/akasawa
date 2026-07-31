const fs = require('fs');
const path = require('path');

let myFetch = typeof fetch !== 'undefined' ? fetch : null;
if (!myFetch) {
  try {
    myFetch = require('node-fetch');
  } catch (e) {
    // node-fetch がない場合のフォールバック
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    
    // 開発/デモ環境またはローカルに undelivered_raw.json がある場合のキャッシュ読み込み
    let cachedList = [];
    const rootRawPath = path.join(__dirname, '..', '..', '..', 'scratch', 'undelivered_raw.json');
    if (fs.existsSync(rootRawPath)) {
      try {
        cachedList = JSON.parse(fs.readFileSync(rootRawPath, 'utf8'));
      } catch (e) {}
    }

    if (!apiKey) {
      // APIキーがない場合でもキャッシュがあれば返す
      if (cachedList.length > 0) {
        return json(200, { ok: true, source: 'cache', data: cachedList });
      }
      return json(400, { ok: false, error: 'RESEND_API_KEY is not configured in .env' });
    }

    // Resend API から直近のメールログを取得
    if (!myFetch) {
      if (cachedList.length > 0) {
        return json(200, { ok: true, source: 'cache', data: cachedList });
      }
      return json(500, { ok: false, error: 'fetch function is not available' });
    }

    let emails = [];
    let hasMore = true;
    let after = null;
    let page = 1;
    const maxEmails = 7500;

    while (hasMore && emails.length < maxEmails) {
      let url = 'https://api.resend.com/emails?limit=100';
      if (after) {
        url += `&after=${after}`;
      }

      const res = await myFetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Resend API Error (${res.status}): ${text}`);
      }

      const result = await res.json();
      if (!result.data || !Array.isArray(result.data)) {
        break;
      }

      emails = emails.concat(result.data);
      hasMore = result.has_more;

      if (hasMore && result.data.length > 0) {
        after = result.data[result.data.length - 1].id;
        page++;
        // Rate limit 対策
        await new Promise(r => setTimeout(r, 100));
      } else {
        break;
      }
    }

    // 未到着（bounced / suppressed / failed / last_event != delivered）の抽出
    const undeliveredList = [];
    emails.forEach(item => {
      const status = item.last_event || 'unknown';
      if (status !== 'delivered') {
        const toStr = Array.isArray(item.to) ? item.to.join(', ') : item.to;
        undeliveredList.push({
          id: item.id,
          to: toStr,
          status: status,
          subject: item.subject || '',
          created_at: item.created_at,
          from: item.from
        });
      }
    });

    return json(200, {
      ok: true,
      source: 'api',
      totalEmails: emails.length,
      undeliveredCount: undeliveredList.length,
      data: undeliveredList
    });

  } catch (error) {
    return json(500, { ok: false, error: error.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(body)
  };
}
