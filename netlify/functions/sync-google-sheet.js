const { google } = require('googleapis');
const { getDb, admin } = require('./_lib/firebase-admin');
const { ok, json } = require('./_lib/helpers');
const { buildDraftPackage } = require('./_lib/ai');

function auth() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
}

exports.handler = async () => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = process.env.GOOGLE_SHEET_RANGE || 'queue!A1:Z';
    if (!spreadsheetId) return ok({ skipped: true, reason: 'GOOGLE_SHEET_ID not set' });

    const sheets = google.sheets({ version: 'v4', auth: auth() });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values || [];
    if (rows.length < 2) return ok({ imported: 0 });

    const headers = rows[0];
    const db = getDb();
    let imported = 0;

    for (const row of rows.slice(1)) {
      const item = Object.fromEntries(headers.map((header, index) => [header, row[index] || '']));
      if (!item.mediaUrl || item.imported === 'done') continue;
      const normalized = {
        ownerComment: item.ownerComment || '',
        shotDate: item.shotDate || null,
        location: item.location || '',
        catName: item.catName || '',
        simpleTag: item.simpleTag || null,
        publishAt: item.publishAt || null,
        visibility: item.visibility || 'review',
        ngMemo: item.ngMemo || '',
        channels: (item.channels || 'instagram,gbp').split(',').map(v => v.trim()).filter(Boolean),
        assets: [{
          name: item.mediaName || 'sheet-media',
          type: item.mediaType || 'image/jpeg',
          size: Number(item.mediaSize || 0),
          storagePath: item.storagePath || '',
          url: item.mediaUrl
        }]
      };
      const draftPackage = await buildDraftPackage(normalized);
      await db.collection('submissions').add({
        ...normalized,
        ...draftPackage,
        source: 'google-sheet-sync',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      imported += 1;
    }

    return ok({ imported });
  } catch (error) {
    console.error(error);
    return json(500, { error: error.message || 'Internal error' });
  }
};
