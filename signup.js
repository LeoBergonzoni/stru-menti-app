// signup.js — signup web + rientro in app via deep link (compatibile con browser embedded)
import { app, auth } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// -------- helper deep link & contesto ----------
const q = new URLSearchParams(location.search);
const fromApp = q.get("from") === "app";
const rawRedirect = q.get("redirect_uri") || "stru-menti://auth";
const redirectUri = rawRedirect.startsWith("stru-menti://") ? rawRedirect : "stru-menti://auth";

// “embedded” euristico: WebView, in-app browsers, ecc.
const isEmbedded =
  /WebView|wv|FBAN|FBAV|Instagram|Line|OKHttp|CriOS\/.*Mobile|Mobile(?!.*Safari)/i.test(
    navigator.userAgent || ""
  ) || window !== window.parent;

function gotoApp(user) {
  const uid = user.uid;
  const email = encodeURIComponent(user.email || "");
  const name = encodeURIComponent(user.displayName || "");
  location.href = `${redirectUri}?uid=${uid}&email=${email}&name=${name}`;
}

function goHome() { window.location.replace("index.html"); }
function cleanUrl() {
  if ("replaceState" in history) {
    const url = new URL(location.href);
    ["redirect_uri", "from"].forEach((k) => url.searchParams.delete(k));
    history.replaceState({}, "", url.toString());
  }
}

// -------- UI refs ----------
const signupForm = document.getElementById("signup-form");
const googleSignupBtn = document.getElementById("google-signup");
const provider = new GoogleAuthProvider();
function setLoading(b) { signupForm?.querySelectorAll("button").forEach((x) => (x.disabled = b)); }

// Flag per evitare che onAuthStateChanged “scappi” prima che parta l’invio email
let suppressAuthRedirect = false;

// Se torni da signInWithRedirect → completa il flusso (Google)
(async function handleRedirectIfAny() {
  try {
    const res = await getRedirectResult(auth);
    if (res?.user) {
      cleanUrl();
      if (fromApp) gotoApp(res.user);
      else goHome();
      return;
    }
  } catch (e) {
    console.error("getRedirectResult error:", e);
    alert("Errore Google: " + (e?.message || "imprevisto"));
  }
})();

// Già loggato? (se ricarichi la pagina ecc.)
onAuthStateChanged(auth, async (u) => {
  if (suppressAuthRedirect) return;
  if (!u) return;
  const isEmailPwd = (u.providerData?.[0]?.providerId === "password");
  if (isEmailPwd && !u.emailVerified) {
    const qp = new URLSearchParams();
    qp.set("email", u.email || "");
    if (fromApp) qp.set("redirect_uri", redirectUri);
    location.replace("verify-email.html?" + qp.toString());
    return;
  }
  if (fromApp) { gotoApp(u); return; }
  goHome();
});

// ---- Email + password ----
signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const firstName = signupForm.firstName?.value?.trim?.() || "";
  const lastName  = signupForm.lastName?.value?.trim?.() || "";
  const email     = signupForm.email?.value?.trim?.() || "";
  const pass      = signupForm.password?.value || "";
  const pass2     = signupForm.confirmPassword?.value || "";

  if (pass !== pass2) { alert("Le password non coincidono."); return; }

  setLoading(true);
  try {
    suppressAuthRedirect = true;
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);

    // Invia la verifica SUBITO
    await sendEmailVerification(user, {
      url: location.origin + "/index.html",
      handleCodeInApp: false,
    });

    // salva temporaneamente i dati profilo (li scriveremo DOPO la verifica)
    sessionStorage.setItem("pendingProfile", JSON.stringify({ firstName, lastName }));

    // (opzionale) micro-pausa per sicurezza
    await new Promise((r) => setTimeout(r, 200));

    // (facoltativo) displayName già ora – non influisce sul doc Firestore
    if (firstName || lastName) {
      try { await updateProfile(user, { displayName: `${firstName} ${lastName}`.trim() }); } catch {}
    }

    // Redirect esplicito alla pagina di verifica
    const extra = new URLSearchParams();
    extra.set("email", user.email || "");
    if (fromApp) extra.set("redirect_uri", "stru-menti://auth");
    location.replace("verify-email.html?" + extra.toString());
    return;

  } catch (err) {
    console.error("Errore registrazione:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile registrarsi"}`);
    suppressAuthRedirect = false;
  } finally {
    setLoading(false);
  }
});

// ---- Google ----
googleSignupBtn?.addEventListener("click", async () => {
  setLoading(true);
  try {
    if (fromApp || isEmbedded) {
      await signInWithRedirect(auth, provider);
    } else {
      const { user } = await signInWithPopup(auth, provider);
      if (fromApp) { cleanUrl(); gotoApp(user); return; }
      goHome();
    }
  } catch (err) {
    console.error("Errore con Google:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile registrarsi con Google"}`);
  } finally {
    setLoading(false);
  }
});