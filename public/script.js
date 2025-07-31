import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Config Firebase
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

const userInfoDiv = document.getElementById("user-info");
const logoutBtn = document.getElementById("logout-btn");
const plansSection = document.getElementById("plans-section");
const premiumOnly = document.getElementById("premium-only");

// Mostra nome e gestisci UI
onAuthStateChanged(auth, async (user) => {
  if (user) {
    let name = user.displayName;

    // Se non esiste displayName, prova a recuperare da Firestore
    if (!name) {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          name = docSnap.data().firstName || user.email;
        } else {
          name = user.email;
        }
      } catch (e) {
        console.error("Errore recupero nome utente:", e);
        name = user.email;
      }
    }

    userInfoDiv.textContent = `👋 Ciao, ${name}!`;
    userInfoDiv.style.display = "block";
    logoutBtn.style.display = "inline-block";
    plansSection.style.display = "none";
    premiumOnly.style.display = "block";
  } else {
    userInfoDiv.style.display = "none";
    logoutBtn.style.display = "none";
    plansSection.style.display = "block";
    premiumOnly.style.display = "none";
  }
});

// Logout
logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => {
    location.reload();
  });
});