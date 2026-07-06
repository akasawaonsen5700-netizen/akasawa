require('dotenv').config({ path: '../../../.env' });
const admin = require('firebase-admin');

// サービスアカウントJSONをパース
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) {
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured in .env');
  process.exit(1);
}

const serviceAccount = JSON.parse(raw);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkSubmissions() {
  console.log('--- Fetching latest 10 submissions from Firestore ---');
  try {
    const snapshot = await db.collection('submissions')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    if (snapshot.empty) {
      console.log('No submissions found.');
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('--------------------------------------------------');
      console.log(`ID: ${doc.id}`);
      console.log(`Created: ${data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : 'N/A'}`);
      console.log(`Owner Comment: ${data.ownerComment ? data.ownerComment.substring(0, 50) + '...' : 'None'}`);
      console.log(`Video Status: ${data.videoStatus}`);
      console.log(`Video URL: ${data.videoUrl || 'None'}`);
      console.log(`Voice URL: ${data.voiceUrl || 'None'}`);
      console.log(`Video Error: ${data.videoError || 'None'}`);
      console.log(`Source: ${data.source || 'web'}`);
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
  }
}

checkSubmissions();
