// signup.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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
const provider = new GoogleAuthProvider();

const signupForm = document.getElementById("signup-form");

signupForm.addEventListener("submit", (e) => {
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

  createUserWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      console.log("Registrazione riuscita:", user);
      alert("Registrazione riuscita! Redirect in corso...");
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Errore durante la registrazione:", error);
      alert("Errore: " + error.message);
    });
});

const googleSignupBtn = document.getElementById("google-signup");
googleSignupBtn.addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      console.log("Registrazione con Google riuscita:", user);
      alert("Accesso con Google riuscito! Redirect in corso...");
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Errore con Google:", error);
      alert("Errore: " + error.message);
    });
});