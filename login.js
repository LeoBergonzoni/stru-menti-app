// login.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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

const loginForm = document.getElementById("login-form");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = loginForm.email.value;
  const password = loginForm.password.value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        email: user.email,
        createdAt: new Date().toISOString(),
        plan: "free-logged"
      });
    } else {
      const data = userDoc.data();
      if (!data.plan) {
        await setDoc(userRef, { plan: "free-logged" }, { merge: true });
      }
    }

    localStorage.setItem("username", user.email);
    alert("Accesso riuscito! Reindirizzamento...");
    window.location.href = "index.html";

  } catch (error) {
    console.error("Errore di login:", error);
    alert("Errore: " + error.message);
  }
});

const googleLoginBtn = document.getElementById("google-login");

googleLoginBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        email: user.email,
        name: user.displayName,
        createdAt: new Date().toISOString(),
        plan: "free-logged"
      });
    } else {
      const data = userDoc.data();
      if (!data.plan) {
        await setDoc(userRef, { plan: "free-logged" }, { merge: true });
      }
    }

    localStorage.setItem("username", user.displayName || user.email);
    alert("Accesso con Google effettuato! Reindirizzamento...");
    window.location.href = "index.html";

  } catch (error) {
    console.error("Errore accesso Google:", error);
    alert("Errore: " + error.message);
  }
});