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

// --- Firebase config ---
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
const downgradeBtn   = document.getElementById("downgrade-free"); // non usato con Stripe

// --- Costanti ---
const GENERIC_PORTAL_URL = "https://billing.stripe.com/p/login/test_8x29ANaOVdBF6Y0gFzb7y00";

// Helpers UI
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
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = {}; }
    if (!res.ok) throw new Error(data.error || data.message || "createCheckout failed");
    if (!data.url) throw new Error("No checkout url");
    window.location.href = data.url;
  } catch (e) {
    console.error(e);
    alert("Errore nell'apertura del Checkout.\n" + (e.message || ""));
  }
}

// Stripe — Customer Portal (preferito: sessione per customerId)
async function openPortal(customerId) {
  async function call(endpoint) {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
    });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = {}; }
    if (!r.ok) throw new Error(`${endpoint} failed: ${data.message || data.error || text}`);
    if (!data.url) throw new Error("No portal url");
    window.location.href = data.url;
  }
  try {
    await call("/.netlify/functions/createPortal");
  } catch (_) {
    try {
      // fallback se la function è nominata diversamente
      await call("/.netlify/functions/createPortl");
    } catch (e2) {
      console.error(e2);
      alert("Errore nell'apertura del Customer Portal.\n" + (e2.message || ""));
    }
  }
}

// (Facoltativa) utility legacy setPlan per fallback manuali
async function setPlan(uid, plan) {
  const uref = doc(db, "users", uid);
  const snap = await getDoc(uref);
  if (snap.exists()) {
    await updateDoc(uref, { plan });
  } else {
    await setDoc(uref, { plan });
  }
}

// Banner da query (?status=success|cancel)
(function handleQueryBanner(){
  const params = new URLSearchParams(location.search);
  const status = params.get("status");
  if (!status) return;
  const wrap = document.createElement("div");
  wrap.className = "manage-block";
  wrap.style.borderColor = status === "success" ? "#2e7d32" : "#8a2e2e";
  wrap.textContent = status === "success"
    ? "Pagamento completato. Il piano verrà aggiornato tra pochi istanti."
    : "Operazione annullata.";
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

  // Nome e piano
  let displayName = user.displayName || user.email;
  try {
    const uref = doc(db, "users", user.uid);
    const usnap = await getDoc(uref);
    let data = usnap.exists() ? usnap.data() : null;
    if (data?.firstName) displayName = data.firstName;

    const rawPlan = data?.plan || "free";
    const plan = (rawPlan === "free-logged" || rawPlan === "freelogged") ? "free" : rawPlan;

    accountNameEl.textContent = `Ciao, ${displayName}!`;
    currentPlanEl.textContent =
      plan === "free" ? "Stato attuale: Free (utente registrato)" :
      plan === "premium300" ? "Stato attuale: 🎖️ Premium 300" :
      plan === "premium400" ? "Stato attuale: 🎖️ Premium 400" :
      plan === "premiumUnlimited" ? "Stato attuale: 🎖️ Premium Unlimited" :
      `Stato attuale: ${plan}`;

    // pulizia contenitori
    if (freeCta) clear(freeCta);
    if (premiumActions) clear(premiumActions);

    if (plan === "free") {
      // --- Sezione FREE: bottoni Checkout mensile/annuale ---
      show(freeCta); hide(premiumActions);

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
      // --- Sezione PREMIUM: Customer Portal ---
      hide(freeCta); show(premiumActions);

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
        portalBtn.onclick = () => openPortal(customerId); // sessione customer-specific
        note.textContent = "Verrai reindirizzato su Stripe. Al termine, tornerai qui.";
      } else {
        // Fallback: link generico al Portale (login via email)
        portalBtn.onclick = () => window.location.href = GENERIC_PORTAL_URL;
        note.textContent = "Non trovo il tuo ID cliente Stripe. Ti porto al portale: effettua il login via email.";
      }

      premiumActions.classList.add("manage-block");
      premiumActions.append(title, sub, portalBtn, note);
    }

  } catch (e) {
    console.error("Errore lettura piano:", e?.message || e);
    accountNameEl.textContent = `Ciao, ${displayName}!`;
    currentPlanEl.textContent = "Stato attuale: Accesso effettuato";
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

  // Nascondi eventuale bottone di downgrade manuale (ora si fa da Portal)
  if (downgradeBtn) downgradeBtn.style.display = "none";

  // Eliminazione account
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      const step1 = confirm("⚠️ ATTENZIONE: questa azione è irreversibile. Vuoi procedere con l’eliminazione dell’account?");
      if (!step1) return;
      const step2 = confirm("Confermi definitivamente l’eliminazione? Tutti i dati collegati verranno rimossi.");
      if (!step2) return;

      try {
        // elimina doc utente (se presente)
        try { await deleteDoc(doc(db, "users", auth.currentUser.uid)); } catch(_) {}
        // elimina utente Firebase
        await deleteUser(auth.currentUser);
        alert("Account eliminato correttamente.");
        window.location.href = "index.html";
      } catch (err) {
        console.error(err);
        if (err?.code === "auth/requires-recent-login") {
          alert("Per motivi di sicurezza devi rieseguire l’accesso e poi riprovare a eliminare l’account.");
        } else {
          alert("Errore nell’eliminazione dell’account.");
        }
      }
    };
  }
});