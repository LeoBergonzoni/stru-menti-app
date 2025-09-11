// signup.js — signup web + rientro in app via deep link (compatibile con browser embedded)
import { app, auth, db } from "/shared/firebase.js";
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
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// -------- helper deep link & contesto ----------
const q = new URLSearchParams(location.search);
const fromApp = q.get("from") === "app"; // opzionale, ma utile
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

// pulisce i parametri di redirect dalla barra indirizzi (estetica)
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

function goHome() {
  window.location.replace("index.html");
}
function setLoading(b) {
  signupForm?.querySelectorAll("button").forEach((x) => (x.disabled = b));
}

async function ensureUserDocBase(user, extra = {}) {
  await setDoc(
    doc(db, "users", user.uid),
    {
      email: user.email || null,
      firstName: extra.firstName ?? null,
      lastName: extra.lastName ?? null,
      // usa pending-verify se passato, altrimenti free-logged
      plan: extra.plan ?? "free-logged",
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

// Flag per evitare che onAuthStateChanged “scappi” prima che parta l’invio email
let suppressAuthRedirect = false;

// Se torni da signInWithRedirect → completa il flusso
(async function handleRedirectIfAny() {
  try {
    const res = await getRedirectResult(auth);
    if (res?.user) {
      await ensureUserDocBase(res.user);
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
  if (suppressAuthRedirect) return; // 👈 blocca redirect automatici durante il submit
  if (!u) return;
  const isEmailPwd = (u.providerData?.[0]?.providerId === "password");
  if (isEmailPwd && !u.emailVerified) {
    const qp = new URLSearchParams();
    qp.set("email", u.email || "");
    if (fromApp) qp.set("redirect_uri", redirectUri || "stru-menti://auth");
    location.replace("verify-email.html?" + qp.toString());
    return;
  }
  // altrimenti flusso standard:
  if (fromApp) { gotoApp(u); return; }
  goHome();
});

// ---- Email + password ----
signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const firstName = signupForm.firstName?.value?.trim?.() || "";
  const lastName = signupForm.lastName?.value?.trim?.() || "";
  const email = signupForm.email?.value?.trim?.() || "";
  const pass = signupForm.password?.value || "";
  const pass2 = signupForm.confirmPassword?.value || "";

  if (pass !== pass2) {
    alert("Le password non coincidono.");
    return;
  }

  setLoading(true);
  try {
    suppressAuthRedirect = true; // 👈 evita race con onAuthStateChanged
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);

    // Invia la verifica SUBITO (minimizza finestre temporali)
    await sendEmailVerification(user, {
      url: location.origin + "/index.html",
      handleCodeInApp: false,
    });

    // (facoltativo) micro-pausa per assicurarsi che la richiesta sia partita
    await new Promise((r) => setTimeout(r, 200));

    // Aggiorna profilo e doc utente (cose "lente" dopo l'invio)
    if (firstName || lastName) {
      try {
        await updateProfile(user, { displayName: `${firstName} ${lastName}`.trim() });
      } catch {}
    }
    await ensureUserDocBase(user, { firstName, lastName, plan: "pending-verify" });

    // Redirect esplicito alla pagina di verifica
    const extra = new URLSearchParams();
    extra.set("email", user.email || "");
    if (fromApp) extra.set("redirect_uri", "stru-menti://auth");
    location.replace("verify-email.html?" + extra.toString());
    return;

  } catch (err) {
    console.error("Errore registrazione:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile registrarsi"}`);
    // Se resti su questa pagina, riabilita il listener
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
      // ritornerai qui → getRedirectResult completerà
    } else {
      const { user } = await signInWithPopup(auth, provider);
      await ensureUserDocBase(user);
      if (fromApp) {
        cleanUrl();
        gotoApp(user);
        return;
      }
      goHome();
    }
  } catch (err) {
    console.error("Errore con Google:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile registrarsi con Google"}`);
  } finally {
    setLoading(false);
  }
});