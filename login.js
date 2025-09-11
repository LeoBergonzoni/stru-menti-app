// login.js — login web + rientro in app via deep link (compatibile con browser embedded)
import { auth, db } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  sendEmailVerification,
  reload,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// -------- helper deep link & contesto ----------
const q = new URLSearchParams(location.search);
const fromApp = q.get("from") === "app";
const rawRedirect = q.get("redirect_uri") || "stru-menti://auth";
const redirectUri = rawRedirect.startsWith("stru-menti://") ? rawRedirect : "stru-menti://auth";

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
const loginForm = document.getElementById("login-form");
const googleLoginBtn = document.getElementById("google-login");
const provider = new GoogleAuthProvider();
function setLoading(b) { loginForm?.querySelectorAll("button").forEach((x) => (x.disabled = b)); }

// Crea il doc utente se non esiste (per utenti già verified)
async function ensureUserDocIfMissing(user) {
  const ref  = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email || null,
      plan: "free-logged",
      createdAt: new Date().toISOString(),
    }, { merge: true });
  }
}

// Promuove pending-verify → free-logged se l'utente è verified
async function promoteIfNeeded(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const cur = snap.exists() ? (snap.data() || {}) : {};
  if (user.emailVerified && (!("plan" in cur) || cur.plan === "pending-verify")) {
    try { await setDoc(ref, { plan: "free-logged" }, { merge: true }); } catch (e) {
      console.error("cannot promote plan:", e);
    }
  }
}

// Se torni da signInWithRedirect → completa
(async function handleRedirectIfAny() {
  try {
    const res = await getRedirectResult(auth);
    if (res?.user) {
      // Google è sempre verified → crea doc se manca e promuovi se serve
      await ensureUserDocIfMissing(res.user);
      await promoteIfNeeded(res.user);
      cleanUrl();
      gotoApp(res.user);
      return;
    }
  } catch (e) {
    console.error("getRedirectResult error:", e);
    alert("Errore Google: " + (e?.message || "imprevisto"));
  }
})();

// Già autenticato?
onAuthStateChanged(auth, async (u) => {
  if (!u) return;
  const isEmailPwd = (u.providerData?.[0]?.providerId === "password");
  if (isEmailPwd && !u.emailVerified) {
    const qp = new URLSearchParams();
    qp.set("email", u.email || "");
    if (fromApp) qp.set("redirect_uri", redirectUri);
    location.replace("verify-email.html?" + qp.toString());
    return;
  }
  // verified → crea se manca + promuovi se serve e vai
  await ensureUserDocIfMissing(u);
  await promoteIfNeeded(u);
  if (fromApp) { gotoApp(u); return; }
  goHome();
});

// ---- Email + password ----
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginForm.email?.value?.trim?.() || "";
  const pass = loginForm.password?.value || "";

  setLoading(true);
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, pass);

    const isEmailPwd = (user.providerData?.[0]?.providerId === "password");
    if (isEmailPwd) {
      try { await reload(user); } catch {}
      if (!user.emailVerified) {
        // invia verifica con continue verso verify-email.html
        try {
          const contUrl = new URL(location.origin + "/verify-email.html");
          contUrl.searchParams.set("email", user.email || "");
          if (fromApp) contUrl.searchParams.set("redirect_uri", redirectUri);
          await sendEmailVerification(user, {
            url: contUrl.toString(),
            handleCodeInApp: false,
          });
        } catch {}
        const qp = new URLSearchParams();
        qp.set("email", user.email || "");
        if (fromApp) qp.set("redirect_uri", redirectUri);
        location.replace("verify-email.html?" + qp.toString());
        return;
      }
    }

    // verified → crea se manca + promuovi se serve e prosegui
    await ensureUserDocIfMissing(user);
    await promoteIfNeeded(user);

    if (fromApp || isEmbedded) { cleanUrl(); gotoApp(user); return; }
    goHome();
  } catch (err) {
    console.error("Errore di login:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile accedere"}`);
  } finally {
    setLoading(false);
  }
});

// ---- Google ----
googleLoginBtn?.addEventListener("click", async () => {
  setLoading(true);
  try {
    if (fromApp || isEmbedded) {
      await signInWithRedirect(auth, provider);
    } else {
      const { user } = await signInWithPopup(auth, provider);
      await ensureUserDocIfMissing(user);
      await promoteIfNeeded(user);
      if (fromApp) { cleanUrl(); gotoApp(user); return; }
      goHome();
    }
  } catch (err) {
    console.error("Errore accesso Google:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile accedere con Google"}`);
  } finally {
    setLoading(false);
  }
});