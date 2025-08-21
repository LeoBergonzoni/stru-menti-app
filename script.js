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
const db   = getFirestore(app);

// Elementi DOM (tutti opzionali, mettiamo i null‑check)
const userInfoDiv     = document.getElementById("user-info");
const plansSection    = document.getElementById("plans-section");
const footerAuthLinks = document.getElementById("auth-links");
const footerLogoutBtn = document.getElementById("footer-logout-btn");

// Badge piano
const premiumStatus = document.getElementById("premium-status");
const planInfo      = document.getElementById("plan-info");

// CTA per free loggato
const upgradeCTA = document.createElement("div");
upgradeCTA.innerHTML = `
  <h3>🎉 Sei registrato!</h3>
  <p>Vuoi usare gli strumenti senza limiti?</p>
  <a class="btn-small" href="premium.html">🎖️ Passa a Premium</a>
`;

function show(el)  { if (el) el.style.display = "block"; }
function hide(el)  { if (el) el.style.display = "none"; }

onAuthStateChanged(auth, async (user) => {
  // reset badge
  if (premiumStatus) {
    premiumStatus.style.display = "none";
    if (planInfo) planInfo.textContent = "";
    // rimuovi eventuale CTA appesa in precedenza
    try { upgradeCTA.remove(); } catch {}

  }

  if (!user) {
    // === Utente NON loggato ===
    if (userInfoDiv) userInfoDiv.style.display = "none";
    show(plansSection);                 // vedi i piani
    show(footerAuthLinks);              // "Accedi | Registrati"
    hide(footerLogoutBtn);              // nascondi "Esci"
    return;
  }

  // === Utente loggato ===
  // Header: saluto con nome
  if (userInfoDiv) {
    let name = user.displayName || user.email;
    try {
      const uref = doc(db, "users", user.uid);
      const usnap = await getDoc(uref);
      if (usnap.exists()) {
        const d = usnap.data();
        name = d.firstName || user.email || name;
      }
    } catch (e) {
      // in caso di errore, continuiamo comunque
      console.warn("Nome utente non recuperato:", e?.message || e);
    }
    userInfoDiv.textContent = `👋 Ciao, ${name}!`;
    userInfoDiv.style.display = "block";
  }

  // Footer: link auth
  hide(footerAuthLinks);   // non mostrare "Accedi | Registrati"
  show(footerLogoutBtn);   // mostra "Esci"

  // Nascondi i piani quando sei loggato
  hide(plansSection);

  // Badge piano attivo
  try {
    const userRef = doc(db, "users", user.uid);
    const snap    = await getDoc(userRef);
    let plan      = "free";
    if (snap.exists()) plan = snap.data().plan || "free";

    if (premiumStatus) {
      show(premiumStatus);

      if (plan === "free") {
        if (planInfo) planInfo.textContent = "👤 Attualmente sei su piano Free";
        // Aggiungi CTA "Passa a Premium"
        premiumStatus.appendChild(upgradeCTA);
      } else {
        // Premium
        let label = "🎖️ Piano Premium attivo";
        if (plan === "premium300")      label = "🎖️ Piano Premium 300 attivo";
        else if (plan === "premium400") label = "🎖️ Piano Premium 400 attivo";
        else if (plan === "premiumUnlimited") label = "🎖️ Piano Premium Unlimited attivo";
        if (planInfo) planInfo.textContent = label;
      }
    }
  } catch (e) {
    console.error("Errore lettura piano utente:", e?.message || e);
    // In caso di errore mostriamo almeno lo stato loggato base
    if (premiumStatus && planInfo) {
      show(premiumStatus);
      planInfo.textContent = "👤 Accesso effettuato";
    }
  }
});

// Logout
if (footerLogoutBtn) {
  footerLogoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => location.reload());
  });
}