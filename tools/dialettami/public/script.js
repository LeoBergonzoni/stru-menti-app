import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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

// UI Elements
const el = (id) => document.getElementById(id);
const $ = (sel) => document.querySelector(sel);

const translationEl = el('translation');
const explanationEl = el('explanation');
const btn = el('btn');
const counterDiv = el('counter');
const modal = el('popup-modal');

const formItToDia = el('form-it-to-dia');
const formDiaToIt = el('form-dia-to-it');
const pillItToDia = el('mode-it-to-dialetto');
const pillDiaToIt = el('mode-dialetto-to-it');
const dictateBtn = el('dictate');

// Firebase auth & click count
let user = null;
let userPlan = "Anonimo";
let maxClicks = 5;
let monthlyClicks = 0;

const getMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
};

const updateCounter = () => {
  counterDiv.innerHTML = `👤 Utente: <strong>${userPlan}</strong> — Utilizzi: <strong>${monthlyClicks}/${maxClicks}</strong>`;
};

// Gestione modalità
function setMode(mode) {
  const itToDia = mode === 'it_to_dia';
  formItToDia.classList.toggle('hidden', !itToDia);
  formDiaToIt.classList.toggle('hidden', itToDia);
  pillItToDia.classList.toggle('active', itToDia);
  pillDiaToIt.classList.toggle('active', !itToDia);
}
setMode('it_to_dia');

pillItToDia.addEventListener('click', () => setMode('it_to_dia'));
pillDiaToIt.addEventListener('click', () => setMode('dia_to_it'));

// Gestione login Firebase
onAuthStateChanged(auth, async (currentUser) => {
  if (currentUser) {
    user = currentUser;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      userPlan = data.plan || "free-logged";
    }

    maxClicks = userPlan === "premium" ? 300 : 30;

    const clickRef = doc(db, "clicks", user.uid);
    const snap = await getDoc(clickRef);
    const monthKey = getMonthKey();

    if (!snap.exists()) {
      await setDoc(clickRef, { [monthKey]: 0 });
      monthlyClicks = 0;
    } else {
      monthlyClicks = snap.data()[monthKey] || 0;
    }
  } else {
    user = null;
    userPlan = "Anonimo";
    maxClicks = 5;
    const stored = localStorage.getItem("anonClicks");
    const storedMonth = localStorage.getItem("anonMonth");
    const nowMonth = getMonthKey();
    monthlyClicks = (storedMonth === nowMonth) ? parseInt(stored || "0") : 0;
  }

  updateCounter();
});

// Chiamata API
btn.addEventListener('click', async () => {
  if (monthlyClicks >= maxClicks) {
    modal.classList.add("active");
    return;
  }

  const isItToDia = !formItToDia.classList.contains('hidden');
  const phrase = el(isItToDia ? 'text-it' : 'text-dia').value.trim();
  const dialect = el('dialect')?.value;

  if (!phrase) {
    translationEl.textContent = 'Per favore inserisci una frase da tradurre.';
    explanationEl.textContent = '';
    return;
  }

  const prompt = isItToDia
    ? `Riformula questa frase "${phrase}" nel dialetto italiano "${dialect}" nella maniera più accurata possibile. Mostrami la frase tradotta e, in maniera separata, anche una breve spiegazione. Rispondi nel formato esatto:\nTRADUZIONE:\n<testo>\n\nSPIEGAZIONE:\n<elenco puntato breve>`
    : `Riformula questa frase "${phrase}" scritta in dialetto in un italiano corretto nella maniera più accurata e formale possibile. Mostrami la frase in italiano e, in maniera separata, anche una breve spiegazione e da quale dialetto proviene. Rispondi nel formato esatto:\nTRADUZIONE:\n<testo>\n\nSPIEGAZIONE:\n<elenco puntato breve>`;

  translationEl.textContent = '⏳ Sto generando la traduzione...';
  explanationEl.textContent = '…';
  btn.disabled = true;

  try {
    const res = await fetch('/.netlify/functions/dialettami', {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    parseAndRender(data.output || "❌ Nessuna risposta ricevuta.");
  } catch (e) {
    translationEl.textContent = "Errore nella richiesta.";
    explanationEl.textContent = e.message;
  } finally {
    btn.disabled = false;

    monthlyClicks++;
    updateCounter();
    if (user) {
      const ref = doc(db, "clicks", user.uid);
      await updateDoc(ref, { [getMonthKey()]: increment(1) });
    } else {
      localStorage.setItem("anonClicks", monthlyClicks);
      localStorage.setItem("anonMonth", getMonthKey());
    }
  }
});

// Parsing dell'output
function parseAndRender(text) {
  const parts = text.match(/TRADUZIONE\s*:\s*([\s\S]*?)\n{2,}SPIEGAZIONE\s*:\s*([\s\S]*)/i);
  if (parts) {
    translationEl.textContent = parts[1].trim();
    explanationEl.textContent = parts[2].trim();
  } else {
    translationEl.textContent = text.trim();
    explanationEl.textContent = '';
  }
}

// Dettatura vocale
let recognition;
let listening = false;

try {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    recognition = new SR();
    recognition.lang = 'it-IT';
    recognition.interimResults = true;
    recognition.continuous = false;
  }
} catch (e) {
  console.warn("SpeechRecognition non supportato.");
}

if (dictateBtn && recognition) {
  dictateBtn.addEventListener("click", () => {
    if (!listening) recognition.start(); else recognition.stop();
  });

  recognition.addEventListener("start", () => {
    listening = true;
    dictateBtn.textContent = "⏺️ Sto ascoltando…";
  });

  recognition.addEventListener("result", (e) => {
    const text = Array.from(e.results).map(r => r[0].transcript).join(' ');
    const activeTextarea = document.querySelector('#form-it-to-dia:not(.hidden) #text-it, #form-dia-to-it:not(.hidden) #text-dia');
    if (activeTextarea) activeTextarea.value = text;
  });

  recognition.addEventListener("end", () => {
    listening = false;
    dictateBtn.textContent = "🎙️ Dettatura";
  });

  recognition.addEventListener("error", (e) => {
    listening = false;
    dictateBtn.textContent = "🎙️ Dettatura";
    if (e.error !== 'no-speech') alert("Errore dettatura: " + e.error);
  });
}