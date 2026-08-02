const admin = require('firebase-admin');

function safeParseServiceAccount(raw) {
  if (!raw) return null;
  raw = raw.trim();

  try {
    return JSON.parse(raw);
  } catch (e) {
    // 不正な \ エスケープ(例: \ や \a 等)の自動クレンジング補正
    try {
      const sanitized = raw.replace(/\\([^"\\/bfnrtu])/g, '$1');
      return JSON.parse(sanitized);
    } catch (e2) {
      // 正規表現による private_key / client_email 直接抽出
      const clientEmail = raw.match(/"client_email":\s*"([^"]+)"/)?.[1];
      const projectId = raw.match(/"project_id":\s*"([^"]+)"/)?.[1] || 'akasawadp';
      
      const pkStart = raw.indexOf('-----BEGIN PRIVATE KEY-----');
      const pkEnd = raw.indexOf('-----END PRIVATE KEY-----');
      let privateKey = null;
      if (pkStart !== -1 && pkEnd !== -1) {
        privateKey = raw.substring(pkStart, pkEnd + '-----END PRIVATE KEY-----'.length);
        privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\ /g, ' ');
      }

      return {
        client_email: clientEmail,
        private_key: privateKey,
        project_id: projectId
      };
    }
  }
}

function getCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  }

  const json = safeParseServiceAccount(raw);
  if (!json) {
    throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON');
  }

  if (json.private_key && typeof json.private_key === 'string') {
    json.private_key = json.private_key.replace(/\\n/g, '\n');
  }

  return admin.credential.cert(json);
}

function getApp() {
  if (admin.apps.length) return admin.app();
  return admin.initializeApp({
    credential: getCredential(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'akasawadp.firebasestorage.app'
  });
}

function getDb() {
  return getApp().firestore();
}

function getBucket() {
  return getApp().storage().bucket();
}

module.exports = { admin, getApp, getDb, getBucket };
