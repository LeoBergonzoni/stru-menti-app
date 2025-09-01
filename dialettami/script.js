// Dialettami — script.js (contatore globale + login/signup anonimi + contatore sopra footer)

// ===== Endpoint funzione Netlify (proxy verso AI) =====
const API_PROXY_URL = '/.netlify/functions/dialettami';

// ===== Helper conteggio globale =====
import { loadUsage, incrementUsage, MONTH_KEY } from "/_assets/usageHelper.js";

// ===== Firebase =====
// ===== Firebase (shared) =====
import { app, auth } from "/shared/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// ===== UI helpers =====
const el = (id) => document.getElementById(id);
const $  = (sel) => document.querySelector(sel);

const translationEl = el('translation');
const explanationEl = el('explanation');
const btn = el('btn');

const formItToDia = el('form-it-to-dia');
const formDiaToIt = el('form-dia-to-it');
const pillItToDia = el('mode-it-to-dialetto');
const pillDiaToIt = el('mode-dialetto-to-it');
const dictateBtn = el('dictate');

// Badge (footer in HTML, ma lo spostiamo sopra il footer)
const usageInfo   = el('usage-info');
const planLabel   = el('plan-label');
const clicksLabel = el('clicks-label');

// Modali (supporto due tipi — compatibilità con altri tool)
const limitModalOverlay = el('limit-modal');      // Ricettario/BeKind
const limitBackdrop     = el('limit-backdrop');   // Dialettami

function openLimit() {
  if (limitModalOverlay) {
    limitModalOverlay.classList.add('active');
    limitModalOverlay.classList.remove('hidden');
  } else if (limitBackdrop) {
    limitBackdrop.style.display = 'flex';
  } else {
    alert('Hai raggiunto il limite. Accedi o passa a Premium per continuare.');
  }
}
function closeLimit() {
  if (limitModalOverlay) { limitModalOverlay.classList.remove('active'); limitModalOverlay.classList.add('hidden'); }
  if (limitBackdrop) limitBackdrop.style.display = 'none';
}
el('close-limit')?.addEventListener('click', closeLimit);
limitBackdrop?.addEventListener('click', (e)=>{ if(e.target === limitBackdrop) closeLimit(); });

// ===== Sposta il contatore sopra il footer + crea link Accedi/Registrati =====
(function placeCounterAboveFooter(){
  if (!usageInfo) return;
  // prende il contenitore .footer
  const footer = document.querySelector('.footer');
  // se per qualsiasi motivo non esiste, esci
  if (!footer) return;
  // rendilo visibile e spostalo PRIMA del footer
  usageInfo.classList.remove('hidden');
  footer.parentNode.insertBefore(usageInfo, footer);

  // crea i link Accedi/Registrati, inizialmente nascosti
  const authLinks = document.createElement('p');
  authLinks.id = 'auth-links';
  authLinks.style.cssText = 'text-align:center;margin:6px 0 0;font-size:.95rem;';
  const base = location.origin;
  authLinks.innerHTML = `<a href="${base}/login.html">Accedi</a> | <a href="${base}/signup.html">Registrati</a>`;
  usageInfo.after(authLinks);
  authLinks.hidden = true;

  // funzione per togglare la visibilità
  window.__showAuthLinks = (isAnon) => { authLinks.hidden = !isAnon; };
})();

// (ritocchino stile link – opzionale ma carino)
const style = document.createElement('style');
style.textContent = `
  #auth-links a { color: inherit; text-decoration: underline; }
  #auth-links a:hover { opacity: .85; }
`;
document.head.appendChild(style);

// ===== Modalità iniziale =====
function setMode(mode){
  const itToDia = mode === 'it_to_dia';
  formItToDia.classList.toggle('hidden', !itToDia);
  formDiaToIt.classList.toggle('hidden', itToDia);
  pillItToDia.classList.toggle('active', itToDia);
  pillDiaToIt.classList.toggle('active', !itToDia);
}
setMode('it_to_dia');
pillItToDia.addEventListener('click', () => setMode('it_to_dia'));
pillDiaToIt.addEventListener('click', () => setMode('dia_to_it'));

// ===== Pulsanti copia =====
document.querySelectorAll('.copy').forEach(copyBtn => {
  copyBtn.addEventListener('click', async () => {
    const target = copyBtn.getAttribute('data-target');
    const text = el(target).innerText.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const old = copyBtn.innerText; copyBtn.innerText = 'Copiato!';
      setTimeout(() => (copyBtn.innerText = old), 1000);
    } catch (e) { alert('Copia non riuscita: ' + e.message); }
  });
});

// ===== Web Speech API (Dettatura) =====
let recognition; let listening = false;
try {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) { recognition = new SR(); recognition.lang = 'it-IT'; recognition.interimResults = true; recognition.continuous = false; }
} catch (_) {}
if (dictateBtn) {
  dictateBtn.addEventListener('click', () => { if (!recognition) return alert('La dettatura non è supportata su questo browser.'); if (!listening) recognition.start(); else recognition.stop(); });
  recognition?.addEventListener('start', () => { listening = true; dictateBtn.disabled = false; dictateBtn.textContent = '⏺️ Sto ascoltando… (tocca per fermare)'; });
  recognition?.addEventListener('result', (e) => { const text = Array.from(e.results).map(r => r[0].transcript).join(' '); const active = document.querySelector('#form-it-to-dia:not(.hidden) #text-it, #form-dia-to-it:not(.hidden) #text-dia'); if (active) active.value = text; });
  recognition?.addEventListener('error', (e) => { listening = false; dictateBtn.textContent = '🎙️ Dettatura'; if (e.error !== 'no-speech') alert('Errore dettatura: ' + e.error); });
  recognition?.addEventListener('end', () => { listening = false; dictateBtn.textContent = '🎙️ Dettatura'; });
}

// ===== Contatore globale via usageHelper =====
let usage = { user: null, planLabel: 'Anonimo', monthlyClicks: 0, maxClicks: 5, monthKey: MONTH_KEY() };

function renderBadge() {
  if (!usageInfo || !planLabel || !clicksLabel) return;
  const shownMax = (usage.maxClicks > 1e8) ? "∞" : usage.maxClicks;
  planLabel.textContent = usage.planLabel;
  clicksLabel.textContent = `${usage.monthlyClicks} / ${shownMax}`;
  usageInfo.classList.remove('hidden');
}

onAuthStateChanged(auth, async (user) => {
  usage = await loadUsage(app, user);
  renderBadge();
  // mostra i link Accedi/Registrati solo se NON loggato
  if (window.__showAuthLinks) window.__showAuthLinks(!user);
});

// ===== Richiesta traduzione con controllo limiti =====
btn.addEventListener('click', async () => {
  if (usage.monthlyClicks >= usage.maxClicks) {
    renderBadge();
    openLimit();
    return;
  }

  btn.disabled = true;
  try {
    translationEl.textContent = '⏳ Sto generando la traduzione...';
    explanationEl.textContent = '…';

    const isItToDia = !formItToDia.classList.contains('hidden');
    let prompt = '';
    if (isItToDia) {
      const phrase = el('text-it').value.trim();
      const dialect = el('dialect').value;
      if (!phrase) { translationEl.textContent = 'Per favore inserisci una frase da tradurre.'; explanationEl.textContent = ''; return; }
      prompt = `Riformula questa frase "${phrase}" nel dialetto italiano "${dialect}" nella maniera più accurata possibile. Mostrami la frase tradotta e, separata, una breve spiegazione dei singoli termini. Formato:\nTRADUZIONE:\n<testo>\n\nSPIEGAZIONE:\n<elenco puntato breve>`;
    } else {
      const phrase = el('text-dia').value.trim();
      if (!phrase) { translationEl.textContent = 'Per favore inserisci una frase da tradurre.'; explanationEl.textContent = ''; return; }
      prompt = `Riformula questa frase "${phrase}" in un italiano corretto e formale. Mostra la frase e, separatamente, una breve spiegazione dei termini e il dialetto di origine. Formato:\nTRADUZIONE:\n<testo>\n\nSPIEGAZIONE:\n<elenco puntato breve>`;
    }

    // Chiamata AI
    await askAI(prompt);

    // ✅ incremento SOLO se la richiesta è andata a buon fine
    usage.monthlyClicks = await incrementUsage(usage);
    renderBadge();

  } catch (err) {
    console.error(err);
    translationEl.textContent = 'Si è verificato un errore nel generare la traduzione.';
    explanationEl.textContent = (err && err.message) ? err.message : String(err);
  } finally {
    btn.disabled = false;
  }
});

// ===== Chiamata AI =====
async function askAI(prompt) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(API_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal
    });
    if (!res.ok) { const errText = await res.text(); throw new Error(errText || 'Errore di rete'); }
    const data = await res.json();
    parseAndRender(data.output || '');
  } finally {
    clearTimeout(t);
  }
}

function parseAndRender(text) {
  const parts = splitSections(text);
  translationEl.textContent = parts.translation || '—';
  explanationEl.textContent = parts.explanation || '—';
}
function splitSections(text) {
  const regex = /TRADUZIONE\s*:\s*([\s\S]*?)(?:\n{2,}|\r{2,}|$)SPIEGAZIONE\s*:\s*([\s\S]*)/i;
  const m = text.match(regex);
  if (m) return { translation: m[1].trim(), explanation: m[2].trim() };
  return { translation: text.trim(), explanation: '' };
}