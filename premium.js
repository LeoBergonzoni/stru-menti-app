// premium.js
// Gestione tab Mensile/Annuale + stub pagamento
const monthlyTab = document.getElementById('tab-monthly');
const annualTab = document.getElementById('tab-annual');
const monthlySection = document.getElementById('monthly');
const annualSection = document.getElementById('annual');

function showMonthly() {
  monthlyTab.classList.add('active');
  annualTab.classList.remove('active');
  monthlySection.style.display = 'block';
  annualSection.style.display = 'none';
  monthlyTab.setAttribute('aria-selected', 'true');
  annualTab.setAttribute('aria-selected', 'false');
}

function showAnnual() {
  annualTab.classList.add('active');
  monthlyTab.classList.remove('active');
  annualSection.style.display = 'block';
  monthlySection.style.display = 'none';
  annualTab.setAttribute('aria-selected', 'true');
  monthlyTab.setAttribute('aria-selected', 'false');
}

monthlyTab.addEventListener('click', showMonthly);
annualTab.addEventListener('click', showAnnual);

// Gestione click "Sottoscrivi e paga"
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button.btn-small[data-plan][data-billing]');
  if (!btn) return;
  const plan = btn.dataset.plan;
  const billing = btn.dataset.billing;

  // TODO: integrazione backend pagamento (es. Stripe Checkout)
  // Esempio: POST a Netlify Function che crea una sessione di checkout
  // fetch('/.netlify/functions/createCheckout', { method:'POST', body: JSON.stringify({ plan, billing }) })
  //   .then(r => r.json()).then(({ url }) => location.href = url);

  alert(`Stub pagamento:\nPiano: ${plan}\nFatturazione: ${billing}\n(Integra Stripe/altro gateway qui).`);
});
