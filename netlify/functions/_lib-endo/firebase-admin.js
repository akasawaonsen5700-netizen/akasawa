const admin = require('firebase-admin');

function getCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  }
  const json = JSON.parse(raw);
  return admin.credential.cert(json);
}

function getApp() {
  if (admin.apps.length) return admin.app();
  return admin.initializeApp({
    credential: getCredential(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

function getDb() {
  return getApp().firestore();
}

function getBucket() {
  return getApp().storage().bucket();
}

module.exports = { admin, getApp, getDb, getBucket };
