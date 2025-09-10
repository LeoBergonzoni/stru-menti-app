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

function goHome() {
  window.location.replace("index.html");
}
function setLoading(b) {
  loginForm?.querySelectorAll("button").forEach((x) => (x.disabled = b));
}

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email || null,
      // non forzare verified qui: è solo il profilo base
      plan: "free-logged",
      createdAt: new Date().toISOString(),
    }, { merge: true });
  } else {
    const cur = snap.data() || {};
    if (!("plan" in cur)) {
      await setDoc(ref, { plan: "free-logged" }, { merge: true });
    }
  }
}

// Se torni da signInWithRedirect → completa
(async function handleRedirectIfAny() {
  try {
    const res = await getRedirectResult(auth);
    if (res?.user) {
      await ensureUserDoc(res.user);
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
    if (fromApp) qp.set("redirect_uri", redirectUri || "stru-menti://auth");
    location.replace("verify-email.html?" + qp.toString());
    return;
  }
  // altrimenti flusso standard:
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
    await ensureUserDoc(user);

    const isEmailPwd = (user.providerData?.[0]?.providerId === "password");
    if (isEmailPwd && !user.emailVerified) {
      try { await reload(user); } catch {}
      if (!user.emailVerified) {
        try {
          await sendEmailVerification(user, {
          url: location.origin + "/index.html",
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

    if (fromApp || isEmbedded) {
      cleanUrl();
      gotoApp(user);
      return;
    }
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
      // ritorno → getRedirectResult
    } else {
      const { user } = await signInWithPopup(auth, provider);
      await ensureUserDoc(user);
      if (fromApp) {
        cleanUrl();
        gotoApp(user);
        return;
      }
      goHome();
    }
  } catch (err) {
    console.error("Errore accesso Google:", err?.code, err?.message, err);
    alert(`Errore: ${err?.message || "impossibile accedere con Google"}`);
  } finally {
    setLoading(false);
  }
});