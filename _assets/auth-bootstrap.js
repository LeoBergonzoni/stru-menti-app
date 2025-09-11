// _assets/auth-bootstrap.js — crea il doc utente se manca + promuove piano dopo verifica, ovunque
import { auth, db } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  reload,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

async function ensureUserDocIfMissing(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // crea doc base
    await setDoc(ref, {
      email: user.email || null,
      plan: "free-logged",
      createdAt: new Date().toISOString(),
    }, { merge: true });
    console.log("[bootstrap] created user doc");
  }
}

async function promoteIfNeeded(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const cur = snap.data() || {};
    if (user.emailVerified && (cur.plan === "pending-verify" || !("plan" in cur))) {
      await setDoc(ref, { plan: "free-logged" }, { merge: true });
      console.log("[bootstrap] promoted plan to free-logged");
    }
  }
}

onAuthStateChanged(auth, async (u) => {
  if (!u) return;
  try { await reload(u); } catch {}
  if (!u.emailVerified) return; // aspetta verifica
  try {
    await ensureUserDocIfMissing(u);
    await promoteIfNeeded(u);
  } catch (e) {
    console.error("[bootstrap] Firestore write error:", e?.code, e?.message, e);
    // Non bloccare la pagina: è una rete di sicurezza
  }
});