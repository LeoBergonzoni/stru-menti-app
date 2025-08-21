// /.netlify/functions/debugFirestore
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || '';
  privateKey = privateKey.trim().replace(/^"|"$/g, '');
  if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}
const db = admin.firestore();

exports.handler = async () => {
  try {
    const ts = new Date().toISOString();
    await db.collection('users').doc('test-admin-write').set({ ts }, { merge: true });
    return { statusCode: 200, body: `ok: ${ts}` };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: `err: ${e.message}` };
  }
};