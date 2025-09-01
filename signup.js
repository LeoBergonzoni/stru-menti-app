// signup.js
import { auth, db } from "/shared/firebase.js";
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
  const btns = signupForm.querySelectorAll("button");
  btns.forEach((b) => (b.disabled = isLoading));
}

// Se già autenticato, vai in home
onAuthStateChanged(auth, (u) => { if (u) goHome(); });

// Registrazione email/password (→ richiede verifica email)
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = signupForm.email.value.trim();
  const password = signupForm.password.value;
  const confirmPassword = signupForm.confirmPassword.value;
  const firstName = signupForm.firstName.value.trim();
  const lastName = signupForm.lastName.value.trim();

  if (password !== confirmPassword) {
    alert("Le password non coincidono.");
    return;
  }

  setLoading(true);
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);

    // crea/aggiorna doc utente con i dati del form
    await ensureUserDoc(auth, db, { firstName, lastName });

    // Invia email di verifica e disconnetti
    await sendEmailVerification(user, { url: `${location.origin}/login.html`, handleCodeInApp: false });
    await signOut(auth);

    alert("Ti abbiamo inviato un'email per verificare l'indirizzo. Apri il link e poi accedi.");
    window.location.href = "login.html";
  } catch (error) {
    console.error("Errore durante la registrazione:", error);
    alert("Errore: " + (error?.message || "impossibile registrarsi"));
  } finally {
    setLoading(false);
  }
});

// Registrazione / accesso con Google (NESSUNA verifica aggiuntiva)
googleSignupBtn.addEventListener("click", async () => {
  setLoading(true);
  try {
    const { user } = await signInWithPopup(auth, provider);

    // puoi anche passare i nomi ricavati da displayName, ma non è necessario
    await ensureUserDoc(auth, db);

    goHome();
  } catch (error) {
    console.error("Errore con Google:", error);
    alert("Errore: " + (error?.message || "impossibile registrarsi con Google"));
  } finally {
    setLoading(false);
  }
});