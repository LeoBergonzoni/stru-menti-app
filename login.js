import { auth, db } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const loginForm = document.getElementById("login-form");
const googleLoginBtn = document.getElementById("google-login");
const provider = new GoogleAuthProvider();

function goHome() { window.location.replace("index.html"); }
function setLoading(isLoading) { loginForm.querySelectorAll("button").forEach(b => b.disabled = isLoading); }

// Se già autenticato, vai in home
onAuthStateChanged(auth, (u) => { if (u) goHome(); });

// ----- LOGIN EMAIL/PASSWORD con verifica -----
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  setLoading(true);
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);

    // blocca se l'email NON è verificata
    if (!user.emailVerified) {
      try { await sendEmailVerification(user, { url: `${location.origin}/login.html` }); } catch {}
      await signOut(auth);
      alert("Devi prima verificare l’indirizzo email. Ti abbiamo inviato di nuovo il link.");
      return;
    }

    // crea/aggiorna doc utente
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { email: user.email, createdAt: new Date().toISOString(), plan: "free-logged" });
    } else if (!snap.data()?.plan) {
      await setDoc(ref, { plan: "free-logged" }, { merge: true });
    }

    localStorage.setItem("username", user.email);
    goHome();
  } catch (err) {
    console.error("Errore di login:", err);
    alert("Errore: " + (err?.message || "impossibile accedere"));
  } finally {
    setLoading(false);
  }
});

// ----- LOGIN GOOGLE (nessuna verifica extra) -----
googleLoginBtn.addEventListener("click", async () => {
  setLoading(true);
  try {
    const { user } = await signInWithPopup(auth, provider);

    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        email: user.email,
        name: user.displayName,
        createdAt: new Date().toISOString(),
        plan: "free-logged"
      });
    } else if (!snap.data()?.plan) {
      await setDoc(ref, { plan: "free-logged" }, { merge: true });
    }

    localStorage.setItem("username", user.displayName || user.email);
    goHome();
  } catch (err) {
    console.error("Errore accesso Google:", err);
    alert("Errore: " + (err?.message || "impossibile accedere con Google"));
  } finally {
    setLoading(false);
  }
});