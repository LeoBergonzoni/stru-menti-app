// signup.js
import { app, auth, db, isStaging } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const signupForm = document.getElementById("signup-form");
const googleSignupBtn = document.getElementById("google-signup");
const provider = new GoogleAuthProvider();

function goHome() { window.location.replace("index.html"); }
function setLoading(b){ signupForm?.querySelectorAll("button").forEach(x => x.disabled = b); }

// In STAGING inviamo la verifica solo se c'è ?testVerify=1 nell'URL
const wantsVerifyTestInStaging = new URLSearchParams(location.search).get("testVerify") === "1";
const allowVerifyInThisEnv = !isStaging || wantsVerifyTestInStaging;

// Crea/merge doc utente base
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

// Fallback invio verifica: SDK -> REST
async function sendVerificationWithFallback(user) {
  // 1) Prova standard SDK
  try {
    await sendEmailVerification(user, { url: `${location.origin}/login.html` });
    console.log("[verify] SDK OK");
    return true;
  } catch (e) {
    console.warn("[verify] SDK failed, try REST fallback:", e?.code, e?.message);
  }

  // 2) Fallback REST
  try {
    const idToken = await user.getIdToken();
    const apiKey  = app.options.apiKey;
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken }),
        keepalive: true, // aiuta se l’utente chiude/lascia la pagina
      }
    );
    if (!res.ok) throw new Error(await res.text());
    console.log("[verify] REST fallback OK");
    return true;
  } catch (e) {
    console.error("[verify] REST fallback failed:", e);
    return false;
  }
}

// Se già autenticato, vai in home
onAuthStateChanged(auth, (u) => { if (u) goHome(); });

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

    // Crea il doc base (anche se poi eseguiamo signOut)
    await ensureUserDocBase(user, { firstName, lastName });

    // ── STAGING senza testVerify ──> nessuna email di verifica
    if (!allowVerifyInThisEnv) {
      alert("Registrazione completata (staging: nessuna email di verifica inviata).");
      goHome();
      return;
    }

    // ── PROD o STAGING con testVerify=1 ──> invia verifica (SDK + fallback)
    const ok = await sendVerificationWithFallback(user);

    // Piccolo respiro per evitare abort della fetch durante il signOut
    await new Promise(r => setTimeout(r, 150));

    await signOut(auth);

    if (ok) {
      alert("Ti abbiamo inviato un'email di verifica. Controlla anche Spam/Promozioni, poi accedi.");
    } else {
      alert("Registrazione ok ma invio email di verifica non riuscito.\nDal login potrai richiedere un nuovo invio.");
    }
    window.location.href = "login.html";
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
    goHome();
  } catch (err) {
    console.error("Errore con Google:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile registrarsi con Google"}`);
  } finally {
    setLoading(false);
  }
});