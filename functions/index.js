const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Crea/inizializza sempre il doc utente all'iscrizione
 * Funziona per TUTTI i provider (email+password, Google, ecc.)
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  const db = admin.firestore();
  const ref = db.collection("users").doc(user.uid);

  const firstName = (user.displayName || "").split(" ")[0] || null;

  const payload = {
    email: user.email || null,
    firstName,
    plan: "free-logged",
    clicksPerTool: 40,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    stripe: null
  };

  await ref.set(payload, { merge: true });
});

/**
 * (Facoltativa) Blocking function: blocca domini "usa e getta"
 * Richiede il piano Blaze per Functions. Amplia la lista secondo necessità.
 */
const DISPOSABLE = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com"
]);

exports.beforeCreateBlockDisposable = functions.auth.user().beforeCreate((user) => {
  const email = (user.email || "").toLowerCase();
  const domain = email.split("@").pop();
  if (DISPOSABLE.has(domain)) {
    throw new functions.auth.HttpsError(
      "permission-denied",
      "Email non consentita. Usa un indirizzo email valido."
    );
  }
});