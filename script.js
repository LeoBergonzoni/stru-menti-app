import { auth, db } from "/shared/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Elementi DOM
const userInfoDiv     = document.getElementById("user-info");
const plansSection    = document.getElementById("plans-section");
const footerAuthLinks = document.getElementById("auth-links");
const footerLogoutBtn = document.getElementById("footer-logout-btn");
const manageBtn       = document.getElementById("manage-account-btn");

// Badge piano
const premiumStatus = document.getElementById("premium-status");
const planInfo      = document.getElementById("plan-info");

function show(el) { if (el) el.style.display = "block"; }
function hide(el) { if (el) el.style.display = "none"; }

// CTA HTML per free loggato
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
  // reset base
  if (premiumStatus) premiumStatus.style.display = "none";
  if (planInfo) { planInfo.textContent = ""; planInfo.style.display = ""; }
  document.getElementById("free-cta")?.remove();

  if (!user) {
    // === Non loggato ===
    if (userInfoDiv) userInfoDiv.style.display = "none";
    show(plansSection);
    show(footerAuthLinks);
    hide(footerLogoutBtn);
    if (manageBtn) manageBtn.style.display = "none";
    return;
  }

  // === Loggato ===
  // 1) Assicura che esista SEMPRE users/{uid} con plan: "free"
  try {
    const uref = doc(db, "users", user.uid);
    const usnap = await getDoc(uref);
    if (!usnap.exists()) {
      await setDoc(uref, {
        plan: "free",
        billing: null,
        clicksPerTool: 40,
        createdAt: new Date(),
        email: user.email || null,
        firstName: (user.displayName?.split(" ")[0]) || null
      }, { merge: true });
      // opzionale: console.log("Creato doc utente Firestore per", user.uid);
    }
  } catch (e) {
    console.warn("Impossibile creare il doc utente:", e?.message || e);
  }

  // 2) Saluto con nome
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
  if (manageBtn) manageBtn.style.display = "inline-block";

  // 3) Piano attivo per badge/CTA
  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    let rawPlan = "free";
    if (snap.exists()) rawPlan = snap.data().plan || "free";
    const plan = (rawPlan === "free-logged" || rawPlan === "freelogged") ? "free" : rawPlan;

    if (premiumStatus) {
      show(premiumStatus);

      if (plan === "free") {
        if (planInfo) planInfo.style.display = "none";
        const cta = ensureFreeCTA();
        if (!premiumStatus.contains(cta)) premiumStatus.appendChild(cta);
      } else {
        document.getElementById("free-cta")?.remove();
        if (planInfo) {
          planInfo.style.display = "";
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
      console.error(error.code, error.message);
alert(`Errore: ${error.code} — ${error.message}`);
    }
  }
});

// Logout
if (footerLogoutBtn) {
  footerLogoutBtn.addEventListener("click", () => {
    signOut(auth).then(() => location.reload());
  });
}