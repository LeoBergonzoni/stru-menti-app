// signup.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc
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

const signupForm = document.getElementById("signup-form");
const googleSignupBtn = document.getElementById("google-signup");

function goHome() {
  // Redirect diretto senza tenere la pagina di signup nello history
  window.location.replace("index.html");
}

function setLoading(isLoading) {
  const btns = signupForm.querySelectorAll("button");
  btns.forEach(b => (b.disabled = isLoading));
}

// ✅ Se sei già autenticato, vai subito in home
onAuthStateChanged(auth, (u) => {
  if (u) goHome();
});

// Registrazione email/password
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

    await setDoc(doc(db, "users", user.uid), {
      firstName,
      lastName,
      email,
      createdAt: new Date().toISOString(),
      plan: "free-logged"
    }, { merge: true });

    goHome();
  } catch (error) {
    console.error("Errore durante la registrazione:", error);
    alert("Errore: " + (error?.message || "impossibile registrarsi"));
  } finally {
    setLoading(false);
  }
});

// Registrazione / accesso con Google
googleSignupBtn.addEventListener("click", async () => {
  setLoading(true);
  try {
    const { user } = await signInWithPopup(auth, provider);

    const fullName = user.displayName || "";
    const [firstName = "", lastName = ""] = fullName.split(" ");

    await setDoc(doc(db, "users", user.uid), {
      firstName,
      lastName,
      email: user.email,
      createdAt: new Date().toISOString(),
      plan: "free-logged"
    }, { merge: true });

    goHome();
  } catch (error) {
    console.error("Errore con Google:", error);
    alert("Errore: " + (error?.message || "impossibile registrarsi con Google"));
  } finally {
    setLoading(false);
  }
});