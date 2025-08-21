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

// Elementi DOM
const userInfoDiv = document.getElementById("user-info");
const plansSection = document.getElementById("plans-section");
const premiumOnly = document.getElementById("premium-only");
const footerAuthLinks = document.getElementById("auth-links");
const footerLogoutBtn = document.getElementById("footer-logout-btn");

const premiumStatus = document.getElementById("premium-status");
const planInfo = document.getElementById("plan-info");

// Contenitore per call-to-action upgrade (solo free loggato)
const upgradeCTA = document.createElement("div");
upgradeCTA.innerHTML = `
  <h3>🎉 Sei registrato!</h3>
  <p>Vuoi usare gli strumenti senza limiti?</p>
  <a class="btn-small" href="premium.html">🎖️ Passa a Premium</a>
`;

// Stato autenticazione + piano
onAuthStateChanged(auth, async (user) => {
  premiumStatus.style.display = "none";
  planInfo.textContent = "";
  upgradeCTA.remove();

  if (user) {
    // --- Nome utente in header ---
    let name = user.displayName;
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

    // --- Mostra/nascondi sezioni ---
    plansSection.style.display = "none";
    premiumOnly.style.display = "block";
    footerAuthLinks.style.display = "none";
    footerLogoutBtn.style.display = "inline-block";

    // --- Piano attivo ---
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const plan = data.plan || "free";

      premiumStatus.style.display = "block";
      if (plan === "free") {
        planInfo.textContent = "👤 Attualmente sei su piano Free";
        premiumStatus.appendChild(upgradeCTA); // 👈 aggiungi bottone Passa a Premium
      } else {
        if (plan === "premium300") planInfo.textContent = "🎖️ Piano Premium 300 attivo";
        else if (plan === "premium400") planInfo.textContent = "🎖️ Piano Premium 400 attivo";
        else if (plan === "premiumUnlimited") planInfo.textContent = "🎖️ Piano Premium Unlimited attivo";
        else planInfo.textContent = "🎖️ Piano Premium attivo";
      }
    }
  } else {
    // --- Utente non loggato ---
    userInfoDiv.style.display = "none";
    plansSection.style.display = "block";
    premiumOnly.style.display = "none";
    footerAuthLinks.style.display = "inline";
    footerLogoutBtn.style.display = "none";
  }
});

// Logout
footerLogoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => {
    location.reload();
  });
});