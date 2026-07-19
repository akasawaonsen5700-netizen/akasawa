exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const { payloads, channel, scenario } = JSON.parse(event.body || '{}');
    if (!payloads || !Array.isArray(payloads) || payloads.length === 0) {
      return json(400, { ok: false, error: 'payloads array is required' });
    }
    if (payloads.length > 100) {
      return json(400, { ok: false, error: 'max 100 payloads per batch request allowed' });
    }

    const results = [];
    if (channel === 'email' || channel === 'both') {
      results.push(await sendEmailBatch(payloads));
    }
    if (channel === 'line' || channel === 'both') {
      results.push(await sendLineBatch(payloads));
    }

    return json(200, { ok: true, scenario, channel, results, mode: runtimeMode() });
  } catch (error) {
    return json(500, { ok: false, error: error.message, mode: runtimeMode() });
  }
};

async function sendEmailBatch(payloads) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  
  const validPayloads = payloads.filter(p => p.email);
  const skippedNames = payloads.filter(p => !p.email).map(p => p.customerName || '宛名なし');

  if (!apiKey || !from) {
    return { 
      type: 'email', 
      status: 'mock', 
      count: validPayloads.length,
      sample: validPayloads.slice(0, 2),
      skippedNames
    };
  }

  const batchRequests = validPayloads.map(p => {
    const req = {
      from,
      to: p.email,
      subject: p.subject,
      text: p.message
    };
    if (process.env.REPLY_TO) {
      req.reply_to = process.env.REPLY_TO;
    }
    return req;
  });

  if (batchRequests.length === 0) {
    return { type: 'email', status: 'skipped', reason: 'no valid emails in payload', skippedNames };
  }

  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(batchRequests)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Email batch send failed: ${JSON.stringify(data)}`);
  
  return { 
    type: 'email', 
    status: 'sent', 
    provider: 'resend-batch', 
    count: batchRequests.length,
    data,
    skippedNames,
    failedNames: [] // Resend Batch API doesn't return per-item failures reliably here, so mock it for now
  };
}

async function sendLineBatch(payloads) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const validPayloads = payloads.filter(p => p.lineUserId);
  const skippedNames = payloads.filter(p => !p.lineUserId).map(p => p.customerName || '宛名なし');

  if (!token) {
    return { 
      type: 'line', 
      status: 'mock', 
      count: validPayloads.length,
      skippedNames
    };
  }

  if (validPayloads.length === 0) {
    return { type: 'line', status: 'skipped', reason: 'no valid lineUserIds in payload', skippedNames };
  }

  const results = [];
  const failedNames = [];
  for (const p of validPayloads) {
    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: p.lineUserId,
          messages: [{ type: 'text', text: p.message.slice(0, 4900) }]
        })
      });
      
      if (!res.ok) {
        const err = await res.text();
        results.push({ to: p.lineUserId, success: false, error: err });
        failedNames.push(p.customerName || '宛名なし');
      } else {
        results.push({ to: p.lineUserId, success: true });
      }
    } catch (e) {
      results.push({ to: p.lineUserId, success: false, error: e.message });
      failedNames.push(p.customerName || '宛名なし');
    }
  }

  const successCount = results.filter(r => r.success).length;
  if (successCount === 0 && results.length > 0) {
    throw new Error(`LINE batch send completely failed. First error: ${results[0].error}`);
  }

  return { type: 'line', status: 'sent', provider: 'line', count: successCount, total: results.length, details: results, skippedNames, failedNames };
}

function runtimeMode() {
  return process.env.RESEND_API_KEY || process.env.LINE_CHANNEL_ACCESS_TOKEN ? 'live_or_partial' : 'mock';
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  };
}
