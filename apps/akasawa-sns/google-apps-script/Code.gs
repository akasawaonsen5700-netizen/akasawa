const NETLIFY_WEBHOOK_URL = 'https://YOUR_NETLIFY_SITE.netlify.app/.netlify/functions/sheet-webhook';
const SHARED_SECRET = 'REPLACE_SHEET_SHARED_SECRET';

function sendSelectedRowToNetlify() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('queue');
  const row = sheet.getActiveCell().getRow();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const payload = {};
  headers.forEach((header, index) => payload[header] = values[index]);

  const response = UrlFetchApp.fetch(NETLIFY_WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-sheet-secret': SHARED_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const body = JSON.parse(response.getContentText());
  sheet.getRange(row, headers.indexOf('importResult') + 1).setValue(JSON.stringify(body));
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Akasawa Demo')
    .addItem('選択行をNetlifyへ送信', 'sendSelectedRowToNetlify')
    .addToUi();
}
