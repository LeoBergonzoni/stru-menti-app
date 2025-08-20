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

async function postJSON(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Network error');
  return res.json();
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button.btn-small[data-plan][data-billing]');
  if (!btn) return;
  const { plan, billing } = btn.dataset;
  try {
    const { url } = await postJSON('/.netlify/functions/createCheckout', { plan, billing });
    window.location.href = url;
  } catch (err) {
    alert('Errore durante la creazione del checkout.');
  }
});