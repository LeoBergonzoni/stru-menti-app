// --- Tabs ---
const monthlyTab = document.getElementById('tab-monthly');
const annualTab  = document.getElementById('tab-annual');
const monthlySection = document.getElementById('monthly');
const annualSection  = document.getElementById('annual');

function showMonthly() {
  monthlyTab.classList.add('active');
  annualTab.classList.remove('active');
  monthlyTab.setAttribute('aria-selected', 'true');
  annualTab.setAttribute('aria-selected', 'false');
  monthlySection.style.display = 'block';
  annualSection.style.display  = 'none';
}
function showAnnual() {
  annualTab.classList.add('active');
  monthlyTab.classList.remove('active');
  annualTab.setAttribute('aria-selected', 'true');
  monthlyTab.setAttribute('aria-selected', 'false');
  annualSection.style.display  = 'block';
  monthlySection.style.display = 'none';
}
monthlyTab.addEventListener('click', showMonthly);
annualTab.addEventListener('click', showAnnual);

import { auth } from "/shared/firebase.js";

// --- Utils ---
async function postJSON(url, data, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const msg = await res.text().catch(()=> 'Network error');
    throw new Error(msg || 'Network error');
  }
  return res.json();
}

// Se non loggato, salva intento e porta al login
function requireLoginThen(plan, billing) {
  sessionStorage.setItem('postLoginCheckout', JSON.stringify({ plan, billing }));
  // porta alla home con richiesta di login (adatta se hai modale sulla Premium)
  window.location.href = 'signup';
}

// --- Auto-ripresa del checkout se si arriva con parametri (opzionale) ---
(function autoResumeFromQuery(){
  const p = new URLSearchParams(location.search);
  const plan = p.get('plan');
  const billing = p.get('billing');
  if (plan && billing) {
    // evidenzia il tab corretto
    if (billing === 'annual') showAnnual(); else showMonthly();
  }
})();

// --- Click su "Sottoscrivi e paga" (obbligo login) ---
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button.btn-small[data-plan][data-billing]');
  if (!btn) return;

  const { plan, billing } = btn.dataset;
  const user = auth.currentUser;

  // Obbliga login prima del checkout
  if (!user) {
    requireLoginThen(plan, billing);
    return;
  }

  const uid = user.uid;
  const email = user.email || undefined;

  try {
    // (facoltativo) verifica token lato server: scommenta se implementi la verifica in createCheckout
    // const idToken = await user.getIdToken();
    // const { url } = await postJSON('/.netlify/functions/createCheckout', { plan, billing }, { Authorization: `Bearer ${idToken}` });

    const { url } = await postJSON('/.netlify/functions/createCheckout', { plan, billing, uid, email });
    window.location.href = url; // redirect a Stripe Checkout
  } catch (err) {
    console.error(err);
    alert('Errore durante la creazione del checkout: ' + err.message);
  }
});

// --- Ripresa intenti dopo login (se dalla home reindirizzi qui con ?plan&billing) ---
(function resumeAfterLoginIntent(){
  const pending = sessionStorage.getItem('postLoginCheckout');
  if (!pending) return;
  try {
    const { plan, billing } = JSON.parse(pending);
    // evidenzia tab corretta
    if (billing === 'annual') showAnnual(); else showMonthly();
    // non auto-avvio il checkout per evitare sorprese; lascio il contesto pronto
    sessionStorage.removeItem('postLoginCheckout');
  } catch {}
})();