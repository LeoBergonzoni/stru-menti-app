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
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const signupForm = document.getElementById("signup-form");
const googleSignupBtn = document.getElementById("google-signup");

const provider = new GoogleAuthProvider();

function goHome() {
  window.location.replace("index.html");
}

function setLoading(isLoading) {
  const btns = signupForm.querySelectorAll("button");
  btns.forEach((b) => (b.disabled = isLoading));
}

// Se già autenticato, vai in home
onAuthStateChanged(auth, (u) => {
  if (u) goHome();
});

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

    // Crea/merge un doc utente base (verrà comunque creato anche dal trigger onCreate lato server)
    await setDoc(
      doc(db, "users", user.uid),
      {
        firstName,
        lastName,
        email,
        plan: "free-logged",
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Invia email di verifica (Firebase Auth spedisce il messaggio con il tuo template)
    await sendEmailVerification(user, {
      url: `${location.origin}/login.html`, // dopo la verifica li riporti al login
      handleCodeInApp: false,
    });

    // Logout immediato: l’utente potrà accedere solo dopo aver cliccato il link
    await signOut(auth);

    alert(
      "Ti abbiamo inviato un'email per verificare l'indirizzo. Apri il link di verifica e poi accedi con le tue credenziali."
    );
    // Resta su questa pagina o porta al login
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

    const fullName = user.displayName || "";
    const [firstName = "", lastName = ""] = fullName.split(" ");

    await setDoc(
      doc(db, "users", user.uid),
      {
        firstName,
        lastName,
        email: user.email,
        plan: "free-logged",
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    goHome();
  } catch (error) {
    console.error("Errore con Google:", error);
    alert("Errore: " + (error?.message || "impossibile registrarsi con Google"));
  } finally {
    setLoading(false);
  }
});