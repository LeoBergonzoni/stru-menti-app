// login.js — login web + rientro in app via deep link
import { auth, db } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ---- deep-link helper (solo se aperto dall'app) ----
const q = new URLSearchParams(location.search);
const fromApp = q.get("from") === "app";
const rawRedirect = q.get("redirect_uri") || "stru-menti://auth";
const redirectUri = rawRedirect.startsWith("stru-menti://")
  ? rawRedirect
  : "stru-menti://auth";

function sendBackToApp(user) {
  const uid = user.uid;
  const email = user.email || "";
  const name = user.displayName || "";
  location.href =
    `${redirectUri}?uid=${encodeURIComponent(uid)}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;
}

// UI refs
const loginForm = document.getElementById("login-form");
const googleLoginBtn = document.getElementById("google-login");
const provider = new GoogleAuthProvider();

function goHome() { window.location.replace("index.html"); }
function setLoading(b) { loginForm?.querySelectorAll("button").forEach(x => x.disabled = b); }

// Se già autenticato
onAuthStateChanged(auth, (u) => {
  if (!u) return;
  if (fromApp) { sendBackToApp(u); return; }
  goHome();
});

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email || null,
      plan: "free-logged",
      createdAt: new Date().toISOString(),
    }, { merge: true });
  } else if (!snap.data()?.plan) {
    await setDoc(ref, { plan: "free-logged" }, { merge: true });
  }
}

// Email + password
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginForm.email.value.trim();
  const pass  = loginForm.password.value;

  setLoading(true);
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, pass);
    await ensureUserDoc(user);
    if (fromApp) { sendBackToApp(user); return; }
    goHome();
  } catch (err) {
    console.error("Errore di login:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile accedere"}`);
  } finally {
    setLoading(false);
  }
});

// Google
googleLoginBtn?.addEventListener("click", async () => {
  setLoading(true);
  try {
    const { user } = await signInWithPopup(auth, provider);
    await ensureUserDoc(user);
    if (fromApp) { sendBackToApp(user); return; }
    goHome();
  } catch (err) {
    console.error("Errore accesso Google:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile accedere con Google"}`);
  } finally {
    setLoading(false);
  }
});