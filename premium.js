// --- Tabs ---
const monthlyTab = document.getElementById('tab-monthly');
const annualTab = document.getElementById('tab-annual');
const monthlySection = document.getElementById('monthly');
const annualSection = document.getElementById('annual');

function showMonthly() {
  monthlyTab.classList.add('active');
  annualTab.classList.remove('active');
  monthlySection.style.display = 'block';
  annualSection.style.display = 'none';
}
function showAnnual() {
  annualTab.classList.add('active');
  monthlyTab.classList.remove('active');
  annualSection.style.display = 'block';
  monthlySection.style.display = 'none';
}
monthlyTab.addEventListener('click', showMonthly);
annualTab.addEventListener('click', showAnnual);

// --- Firebase Auth (per passare uid/email al checkout) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Usa la stessa config che hai nell'home (script.js)
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

// --- Util ---
async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

// --- Click su "Sottoscrivi e paga" ---
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button.btn-small[data-plan][data-billing]');
  if (!btn) return;
  const { plan, billing } = btn.dataset;

  // se l'utente è loggato, inviamo uid/email per collegare la subscription
  const user = auth.currentUser;
  const uid = user ? user.uid : null;
  const email = user ? user.email : null;

  try {
    const { url } = await postJSON('/.netlify/functions/createCheckout', { plan, billing, uid, email });
    window.location.href = url; // redirect a Stripe Checkout
  } catch (err) {
    console.error(err);
    alert('Errore durante la creazione del checkout.');
  }
});