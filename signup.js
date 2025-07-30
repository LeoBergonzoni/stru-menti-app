// signup.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCRLUzNFa7GPLKzLYD440lNLONeUZGe-gI",
  authDomain: "stru-menti.firebaseapp.com",
  projectId: "stru-menti",
  storageBucket: "stru-menti.appspot.com",
  messagingSenderId: "851395234512",
  appId: "1:851395234512:web:9b2d36080c23ba4a2cecd5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Registrazione classica
const signupForm = document.getElementById("signup-form");

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = signupForm.email.value;
  const password = signupForm.password.value;
  const confirmPassword = signupForm.confirmPassword.value;
  const firstName = signupForm.firstName.value;
  const lastName = signupForm.lastName.value;

  if (password !== confirmPassword) {
    alert("Le password non coincidono.");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
      firstName,
      lastName,
      email,
      createdAt: new Date()
    });

    alert("Registrazione riuscita! Redirect in corso...");
    window.location.href = "index.html";
  } catch (error) {
    console.error("Errore durante la registrazione:", error);
    alert("Errore: " + error.message);
  }
});

// Registrazione con Google
const googleSignupBtn = document.getElementById("google-signup");

googleSignupBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const fullName = user.displayName || "";
    const [firstName, lastName] = fullName.split(" ");

    await setDoc(doc(db, "users", user.uid), {
      firstName: firstName || "",
      lastName: lastName || "",
      email: user.email,
      createdAt: new Date()
    }, { merge: true });

    alert("Accesso con Google riuscito! Redirect in corso...");
    window.location.href = "index.html";
  } catch (error) {
    console.error("Errore con Google:", error);
    alert("Errore: " + error.message);
  }
});