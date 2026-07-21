exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const { customer, scenario, channel, subject, message } = JSON.parse(event.body || '{}');
    if (!customer) return json(400, { ok: false, error: 'customer is required' });

    const results = [];
    if (channel === 'email' || channel === 'both') {
      results.push(await sendEmail(customer, subject, message));
    }
    if (channel === 'line' || channel === 'both') {
      results.push(await sendLine(customer, message));
    }

    return json(200, { ok: true, scenario, channel, results, mode: runtimeMode() });
  } catch (error) {
    return json(500, { ok: false, error: error.message, mode: runtimeMode() });
  }
};

async function sendEmail(customer, subject, message) {
  if (!customer.email) return { type: 'email', status: 'skipped', reason: 'email missing' };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || '赤沢温泉旅館 <info@akasawaonsen.com>';
  if (!apiKey) {
    return { type: 'email', status: 'mock', to: customer.email, subject };
  }

  const payload = {
    from,
    to: customer.email,
    subject,
    text: message
  };

  if (process.env.REPLY_TO) {
    payload.reply_to = process.env.REPLY_TO;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Email send failed: ${JSON.stringify(data)}`);
  return { type: 'email', status: 'sent', to: customer.email, provider: 'resend', data };
}

async function sendLine(customer, message) {
  if (!customer.lineUserId) return { type: 'line', status: 'skipped', reason: 'lineUserId missing' };

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return { type: 'line', status: 'mock', to: customer.lineUserId };
  }

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: customer.lineUserId,
      messages: [{ type: 'text', text: message.slice(0, 4900) }]
    })
  });

  if (!res.ok) {
    const data = await res.text();
    throw new Error(`LINE send failed: ${data}`);
  }
  return { type: 'line', status: 'sent', to: customer.lineUserId, provider: 'line' };
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
