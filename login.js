import { auth, db } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// 👇 aggiungi queste due righe (se non ci sono già nel file)
const loginForm = document.getElementById("login-form");
const googleLoginBtn = document.getElementById("google-login");

// Provider Google
const provider = new GoogleAuthProvider();

function goHome() {
  // Redirect diretto senza tenere la pagina di login nello history
  window.location.replace("index.html");
}

function setLoading(isLoading) {
  const btns = loginForm.querySelectorAll("button");
  btns.forEach(b => (b.disabled = isLoading));
}

// ✅ Se sei già autenticato, vai subito in home
onAuthStateChanged(auth, (u) => {
  if (u) goHome();
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  setLoading(true);
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);

    // Crea/aggiorna record utente
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        createdAt: new Date().toISOString(),
        plan: "free-logged"
      });
    } else if (!snap.data()?.plan) {
      await setDoc(userRef, { plan: "free-logged" }, { merge: true });
    }

    localStorage.setItem("username", user.email);
    goHome();
  } catch (error) {
    console.error("Errore di login:", error);
    alert("Errore: " + (error?.message || "impossibile accedere"));
  } finally {
    setLoading(false);
  }
});

googleLoginBtn.addEventListener("click", async () => {
  setLoading(true);
  try {
    const { user } = await signInWithPopup(auth, provider);

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        name: user.displayName,
        createdAt: new Date().toISOString(),
        plan: "free-logged"
      });
    } else if (!snap.data()?.plan) {
      await setDoc(userRef, { plan: "free-logged" }, { merge: true });
    }

    localStorage.setItem("username", user.displayName || user.email);
    goHome();
  } catch (error) {
    console.error("Errore accesso Google:", error);
    alert("Errore: " + (error?.message || "impossibile accedere con Google"));
  } finally {
    setLoading(false);
  }
});