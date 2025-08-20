// Dialettami — script.js (allineato a Ricettario/BeKind)


// ===== Endpoint funzione Netlify (proxy verso AI) =====
const API_PROXY_URL = '/.netlify/functions/dialettami';

// ===== Firebase =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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
const db = getFirestore(app);

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

// Badge (footer)
const usageInfo   = el('usage-info');
const planLabel   = el('plan-label');
const clicksLabel = el('clicks-label');

// Modali (supporto entrambi i tipi)
const limitModalOverlay = el('limit-modal');      // Ricettario/BeKind
const limitBackdrop     = el('limit-backdrop');   // Dialettami

function openLimit() {
  if (limitModalOverlay) {
    limitModalOverlay.classList.add('active');
    limitModalOverlay.classList.remove('hidden');
  } else if (limitBackdrop) {
    limitBackdrop.style.display = 'flex';
  } else {
    alert('Hai raggiunto il limite gratuito. Accedi o passa a Premium per continuare.');
  }
}
function closeLimit() {
  if (limitModalOverlay) {
    limitModalOverlay.classList.remove('active');
    limitModalOverlay.classList.add('hidden');
  }
  if (limitBackdrop) limitBackdrop.style.display = 'none';
}
el('close-limit')?.addEventListener('click', closeLimit);
limitBackdrop?.addEventListener('click', (e)=>{ if(e.target === limitBackdrop) closeLimit(); });

// ===== Cookie banner + GA (già in index; niente da fare qui) =====

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
    try { await navigator.clipboard.writeText(text);
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

// ===== Contatore allineato a Ricettario/BeKind =====
const LIMITS = { anonymous: 5, free: 40, premium: 300 };
const ANON_CLICKS_KEY  = 'anonClicks';      // come Ricettario
const ANON_MONTH_KEY   = 'anonMonth';       // come Ricettario

const monthKey = ()=>{ const d=new Date(); return `${d.getFullYear()}-${d.getMonth()+1}`; };

let currentUser = null;
let userPlanLabel = 'Anonimo';  // "Anonimo" | "Free logged" | "Premium"
let monthlyClicks = 0;
let maxClicks = LIMITS.anonymous;

function renderBadge() {
  if (!usageInfo || !planLabel || !clicksLabel) return;
  planLabel.textContent = userPlanLabel;
  clicksLabel.textContent = `${monthlyClicks} / ${maxClicks}`;
  usageInfo.classList.remove('hidden');
}

async function readUserPlanAndClicks(user) {
  if (!user) {
    // Anonimo
    userPlanLabel = 'Anonimo';
    maxClicks = LIMITS.anonymous;
    const mKey = localStorage.getItem(ANON_MONTH_KEY);
    const cKey = localStorage.getItem(ANON_CLICKS_KEY);
    monthlyClicks = (mKey === monthKey()) ? parseInt(cKey || '0', 10) : 0;
    return;
  }
  // Logged: leggi piano e conteggio come negli altri tool
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  const plan = snap.exists() ? (snap.data().plan || 'free') : 'free';
  userPlanLabel = (plan === 'premium') ? 'Premium' : 'Free logged';
  maxClicks = (plan === 'premium') ? LIMITS.premium : LIMITS.free;

  const clicksRef = doc(db, 'clicks', user.uid);
  const clicksSnap = await getDoc(clicksRef);
  const m = monthKey();
  if (!clicksSnap.exists()) {
    await setDoc(clicksRef, { [m]: 0 });
    monthlyClicks = 0;
  } else {
    monthlyClicks = clicksSnap.data()?.[m] ?? 0;
  }
}

async function incrementClicks(user) {
  if (!user) {
    // anonimo
    const m = monthKey();
    const curM = localStorage.getItem(ANON_MONTH_KEY);
    if (curM !== m) {
      localStorage.setItem(ANON_MONTH_KEY, m);
      localStorage.setItem(ANON_CLICKS_KEY, '0');
      monthlyClicks = 0;
    }
    monthlyClicks += 1;
    localStorage.setItem(ANON_CLICKS_KEY, String(monthlyClicks));
    return;
  }
  // logged
  const clicksRef = doc(db, 'clicks', user.uid);
  const m = monthKey();
  await updateDoc(clicksRef, { [m]: increment(1) });
  monthlyClicks += 1; // riflette subito nel badge
}

onAuthStateChanged(auth, async (u) => {
  currentUser = u || null;
  await readUserPlanAndClicks(currentUser);
  renderBadge();
});

// ===== Richiesta traduzione con controllo limiti =====
btn.addEventListener('click', async () => {
  // Controllo limiti PRIMA della chiamata
  if (monthlyClicks >= maxClicks) {
    renderBadge();
    openLimit();
    return;
  }

  btn.disabled = true;
  try {
    // UI state
    translationEl.textContent = '⏳ Sto generando la traduzione...';
    explanationEl.textContent = '…';

    const isItToDia = !formItToDia.classList.contains('hidden');
    let prompt = '';
    if (isItToDia) {
      const phrase = el('text-it').value.trim();
      const dialect = el('dialect').value;
      if (!phrase) { translationEl.textContent = 'Per favore inserisci una frase da tradurre.'; explanationEl.textContent = ''; return; }
      prompt = `Riformula questa frase "${phrase}" nel dialetto italiano "${dialect}" nella maniera più accurata possibile. Mostrami la frase tradotta e, in maniera separata dalla traduzione, anche una breve spiegazione dei singoli termini tradotti. Rispondi nel formato esatto:\nTRADUZIONE:\n<testo>\n\nSPIEGAZIONE:\n<elenco puntato breve>`;
    } else {
      const phrase = el('text-dia').value.trim();
      if (!phrase) { translationEl.textContent = 'Per favore inserisci una frase da tradurre.'; explanationEl.textContent = ''; return; }
      prompt = `Riformula questa frase "${phrase}" scritta in dialetto in un italiano corretto nella maniera più accurata e formale possibile. Mostrami la frase in italiano corretto e, in maniera separata dalla traduzione, anche una breve spiegazione dei singoli termini che hai tradotto dal dialetto e dimmi da quale dialetto vengono. Rispondi nel formato esatto:\nTRADUZIONE:\n<testo>\n\nSPIEGAZIONE:\n<elenco puntato breve>`;
    }

    // Chiamata AI
    await askAI(prompt);

    // ✅ incremento SOLO se la richiesta è andata a buon fine
    await incrementClicks(currentUser);
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