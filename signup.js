// signup.js — signup web + rientro in app via deep link
import { app, auth, db } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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
const signupForm = document.getElementById("signup-form");
const googleSignupBtn = document.getElementById("google-signup");
const provider = new GoogleAuthProvider();

function goHome() { window.location.replace("index.html"); }
function setLoading(b) { signupForm?.querySelectorAll("button").forEach(x => x.disabled = b); }

async function ensureUserDocBase(user, extra = {}) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      email: user.email || null,
      firstName: extra.firstName || null,
      lastName:  extra.lastName  || null,
      plan: "free-logged",
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

// Già loggato? (utile se ricarichi la pagina dopo il popup)
onAuthStateChanged(auth, (u) => {
  if (!u) return;
  if (fromApp) { sendBackToApp(u); return; }
  goHome();
});

// Email + password
signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const firstName = signupForm.firstName.value.trim();
  const lastName  = signupForm.lastName.value.trim();
  const email     = signupForm.email.value.trim();
  const pass      = signupForm.password.value;
  const pass2     = signupForm.confirmPassword.value;

  if (pass !== pass2) { alert("Le password non coincidono."); return; }

  setLoading(true);
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);
    await ensureUserDocBase(user, { firstName, lastName });
    if (fromApp) { sendBackToApp(user); return; }
    goHome();
  } catch (err) {
    console.error("Errore registrazione:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile registrarsi"}`);
  } finally {
    setLoading(false);
  }
});

// Google
googleSignupBtn?.addEventListener("click", async () => {
  setLoading(true);
  try {
    const { user } = await signInWithPopup(auth, provider);
    await ensureUserDocBase(user);
    if (fromApp) { sendBackToApp(user); return; }
    goHome();
  } catch (err) {
    console.error("Errore con Google:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile registrarsi con Google"}`);
  } finally {
    setLoading(false);
  }
});