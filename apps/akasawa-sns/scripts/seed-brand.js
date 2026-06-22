const { getDb } = require('../netlify/functions/_lib/firebase-admin');
const { BRAND } = require('../netlify/functions/_lib/brand');

(async () => {
  const db = getDb();
  await db.collection('settings').doc('brand').set({
    ...BRAND,
    updatedAt: new Date().toISOString()
  });
  console.log('Brand settings seeded');
})();
