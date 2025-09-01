import { auth } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { ensureUserDoc } from "/shared/ensureUserDoc.js";

const signupForm = document.getElementById("signup-form");
const googleSignupBtn = document.getElementById("google-signup");

const provider = new GoogleAuthProvider();

function goHome() { window.location.replace("index.html"); }
function setLoading(isLoading) {
  signupForm.querySelectorAll("button").forEach(b => b.disabled = isLoading);
}

// Se già autenticato, vai in home
onAuthStateChanged(auth, (u) => { if (u) goHome(); });

// Registrazione email/password
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = signupForm.email.value.trim();
  const password = signupForm.password.value;
  const confirmPassword = signupForm.confirmPassword.value;

  if (password !== confirmPassword) {
    alert("Le password non coincidono.");
    return;
  }

  setLoading(true);
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);

    // Invia email di verifica
    await sendEmailVerification(user, { url: `${location.origin}/login.html` });

    // Logout immediato: accesso solo dopo verifica
    await signOut(auth);

    alert("Ti abbiamo inviato un'email per verificare l'indirizzo. Dopo la verifica potrai accedere.");
    window.location.href = "login.html";
  } catch (err) {
    console.error("Errore registrazione:", err);
    alert("Errore: " + (err?.message || "impossibile registrarsi"));
  } finally {
    setLoading(false);
  }
});

// Registrazione / accesso con Google (nessuna verifica aggiuntiva)
googleSignupBtn.addEventListener("click", async () => {
  setLoading(true);
  try {
    const { user } = await signInWithPopup(auth, provider);
    await ensureUserDoc(auth, db);
    goHome();
  } catch (err) {
    console.error("Errore con Google:", err);
    alert("Errore: " + (err?.message || "impossibile registrarsi con Google"));
  } finally {
    setLoading(false);
  }
});