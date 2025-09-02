// signup.js — invio verifica SEMPRE (Prod + Staging) con fallback REST e delay anti-abort
import { app, auth, db } from "/shared/firebase.js";
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

// ——— Crea/merge doc utente base
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

// ——— Invio verifica: prima SDK, poi fallback REST se serve
async function sendVerificationWithFallback(user) {
  // 1) SDK
  try {
    console.log("[verify] provo SDK sendEmailVerification…");
    await sendEmailVerification(user, { url: `${location.origin}/login.html` });
    console.log("[verify] SDK OK");
    return true;
  } catch (e) {
    console.warn("[verify] SDK fallito, passo al REST:", e?.code, e?.message);
  }

  // 2) REST (identitytoolkit)
  try {
    const idToken = await user.getIdToken();
    const apiKey  = app.options.apiKey;
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType: "VERIFY_EMAIL", idToken }),
        keepalive: true, // evita abort quando la pagina cambia/si chiude
      }
    );
    if (!res.ok) throw new Error(await res.text());
    console.log("[verify] REST fallback OK");
    return true;
  } catch (e) {
    console.error("[verify] REST fallback fallito:", e);
    return false;
  }
}

// Già loggato? porta in home
onAuthStateChanged(auth, (u) => { if (u) goHome(); });

// ——— Signup email/password
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
    console.log("[signup] creo l’utente…");
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);

    // crea/merge doc base
    await ensureUserDocBase(user, { firstName, lastName });

    // invia verifica (sempre, anche in Staging)
    const ok = await sendVerificationWithFallback(user);

    // piccolo respiro per evitare che la request venga "Annullata"
    await new Promise(r => setTimeout(r, 300));

    // logout: potrà accedere solo dopo verifica
    await signOut(auth);

    if (ok) {
      alert("Ti abbiamo inviato un'email di verifica. Controlla anche Spam/Promozioni, poi accedi.");
    } else {
      alert("Registrazione ok, ma invio email di verifica NON riuscito.\nDal login potrai richiedere un nuovo invio.");
    }
    window.location.href = "login.html";
  } catch (err) {
    console.error("Errore registrazione:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile registrarsi"}`);
  } finally {
    setLoading(false);
  }
});

// ——— Signup con Google (nessuna verifica extra)
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