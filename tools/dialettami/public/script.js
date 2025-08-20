// Dialettami — script.js (mod: GA + Cookie banner + Firebase click counter + Modal limite)
// Endpoint della Netlify Function che fa da proxy verso OpenAI
const API_PROXY_URL = '/.netlify/functions/dialettami';

// ===== Firebase (click counting) =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

// Firebase config
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
const dictateBtn = document.getElementById('dictate');

// ===== Cookie banner + GA =====
const COOKIE_KEY = 'sm_cookie_consent_v1';
function showCookieBannerIfNeeded(){
  const consent = localStorage.getItem(COOKIE_KEY);
  if(!consent){ document.getElementById('cookie-banner').classList.remove('hidden'); }
}
window.acceptCookies = function(){
  localStorage.setItem(COOKIE_KEY, 'accepted');
  // aggiorna consenso e avvia GA
  if (window.gtag) {
    gtag('consent', 'update', { 'analytics_storage': 'granted' });
    gtag('js', new Date());
    gtag('config', 'G-GQBTEG460W');
  }
  document.getElementById('cookie-banner').classList.add('hidden');
};
showCookieBannerIfNeeded();

// ===== Modal limite =====
const limitBackdrop = el('limit-backdrop');
function openLimitModal(message){
  const txt = document.getElementById('limit-text');
  if(message) txt.textContent = message;
  limitBackdrop.style.display = 'flex';
}
function closeLimitModal(){ limitBackdrop.style.display = 'none'; }
limitBackdrop?.addEventListener('click', (e)=>{ if(e.target === limitBackdrop) closeLimitModal(); });

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
} catch (e) { console.warn('SpeechRecognition non disponibile in questo browser.'); }
if (dictateBtn) {
  dictateBtn.addEventListener('click', () => { if (!recognition) return alert('La dettatura non è supportata su questo browser.'); if (!listening) recognition.start(); else recognition.stop(); });
  recognition?.addEventListener('start', () => { listening = true; dictateBtn.disabled = false; dictateBtn.textContent = '⏺️ Sto ascoltando… (tocca per fermare)'; });
  recognition?.addEventListener('result', (e) => { const text = Array.from(e.results).map(r => r[0].transcript).join(' '); const active = document.querySelector('#form-it-to-dia:not(.hidden) #text-it, #form-dia-to-it:not(.hidden) #text-dia'); if (active) active.value = text; });
  recognition?.addEventListener('error', (e) => { listening = false; dictateBtn.textContent = '🎙️ Dettatura'; if (e.error !== 'no-speech') { console.warn('Errore dettatura:', e.error); alert('Errore dettatura: ' + e.error); } });
  recognition?.addEventListener('end', () => { listening = false; dictateBtn.textContent = '🎙️ Dettatura'; });
}

// ===== Click counting (limiti: 5 anonimo, 30 free, 300 premium) =====
const LIMITS = { anonymous: 5, free: 30, premium: 300 };
function ymKey(){ const d = new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`; }
function localKey(){ return `dialettami_clicks_${ymKey()}`; }

async function getPlanAndCount(user){
  const period = ymKey();
  if(!user){
    // anonimo su localStorage
    const used = parseInt(localStorage.getItem(localKey())||'0',10);
    return { plan: 'anonymous', used, limit: LIMITS.anonymous, ref: null };
  }
  // utente loggato: leggi piano + usage da Firestore
  const profileRef = doc(db, 'users', user.uid);
  const profileSnap = await getDoc(profileRef);
  const plan = (profileSnap.exists() && profileSnap.data().plan === 'premium') ? 'premium' : 'free';

  const usageRef = doc(db, 'usage', `${user.uid}_dialettami_${period}`);
  const usageSnap = await getDoc(usageRef);
  const used = usageSnap.exists() ? (usageSnap.data().count || 0) : 0;
  const limit = plan === 'premium' ? LIMITS.premium : LIMITS.free;
  return { plan, used, limit, ref: usageRef };
}

async function incrementCount(user, usageRef){
  const period = ymKey();
  if(!user){
    const k = localKey();
    const cur = parseInt(localStorage.getItem(k)||'0',10);
    localStorage.setItem(k, String(cur+1));
    return cur+1;
  }
  // crea/aggiorna doc su Firestore
  const exists = await getDoc(usageRef);
  if(!exists.exists()){
    await setDoc(usageRef, { count: 1, period, tool: 'dialettami', ts: Date.now() });
    return 1;
  } else {
    await updateDoc(usageRef, { count: increment(1), ts: Date.now() });
    const snap = await getDoc(usageRef);
    return (snap.data().count)||0;
  }
}

let currentUser = null;
onAuthStateChanged(auth, (u)=>{ currentUser = u || null; });

// ===== Richiesta traduzione con controllo limiti =====
btn.addEventListener('click', async () => {
  // check quota prima
  btn.disabled = true;
  try {
    const { plan, used, limit, ref } = await getPlanAndCount(currentUser);
    if(used >= limit){
      openLimitModal(plan === 'anonymous' ? 'Hai raggiunto il limite per utenti anonimi (5 richieste/mese). Accedi o passa a Premium per continuare.' : (plan === 'free' ? 'Hai raggiunto il limite del piano Free (30 richieste/mese). Passa a Premium per continuare.' : 'Hai raggiunto il limite del piano.'));
      return; // blocca richiesta
    }

    // Resetta output
    translationEl.textContent = '⏳ Sto generando la traduzione...';
    explanationEl.textContent = '…';

    const isItToDia = !formItToDia.classList.contains('hidden');
    if (isItToDia) {
      const phrase = el('text-it').value.trim();
      const dialect = el('dialect').value;
      if (!phrase) { translationEl.textContent = 'Per favore inserisci una frase da tradurre.'; explanationEl.textContent = ''; return; }
      const prompt = `Riformula questa frase "${phrase}" nel dialetto italiano "${dialect}" nella maniera più accurata possibile. Mostrami la frase tradotta e, in maniera separata dalla traduzione, anche una breve spiegazione dei singoli termini tradotti. Rispondi nel formato esatto:\nTRADUZIONE:\n<testo>\n\nSPIEGAZIONE:\n<elenco puntato breve>`;
      await askAI(prompt);
    } else {
      const phrase = el('text-dia').value.trim();
      if (!phrase) { translationEl.textContent = 'Per favore inserisci una frase da tradurre.'; explanationEl.textContent = ''; return; }
      const prompt = `Riformula questa frase "${phrase}" scritta in dialetto in un italiano corretto nella maniera più accurata e formale possibile. Mostrami la frase in italiano corretto e, in maniera separata dalla traduzione, anche una breve spiegazione dei singoli termini che hai tradotto dal dialetto e dimmi da quale dialetto vengono. Rispondi nel formato esatto:\nTRADUZIONE:\n<testo>\n\nSPIEGAZIONE:\n<elenco puntato breve>`;
      await askAI(prompt);
    }

    // incremento conteggio solo se la richiesta è partita
    await incrementCount(currentUser, ref);
  } catch(err){
    console.error(err);
    translationEl.textContent = 'Si è verificato un errore.';
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
    const res = await fetch(API_PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }), signal: controller.signal });
    if (!res.ok) { const errText = await res.text(); throw new Error(errText || 'Errore di rete'); }
    const data = await res.json();
    parseAndRender(data.output || '');
  } catch (err) {
    translationEl.textContent = 'Si è verificato un errore nel generare la traduzione.';
    explanationEl.textContent = (err && err.message) ? err.message : String(err);
  } finally { clearTimeout(t); }
}

function parseAndRender(text) {
  const parts = splitSections(text);
  translationEl.textContent = parts.translation || '—';
  explanationEl.textContent = parts.explanation || '—';
}

function splitSections(text) {
  const regex = /TRADUZIONE\s*:\s*([\s\S]*?)(?:\n{2,}|\r{2,}|$)SPIEGAZIONE\s*:\s*([\s\S]*)/i;
  const m = text.match(regex);
  if (m) { return { translation: m[1].trim(), explanation: m[2].trim() }; }
  return { translation: text.trim(), explanation: '' };
}
