let app = null;
let db = null;
let storage = null;

const config = window.AKASAWA_CONFIG?.firebase;

if (config && config.apiKey && !config.apiKey.startsWith('REPLACE_')) {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
    const { getStorage } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
    
    app = initializeApp(config);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (err) {
    console.warn('Firebase init warning:', err);
  }
} else {
  console.log('Firebase client SDK is skipped (Server-side Netlify API mode).');
}

export { app, db, storage };
export const apiBase = window.AKASAWA_CONFIG?.apiBase || '/api';
export const defaults = window.AKASAWA_CONFIG?.defaults || {
  ownerName: '遠藤正俊',
  hotelName: '赤沢温泉旅館',
  officialSite: 'https://akasawaonsen.com/',
  phone: '',
  brandCopy: '世界中で自然と向き合ってきた私が、日本の「枯れ葉」に見出した、失われた心の救済'
};
