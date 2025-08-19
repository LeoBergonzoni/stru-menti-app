// Dialettami — script.js
// Endpoint della Netlify Function che fa da proxy verso OpenAI
const API_PROXY_URL = '/.netlify/functions/dialettami';

const el = (id) => document.getElementById(id);
const $  = (sel) => document.querySelector(sel);

// Output
const translationEl = el('translation');
const explanationEl = el('explanation');
const btn = el('btn');

// Modalità e UI
const formItToDia = el('form-it-to-dia');
const formDiaToIt = el('form-dia-to-it');
const pillItToDia = el('mode-it-to-dialetto');
const pillDiaToIt = el('mode-dialetto-to-it');

// Bottone dettatura (opzione 1: Web Speech API)
const dictateBtn = document.getElementById('dictate');

// ------------------------------
// Helpers
function getActiveTextarea() {
  return document.querySelector('#form-it-to-dia:not(.hidden) #text-it, #form-dia-to-it:not(.hidden) #text-dia');
}

function setMode(mode) {
  const itToDia = mode === 'it_to_dia';
  formItToDia.classList.toggle('hidden', !itToDia);
  formDiaToIt.classList.toggle('hidden', itToDia);
  pillItToDia.classList.toggle('active', itToDia);
  pillDiaToIt.classList.toggle('active', !itToDia);
}

// Iniziale
setMode('it_to_dia');

// Eventi modalità
pillItToDia.addEventListener('click', () => setMode('it_to_dia'));
pillDiaToIt.addEventListener('click', () => setMode('dia_to_it'));

// Pulsanti copia
document.querySelectorAll('.copy').forEach(copyBtn => {
  copyBtn.addEventListener('click', async () => {
    const target = copyBtn.getAttribute('data-target');
    const text = el(target).innerText.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const old = copyBtn.innerText;
      copyBtn.innerText = 'Copiato!';
      setTimeout(() => (copyBtn.innerText = old), 1000);
    } catch (e) {
      alert('Copia non riuscita: ' + e.message);
    }
  });
});

// ------------------------------
// Web Speech API (Dettatura)
let recognition;
let listening = false;

try {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    recognition = new SR();
    recognition.lang = 'it-IT';
    recognition.interimResults = true; // mostra risultati parziali
    recognition.continuous = false;    // cambia in true se vuoi dettare a lungo
  }
} catch (e) {
  console.warn('SpeechRecognition non disponibile in questo browser.');
}

if (dictateBtn) {
  dictateBtn.addEventListener('click', () => {
    if (!recognition) {
      alert('La dettatura non è supportata su questo browser.');
      return;
    }
    // toggle start/stop
    if (!listening) recognition.start(); else recognition.stop();
  });

  recognition?.addEventListener('start', () => {
    listening = true;
    dictateBtn.disabled = false;
    dictateBtn.textContent = '⏺️ Sto ascoltando… (tocca per fermare)';
  });

  recognition?.addEventListener('result', (e) => {
    const text = Array.from(e.results).map(r => r[0].transcript).join(' ');
    const activeTextarea = getActiveTextarea();
    if (activeTextarea) activeTextarea.value = text;
  });

  recognition?.addEventListener('error', (e) => {
    listening = false;
    dictateBtn.textContent = '🎙️ Dettatura';
    // errori comuni: "no-speech", "not-allowed", "audio-capture"
    if (e.error !== 'no-speech') {
      console.warn('Errore dettatura:', e.error);
      alert('Errore dettatura: ' + e.error);
    }
  });

  recognition?.addEventListener('end', () => {
    listening = false;
    dictateBtn.textContent = '🎙️ Dettatura';
  });
}

// ------------------------------
// Richiesta traduzione
btn.addEventListener('click', async () => {
  // Resetta output
  translationEl.textContent = '⏳ Sto generando la traduzione...';
  explanationEl.textContent = '…';

  const isItToDia = !formItToDia.classList.contains('hidden');

  // Piccolo lock del bottone per evitare doppio click
  btn.disabled = true;

  try {
    if (isItToDia) {
      const phrase = el('text-it').value.trim();
      const dialect = el('dialect').value;
      if (!phrase) {
        translationEl.textContent = 'Per favore inserisci una frase da tradurre.';
        explanationEl.textContent = '';
        return;
      }
      const prompt =
        `Riformula questa frase "${phrase}" nel dialetto italiano "${dialect}" nella maniera più accurata possibile. ` +
        `Mostrami la frase tradotta e, in maniera separata dalla traduzione, anche una breve spiegazione dei singoli termini tradotti. ` +
        `Rispondi nel formato esatto:\nTRADUZIONE:\n<testo>\n\nSPIEGAZIONE:\n<elenco puntato breve>`;
      await askAI(prompt);
    } else {
      const phrase = el('text-dia').value.trim();
      if (!phrase) {
        translationEl.textContent = 'Per favore inserisci una frase da tradurre.';
        explanationEl.textContent = '';
        return;
      }
      const prompt =
        `Riformula questa frase "${phrase}" scritta in dialetto in un italiano corretto nella maniera più accurata e formale possibile. ` +
        `Mostrami la frase in italiano corretto e, in maniera separata dalla traduzione, anche una breve spiegazione dei singoli termini che hai tradotto dal dialetto e dimmi da quale dialetto vengono. ` +
        `Rispondi nel formato esatto:\nTRADUZIONE:\n<testo>\n\nSPIEGAZIONE:\n<elenco puntato breve>`;
      await askAI(prompt);
    }
  } finally {
    btn.disabled = false;
  }
});

async function askAI(prompt) {
  // timeout di sicurezza (60s)
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(API_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Errore di rete');
    }
    const data = await res.json();
    parseAndRender(data.output || '');
  } catch (err) {
    translationEl.textContent = 'Si è verificato un errore nel generare la traduzione.';
    explanationEl.textContent = (err && err.message) ? err.message : String(err);
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
  // Cerca 'TRADUZIONE:' e 'SPIEGAZIONE:' (case-insensitive)
  const regex = /TRADUZIONE\s*:\s*([\s\S]*?)(?:\n{2,}|\r{2,}|$)SPIEGAZIONE\s*:\s*([\s\S]*)/i;
  const m = text.match(regex);
  if (m) {
    return {
      translation: m[1].trim(),
      explanation: m[2].trim()
    };
  }
  // Fallback: tutto come traduzione
  return { translation: text.trim(), explanation: '' };
}
