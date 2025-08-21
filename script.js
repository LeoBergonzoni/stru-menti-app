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

// Elementi DOM
const userInfoDiv     = document.getElementById("user-info");
const plansSection    = document.getElementById("plans-section");
const footerAuthLinks = document.getElementById("auth-links");
const footerLogoutBtn = document.getElementById("footer-logout-btn");

// Badge piano
const premiumStatus = document.getElementById("premium-status");
const planInfo      = document.getElementById("plan-info");

function show(el) { if (el) el.style.display = "block"; }
function hide(el) { if (el) el.style.display = "none"; }

// CTA HTML per free loggato (come blocco separato)
const FREE_CTA_HTML = `
  <h3>🎉 Sei registrato!</h3>
  <p>Vuoi usare gli strumenti senza limiti?</p>
  <a class="btn-small" href="premium.html">🎖️ Passa a Premium</a>
`;
function ensureFreeCTA() {
  let el = document.getElementById("free-cta");
  if (!el) {
    el = document.createElement("div");
    el.id = "free-cta";
    el.innerHTML = FREE_CTA_HTML;
  }
  return el;
}

onAuthStateChanged(auth, async (user) => {
  // reset base (NON rimuovere planInfo dal DOM!)
  if (premiumStatus) {
    premiumStatus.style.display = "none";
  }
  if (planInfo) {
    planInfo.textContent = "";
    planInfo.style.display = ""; // assicurati sia visibile quando serve
  }
  // rimuovi eventuale CTA precedente
  document.getElementById("free-cta")?.remove();

  if (!user) {
    // === Non loggato ===
    if (userInfoDiv) userInfoDiv.style.display = "none";
    show(plansSection);
    show(footerAuthLinks);
    hide(footerLogoutBtn);
    return;
  }

  // === Loggato ===
  // Saluto con nome
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
      console.warn("Nome utente non recuperato:", e?.message || e);
    }
    userInfoDiv.textContent = `👋 Ciao, ${name}!`;
    userInfoDiv.style.display = "block";
  }

  hide(plansSection);
  hide(footerAuthLinks);
  show(footerLogoutBtn);

  // Piano attivo
  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    let rawPlan = "free";
    if (snap.exists()) rawPlan = snap.data().plan || "free";

    // normalizza "free-logged"/"freelogged" → "free"
    const plan = (rawPlan === "free-logged" || rawPlan === "freelogged") ? "free" : rawPlan;

    if (premiumStatus) {
      show(premiumStatus);

      if (plan === "free") {
        // Free loggato → Mostra CTA completa
        if (planInfo) planInfo.style.display = "none"; // nascondi text badge
        const cta = ensureFreeCTA();
        if (!premiumStatus.contains(cta)) premiumStatus.appendChild(cta);
      } else {
        // Premium → mostra SOLO l'etichetta del piano
        document.getElementById("free-cta")?.remove(); // assicura che la CTA non resti
        if (planInfo) {
          planInfo.style.display = ""; // assicurati sia visibile
          let label = "🎖️ Piano Premium attivo";
          if (plan === "premium300") label = "🎖️ Piano Premium 300 attivo";
          else if (plan === "premium400") label = "🎖️ Piano Premium 400 attivo";
          else if (plan === "premiumUnlimited") label = "🎖️ Piano Premium Unlimited attivo";
          planInfo.textContent = label;
        }
      }
    }
  } catch (e) {
    console.error("Errore lettura piano utente:", e?.message || e);
    if (premiumStatus && planInfo) {
      show(premiumStatus);
      planInfo.style.display = "";
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