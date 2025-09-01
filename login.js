import { auth, db } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { ensureUserDoc } from "/shared/ensureUserDoc.js";

const loginForm = document.getElementById("login-form");
const googleLoginBtn = document.getElementById("google-login");
const provider = new GoogleAuthProvider();

function goHome() { window.location.replace("index.html"); }
function setLoading(isLoading) {
  loginForm.querySelectorAll("button").forEach(b => b.disabled = isLoading);
}

// Se già autenticato, vai in home
onAuthStateChanged(auth, (u) => { if (u) goHome(); });

// Login con email/password
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  setLoading(true);
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);

    if (!user.emailVerified) {
      try { await sendEmailVerification(user, { url: `${location.origin}/login.html` }); } catch {}
      await signOut(auth);
      alert("Devi prima verificare la tua email. Ti abbiamo inviato di nuovo il link.");
      return;
    }

    await ensureUserDoc(auth, db);

    localStorage.setItem("username", user.email);
    goHome();
  } catch (err) {
    console.error("Errore login:", err);
    alert("Errore: " + (err?.message || "impossibile accedere"));
  } finally {
    setLoading(false);
  }
});

// Login con Google
googleLoginBtn.addEventListener("click", async () => {
  setLoading(true);
  try {
    const { user } = await signInWithPopup(auth, provider);
    await ensureUserDoc(auth, db);
    localStorage.setItem("username", user.displayName || user.email);
    goHome();
  } catch (err) {
    console.error("Errore accesso Google:", err);
    alert("Errore: " + (err?.message || "impossibile accedere con Google"));
  } finally {
    setLoading(false);
  }
});