function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-sheet-secret'
    },
    body: JSON.stringify(body)
  };
}

function ok(body) {
  return json(200, body);
}

function badRequest(message) {
  return json(400, { error: message });
}

function methodNotAllowed() {
  return json(405, { error: 'Method not allowed' });
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

module.exports = { json, ok, badRequest, methodNotAllowed, parseBody };
