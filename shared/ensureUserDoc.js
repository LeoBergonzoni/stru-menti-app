// /shared/ensureUserDoc.js
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

/**
 * Crea/aggiorna users/{uid}. Alla PRIMA creazione imposta anche
 * plan e clicksPerTool (consentiti dalle Rules solo on-create).
 */
export async function ensureUserDoc(auth, db, extra = {}) {
  const u = auth.currentUser;
  if (!u) return;

  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);

  const fullName = (u.displayName || "").trim();
  const [autoFirst = null, autoLast = null] = fullName ? fullName.split(" ") : [null, null];

  // Base per sempre
  const base = {
    email: u.email ?? null,
    firstName: extra.firstName ?? autoFirst,
    lastName:  extra.lastName  ?? autoLast,
    createdAt: new Date().toISOString(),
  };

  // Se il doc NON esiste, includo anche i campi "init" (plan/limiti)
  if (!snap.exists()) {
    await setDoc(ref, { ...base, plan: "free-logged", clicksPerTool: 40 }, { merge: true });
  } else {
    await setDoc(ref, base, { merge: true });
  }
}