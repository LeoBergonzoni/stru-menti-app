import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  deleteUser,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// --- Firebase config (stessa del progetto) ---
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

// --- DOM ---
const guardNoLogin   = document.getElementById("guard-nologin");
const accountArea    = document.getElementById("account-area");
const accountNameEl  = document.getElementById("account-name");
const currentPlanEl  = document.getElementById("current-plan");
const freeCta        = document.getElementById("free-cta");
const premiumActions = document.getElementById("premium-actions");
const deleteBtn      = document.getElementById("delete-account");
const downgradeBtn   = document.getElementById("downgrade-free"); // non usato con Stripe ma lasciato se presente in HTML

// Helpers
function show(el){ if(el) el.style.display = ""; }
function hide(el){ if(el) el.style.display = "none"; }
function btn(label, className = "btn", attrs = {}) {
  const b = document.createElement("button");
  b.className = className;
  b.textContent = label;
  Object.entries(attrs).forEach(([k,v]) => b.setAttribute(k, v));
  return b;
}
function clear(el){ if(el) el.innerHTML = ""; }

// Stripe — Checkout (piano & fatturazione)
async function goCheckout(plan, billing, uid, email) {
  try {
    const res = await fetch("/.netlify/functions/createCheckout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, billing, uid, email }),
    });
    if (!res.ok) throw new Error("createCheckout failed");
    const { url } = await res.json();
    if (url) window.location.href = url;
    else throw new Error("No checkout url");
  } catch (e) {
    console.error(e);
    alert("Errore nell'apertura del Checkout.");
  }
}

// Stripe — Customer Portal (fallback se il file si chiama createPortl.js)
async function openPortal(customerId) {
  async function call(endpoint) {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
    });
    if (!r.ok) throw new Error(endpoint + " failed");
    const { url } = await r.json();
    if (!url) throw new Error("No portal url");
    window.location.href = url;
  }
  try {
    await call("/.netlify/functions/createPortal");
  } catch (_) {
    try {
      await call("/.netlify/functions/createPortl");
    } catch (e2) {
      console.error(e2);
      alert("Errore nell'apertura del Customer Portal.");
    }
  }
}

// (Opzionale) vecchia utility per scrivere direttamente il piano su Firestore.
// Con Stripe NON la usiamo per cambiare piano, ma la teniamo per eventuali fallback.
async function setPlan(uid, plan) {
  const uref = doc(db, "users", uid);
  const snap = await getDoc(uref);
  if (snap.exists()) {
    await updateDoc(uref, { plan });
  } else {
    await setDoc(uref, { plan });
  }
}

// Banner di stato da query (?status=success|cancel)
(function handleQueryBanner(){
  const params = new URLSearchParams(location.search);
  const status = params.get("status");
  if (!status) return;
  const wrap = document.createElement("div");
  wrap.className = "manage-block";
  wrap.style.borderColor = status === "success" ? "#2e7d32" : "#8a2e2e";
  wrap.textContent = status === "success" ?
    "Pagamento completato correttamente. Il piano verrà aggiornato tra pochi istanti." :
    "Operazione annullata.";
  const main = document.querySelector("main.manage-wrap") || document.body;
  main.insertBefore(wrap, main.firstChild);
})();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    show(guardNoLogin);
    hide(accountArea);
    return;
  }
  hide(guardNoLogin);
  show(accountArea);

  // Mostra nome e piano attuale
  let displayName = user.displayName || user.email;
  try {
    const uref = doc(db, "users", user.uid);
    const usnap = await getDoc(uref);
    let data = usnap.exists() ? usnap.data() : null;
    if (data?.firstName) displayName = data.firstName;

    // Piano corrente (normalizzato)
    const rawPlan = data?.plan || "free";
    const plan = (rawPlan === "free-logged" || rawPlan === "freelogged") ? "free" : rawPlan;

    accountNameEl.textContent = `Ciao, ${displayName}!`;
    currentPlanEl.textContent =
      plan === "free" ? "Stato attuale: Free (utente registrato)" :
      plan === "premium300" ? "Stato attuale: 🎖️ Premium 300" :
      plan === "premium400" ? "Stato attuale: 🎖️ Premium 400" :
      plan === "premiumUnlimited" ? "Stato attuale: 🎖️ Premium Unlimited" :
      `Stato attuale: ${plan}`;

    // PULIZIA contenitori dinamici
    if (freeCta) clear(freeCta);
    if (premiumActions) clear(premiumActions);

    // UI in base al piano (Stripe-first)
    if (plan === "free") {
      // Sezione FREE: mostra scelte di upgrade via Checkout (mensile/annuale)
      show(freeCta);
      hide(premiumActions);

      const title = document.createElement("h3");
      title.className = "manage-title";
      title.textContent = "Vuoi passare a Premium?";

      const sub = document.createElement("p");
      sub.className = "manage-subtle";
      sub.textContent = "Sblocca limiti più alti (o illimitati) e funzioni aggiuntive.";

      const rowMonthly = document.createElement("div");
      rowMonthly.className = "manage-row";
      rowMonthly.append("Fatturazione mensile: ");

      const rowAnnual = document.createElement("div");
      rowAnnual.className = "manage-row";
      rowAnnual.append("Fatturazione annuale: ");

      const m300 = btn("Premium 300", "btn btn-primary");
      const m400 = btn("Premium 400", "btn btn-primary");
      const mUnl = btn("Premium Unlimited", "btn btn-primary");
      m300.onclick = () => goCheckout("premium300", "monthly", user.uid, user.email);
      m400.onclick = () => goCheckout("premium400", "monthly", user.uid, user.email);
      mUnl.onclick = () => goCheckout("premiumUnlimited", "monthly", user.uid, user.email);

      const a300 = btn("Premium 300", "btn");
      const a400 = btn("Premium 400", "btn");
      const aUnl = btn("Premium Unlimited", "btn");
      a300.onclick = () => goCheckout("premium300", "annual", user.uid, user.email);
      a400.onclick = () => goCheckout("premium400", "annual", user.uid, user.email);
      aUnl.onclick = () => goCheckout("premiumUnlimited", "annual", user.uid, user.email);

      rowMonthly.append(m300, " ", m400, " ", mUnl);
      rowAnnual.append(a300, " ", a400, " ", aUnl);

      freeCta.classList.add("manage-block");
      freeCta.append(title, sub, rowMonthly, rowAnnual);

    } else {
      // Sezione PREMIUM: mostra Customer Portal (upgrade/downgrade/cancel su Stripe)
      hide(freeCta);
      show(premiumActions);

      const title = document.createElement("h3");
      title.className = "manage-title";
      title.textContent = "Gestisci piano Premium";

      const sub = document.createElement("p");
      sub.className = "manage-subtle";
      sub.textContent = "Apri il Customer Portal per cambiare piano o annullare la sottoscrizione.";

      const portalBtn = btn("Apri area pagamenti (Customer Portal)", "btn btn-primary");
      const note = document.createElement("p");
      note.className = "manage-subtle";

      const customerId = data?.stripe?.customer || data?.stripeCustomerId || null;
      if (customerId) {
        portalBtn.onclick = () => openPortal(customerId);
        note.textContent = "Verrai reindirizzato su Stripe. Al termine, tornerai qui.";
      } else {
        portalBtn.disabled = true;
        note.textContent = "Dati cliente Stripe non trovati. Completa un acquisto o contatta il supporto.";
      }

      premiumActions.classList.add("manage-block");
      premiumActions.append(title, sub, portalBtn, note);
    }

  } catch (e) {
    console.error("Errore lettura piano:", e?.message || e);
    accountNameEl.textContent = `Ciao, ${displayName}!`;
    currentPlanEl.textContent = "Stato attuale: Accesso effettuato";
    // fallback: mostra freeCta base
    if (freeCta) {
      clear(freeCta);
      freeCta.classList.add("manage-block");
      freeCta.innerHTML = `
        <h3 class="manage-title">Vuoi passare a Premium?</h3>
        <p class="manage-subtle">Sblocca limiti più alti (o illimitati) e funzioni aggiuntive.</p>
        <a class="btn btn-primary" href="premium.html">Vedi i piani Premium</a>
      `;
      show(freeCta);
    }
    if (premiumActions) hide(premiumActions);
  }

  // (DISABILITATO) Downgrade diretto su Firestore: ora si fa dal Portal
  if (downgradeBtn) {
    downgradeBtn.style.display = "none";
  }

 // Eliminazione account
if (deleteBtn) {
  deleteBtn.onclick = async () => {
    const step1 = confirm("⚠️ ATTENZIONE: questa azione è irreversibile. Vuoi procedere con l’eliminazione dell’account?");
    if (!step1) return;
    const step2 = confirm("Confermi definitivamente l’eliminazione? Tutti i dati collegati verranno rimossi.");
    if (!step2) return;

    try {
      // 1) elimina doc utente (se presente)
      try { await deleteDoc(doc(db, "users", user.uid)); } catch(_) {}

      // 2) elimina utente Firebase (usa SEMPRE 'user' passato dal listener, NON auth.currentUser)
      await deleteUser(user);

      alert("Account eliminato correttamente.");
      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      // Questo errore non si può "togliere": è una protezione di Firebase.
      if (err?.code === "auth/requires-recent-login") {
        alert("Per motivi di sicurezza devi rieseguire l’accesso e poi riprovare a eliminare l’account.");
        // opzionale: redirect alla login con ritorno automatico a manage
        // window.location.href = "login.html?returnTo=manage.html&action=delete";
      } else {
        alert("Errore nell’eliminazione dell’account.");
      }
    }
  };
}
});