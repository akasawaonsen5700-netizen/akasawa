import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const config = window.AKASAWA_CONFIG?.firebase;
if (!config?.apiKey || config.apiKey.startsWith('REPLACE_')) {
  console.warn('Firebase runtime config is not set. Edit /public/runtime-config.js before deployment.');
}

export const app = initializeApp(config);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const apiBase = window.AKASAWA_CONFIG?.apiBase || '/api';
export const defaults = window.AKASAWA_CONFIG?.defaults || {};
