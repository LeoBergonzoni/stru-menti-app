// /_assets/auth-bootstrap.js
import { auth, db } from "/shared/firebase.js";
import { onAuthStateChanged, reload } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

async function ensureUserDocIfMissing(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email || null,
      plan: "free-logged", // se arriva qui è verified → mettiamo già free-logged
      createdAt: new Date().toISOString(),
    }, { merge: true });
    console.log("[bootstrap] created user doc as free-logged");
  } else {
    console.log("[bootstrap] user doc exists");
  }
}

async function promoteIfNeeded(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return; // già gestito sopra
  const cur = snap.data() || {};
  if (user.emailVerified && (cur.plan === "pending-verify" || !("plan" in cur))) {
    await setDoc(ref, { plan: "free-logged" }, { merge: true });
    console.log("[bootstrap] promoted plan to free-logged");
  } else {
    console.log("[bootstrap] no promotion needed (plan:", cur.plan, ")");
  }
}

async function doWork(u) {
  try {
    await reload(u);
  } catch {}
  if (!u.emailVerified) {
    console.log("[bootstrap] user not verified → skip");
    return;
  }
  try {
    await ensureUserDocIfMissing(u);
    await promoteIfNeeded(u);
  } catch (e) {
    console.warn("[bootstrap] write failed, retrying once…", e?.code, e?.message);
    // piccolo retry dopo 500ms
    setTimeout(async () => {
      try {
        await ensureUserDocIfMissing(u);
        await promoteIfNeeded(u);
        console.log("[bootstrap] retry success");
      } catch (err) {
        console.error("[bootstrap] retry failed:", err?.code, err?.message, err);
      }
    }, 500);
  }
}

onAuthStateChanged(auth, (u) => {
  console.log("[bootstrap] auth state:", !!u);
  if (u) doWork(u);
});