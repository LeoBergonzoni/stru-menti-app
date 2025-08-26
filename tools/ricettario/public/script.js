// Ricettario — script.js (doppia modalità + lista spesa + varianti + preferiti) — contatore unico globale via usageHelper

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { loadUsage, incrementUsage } from "/_assets/usageHelper.js";

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

// UI Elements
const form = document.getElementById("ingredients-form");
const locationSelect = document.getElementById("location");
const ingredientContainer = document.getElementById("ingredient-fields");
const addButton = document.getElementById("add-ingredient");
const removeButton = document.getElementById("remove-ingredient");
const outputsWrap = document.getElementById("outputs-wrap");
const recipeOutput = document.getElementById("recipe-output");
const recipeTitleEl = document.getElementById("recipe-title");
const recipeText = document.getElementById("recipe-text");
const shoppingOutput = document.getElementById("shopping-output");
const shoppingText = document.getElementById("shopping-text");
const newRecipeBtn = document.getElementById("new-recipe");
const copyBtn = document.getElementById("copy-recipe");
const copyShopBtn = document.getElementById("copy-shopping");
const favBtn = document.getElementById("fav-toggle");

// Tabs modalità + varianti
const modeTabs = document.querySelectorAll('.mode-tab');
const modeDesc = document.getElementById('mode-desc');
let currentMode = 'svuota'; // 'svuota' | 'fantasia'
let variant = ""; // "", "light", "vegetariana", "veloce"

// ===== Modalità =====
function setMode(mode){
  currentMode = mode;
  modeTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));

  if(mode === 'svuota'){
    modeDesc.innerHTML = 'Inserisci gli ingredienti <strong>esatti</strong> per ottenere la tua ricetta con quello che hai in casa.';
    ensureInputs(2); // minimo 2 campi
    trimInputsTo(2); // se arrivo da “fantasia”, torna a 2
  } else {
    modeDesc.innerHTML = 'Inserisci uno o più <strong>macro ingredienti</strong> per scatenare la fantasia dello chef: preparati a fare la spesa!';
    ensureInputs(1); // minimo 1 campo
    trimInputsTo(1); // 👈 mostra 1 campo di default
  }

  outputsWrap?.classList?.add('hidden');
  outputsWrap?.classList?.remove('single'); // reset centratura quando cambio modalità
}
modeTabs.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

function ensureInputs(min){
  let inputs = ingredientContainer.querySelectorAll("input[name='ingredient']");
  while(inputs.length < min){
    addIngredientField();
    inputs = ingredientContainer.querySelectorAll("input[name='ingredient']");
  }
  ingredientContainer.querySelectorAll("input[name='ingredient']").forEach((inp, idx)=>{
    inp.required = idx < min;
    inp.placeholder = `Ingrediente ${idx+1}`;
  });
}

function trimInputsTo(n){
  let inputs = ingredientContainer.querySelectorAll("input[name='ingredient']");
  while (inputs.length > n) {
    ingredientContainer.removeChild(inputs[inputs.length - 1]);
    inputs = ingredientContainer.querySelectorAll("input[name='ingredient']");
  }
}

function addIngredientField(){
  const input = document.createElement("input");
  input.type = "text"; input.name = "ingredient";
  const count = ingredientContainer.querySelectorAll("input").length;
  input.placeholder = `Ingrediente ${count + 1}`;
  ingredientContainer.appendChild(input);
}

// Gestione ingredienti
addButton.addEventListener("click", () => {
  const currentInputs = ingredientContainer.querySelectorAll("input").length;
  if (currentInputs < 10) addIngredientField();
});
removeButton.addEventListener("click", () => {
  const inputs = ingredientContainer.querySelectorAll("input");
  const min = currentMode === 'svuota' ? 2 : 1;
  if (inputs.length > min) ingredientContainer.removeChild(inputs[inputs.length - 1]);
});

// ===== Varianti (UI) =====
document.querySelectorAll('.variant').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.variant').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    variant = btn.dataset.v || "";
  });
});

// ===== Modale limite =====
const modal = document.getElementById("limit-modal");
const modalClose = document.getElementById("close-limit");
modalClose.addEventListener("click", () => { modal.classList.remove("active"); modal.classList.add("hidden"); });

// ===== Contatore visibile in fondo =====
const counterDiv = document.createElement("div");
counterDiv.style.cssText = "text-align:center; margin-top:1rem; font-size:0.85rem; color:#888;";
const footer = document.querySelector("footer");
if (footer) document.body.insertBefore(counterDiv, footer); else document.body.appendChild(counterDiv);

let usage = { user: null, planLabel: "Anonimo", monthlyClicks: 0, maxClicks: 5 };
function updateCounter(){
  const shownMax = (usage.maxClicks > 1e8) ? "∞" : usage.maxClicks;
  counterDiv.innerHTML = `👤 Utente: <strong>${usage.planLabel}</strong> — Utilizzi: <strong>${usage.monthlyClicks}/${shownMax}</strong>`;
}

onAuthStateChanged(auth, async (user) => { usage = await loadUsage(app, user); updateCounter(); });

// ===== Submit: controllo limiti + chiamata AI =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (usage.monthlyClicks >= usage.maxClicks) {
    modal.classList.add("active");
    modal.classList.remove("hidden");
    return;
  }

  const ingredients = Array.from(document.querySelectorAll("input[name='ingredient']"))
    .map(i => i.value.trim()).filter(Boolean);
  const location = locationSelect.value;
  const min = currentMode === 'svuota' ? 2 : 1;
  if (ingredients.length < min){
    alert(`Inserisci almeno ${min} ingrediente${min>1?'i':''}.`);
    return;
  }

  outputsWrap.classList.remove('hidden');
  recipeTitleEl.textContent = "";
  recipeText.textContent = "🍳 Sto preparando la ricetta...";
  shoppingText.textContent = "";
  shoppingOutput.classList.toggle('hidden', currentMode !== 'fantasia');

  // Disabilita pulsanti durante la richiesta
  const prevStates = { add: addButton.disabled, remove: removeButton.disabled, newBtn: newRecipeBtn.disabled };
  addButton.disabled = true; removeButton.disabled = true; newRecipeBtn.disabled = true;

  try {
    const data = await fetchRecipe(ingredients, location, currentMode);

    if(currentMode === 'fantasia'){
      // Preferiamo JSON strutturato, fallback su parsing testuale
      const parsed = tryParseFantasiaJSON(data.message);
      if(parsed){
        recipeTitleEl.textContent = `🍽️ ${parsed.title}`;
        recipeText.textContent = parsed.instructions;
        shoppingText.innerHTML = renderShoppingList(parsed.shopping_list);
        shoppingOutput.classList.remove('hidden');
        outputsWrap.classList.remove('single');
      } else {
        const { title, body, shopping } = fallbackSplitFantasia(data.message);
        recipeTitleEl.textContent = `🍽️ ${title}`;
        recipeText.textContent = body;
        shoppingText.innerHTML = shopping || '<em>Lista non disponibile.</em>';
        shoppingOutput.classList.remove('hidden');
        outputsWrap.classList.remove('single');
      }
    } else {
      const [titleLine, ...rest] = data.message.split('\n');
      const cleanTitle = titleLine.replace(/^["#*\- ]+/, '').replace(/\*\*/g,'').trim();
      const body = rest.join('\n').trim();
      recipeTitleEl.textContent = `🍽️ ${cleanTitle}`;
      recipeText.innerHTML = renderSvuotaHTML(body); // 👈 formattazione pulita
      shoppingOutput.classList.add('hidden');
      
      // centra la scheda quando c’è solo la ricetta
      outputsWrap.classList.add('single');
    }

    // ✅ Incrementa SOLO dopo risposta OK → contatore globale
    usage.monthlyClicks = await incrementUsage(usage);
    updateCounter();

    // ⭐ aggiorna stato stellina dopo ogni nuova ricetta
    updateFavBtnState();

  } catch (err) {
    outputsWrap.classList.add("hidden");
    alert("Si è verificato un errore. Riprova tra poco.");
    console.error(err);
  } finally {
    addButton.disabled = prevStates.add;
    removeButton.disabled = prevStates.remove;
    newRecipeBtn.disabled = prevStates.newBtn;
  }
});

newRecipeBtn.addEventListener("click", () => { form.dispatchEvent(new Event("submit")); });

copyBtn.addEventListener("click", () => {
  const fullText = `${recipeTitleEl.textContent}\n\n${recipeText.textContent}`;
  navigator.clipboard.writeText(fullText);
  alert("Ricetta copiata! 📋");
});
copyShopBtn.addEventListener("click", () => {
  const text = shoppingText.innerText.trim();
  if(text){ navigator.clipboard.writeText(text); alert("Lista spesa copiata! 📋"); }
});

// ===== Preferiti (LocalStorage) =====
function loadFavsLS(){
  try { return JSON.parse(localStorage.getItem('ricettario:favorites') || '[]'); }
  catch { return []; }
}
function saveFavsLS(list){ localStorage.setItem('ricettario:favorites', JSON.stringify(list)); }

function currentRecipeObj(){
  return {
    title: recipeTitleEl.textContent.replace(/^🍽️\s*/, ''),
    body: recipeText.textContent,
    shopping: (!shoppingOutput.classList.contains('hidden') ? (shoppingText.innerText.trim() || null) : null),
    ts: Date.now()
  };
}
function isSameRecipe(a, b){ return a.title===b.title && a.body===b.body; }

function updateFavBtnState(){
  if(!favBtn) return;
  const cur = currentRecipeObj();
  const favs = loadFavsLS();
  const exists = favs.some(f => isSameRecipe(f, cur));
  favBtn.textContent = exists ? '⭐ Salvata' : '☆ Salva';
}

if (favBtn){
  favBtn.addEventListener('click', () => {
    const cur = currentRecipeObj();
    const favs = loadFavsLS();
    const idx = favs.findIndex(f => isSameRecipe(f, cur));
    if (idx >= 0) {
      // Rimuovi se già presente
      favs.splice(idx, 1);
      saveFavsLS(favs);
      updateFavBtnState();
      return;
    }
    // Aggiunta con limite massimo 5
    if (favs.length >= 5) {
      alert("Puoi salvare al massimo 5 ricette nei Preferiti su questo dispositivo. Rimuovine una prima di aggiungerne un'altra.");
      return;
    }
    favs.unshift(cur);
    saveFavsLS(favs);
    updateFavBtnState();
  });
}

// ===== API =====
async function fetchRecipe(ingredients, location, mode) {
  const res = await fetch("/.netlify/functions/ricettario-chatgpt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredients, location, mode, variant })
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (!data?.message) throw new Error("Risposta API non valida");
  return data;
}

// ===== Helpers parsing Fantasia =====
function tryParseFantasiaJSON(text){
  const match = text.match(/\{[\s\S]*\}/);
  if(!match) return null;
  try{
    const obj = JSON.parse(match[0]);
    if(!obj.title || !obj.instructions) return null;
    obj.shopping_list = Array.isArray(obj.shopping_list) ? obj.shopping_list : [];
    return obj;
  }catch(e){ return null; }
}
function renderShoppingList(list){
  if(!list.length) return '<em>Nessun ingrediente fornito.</em>';
  return '<ul>' + list.map(it=>{
    if(typeof it === 'string') return `<li>${it}</li>`;
    const { item, qty, unit } = it;
    const q = [qty, unit].filter(Boolean).join(' ');
    return `<li>${item}${q?': '+q:''}</li>`;
  }).join('') + '</ul>';
}
function fallbackSplitFantasia(text){
  const lines = text.split('\n').map(l=>l.trim());
  const title = (lines[0]||'').replace(/^["#*\- ]+/, '').trim();
  let idx = lines.findIndex(l=>/ingredienti(\s+e\s+dosi)?/i.test(l));
  if(idx === -1) idx = lines.findIndex(l=>/lista spesa|spesa/i.test(l));
  const body = idx>0 ? lines.slice(1, idx).join('\n').trim() : lines.slice(1).join('\n').trim();
  const shopping = idx>0 ? '<ul>' + lines.slice(idx+1).filter(Boolean).map(li=>`<li>${li.replace(/^[-*]\s*/, '')}</li>`).join('') + '</ul>' : '';
  return { title, body, shopping };
}

// --- Utils di formattazione "Svuota frigo" ---
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Converte il testo stile blog con titoletti/elenchi in HTML pulito
function renderSvuotaHTML(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);

  // Rimuovi **bold** markdown
  const stripMd = (s) => s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');

  // Separiamo eventuali blocchi "Ingredienti" / "Procedimento | Passaggi"
  let idxIng = lines.findIndex(l => /ingredienti/i.test(l));
  let idxProc = lines.findIndex(l => /(procedimento|passaggi|preparazione)/i.test(l));

  // Se il modello non mette titoli, proviamo a inferire: prima lista non numerata = ingredienti, poi numerata = procedimento
  const hasTitles = idxIng !== -1 || idxProc !== -1;

  let ingPart = [], procPart = [], head = [];
  if (hasTitles) {
    // Ordina gli indici
    const firstIdx = [idxIng, idxProc].filter(i=>i!==-1).sort((a,b)=>a-b)[0];
    head = lines.slice(0, firstIdx);
    if (idxIng !== -1 && idxProc !== -1) {
      ingPart = lines.slice(idxIng+1, idxProc);
      procPart = lines.slice(idxProc+1);
    } else if (idxIng !== -1) {
      ingPart = lines.slice(idxIng+1);
    } else {
      procPart = lines.slice(idxProc+1);
    }
  } else {
    // Heuristics
    const bullets = lines.filter(l => /^[-*•]/.test(l));
    const numbers = lines.filter(l => /^\d+[\).\:-]\s/.test(l));
    if (bullets.length >= 2) ingPart = bullets;
    if (numbers.length >= 2) procPart = numbers;
    head = lines.filter(l => !ingPart.includes(l) && !procPart.includes(l));
  }

  const mkList = (arr, numbered=false) => {
    if(!arr.length) return '';
    const items = arr.map(li => {
      let t = stripMd(li).replace(/^[-*•]\s*/, '').replace(/^\d+[\).\:-]\s*/, '');
      return `<li>${escapeHtml(t)}</li>`;
    }).join('');
    return numbered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
  };

  // Se la prima riga è un titolo, lascialo fuori (lo gestiamo già a parte come H2)
  const headText = stripMd(head.join('\n')).trim();

  // Costruisci HTML
  let html = '';
  if (headText) html += `<p>${escapeHtml(headText)}</p>`;
  if (ingPart.length) html += `<h3>Ingredienti</h3>${mkList(ingPart, false)}`;
  if (procPart.length) html += `<h3>Passaggi</h3>${mkList(procPart, true)}`;
  if (!ingPart.length && !procPart.length) {
    // Fallback: tutto come paragrafo pulito
    html = `<p>${escapeHtml(stripMd(text))}</p>`;
  }
  return html;
}

// Inizializza modalità default
setMode('svuota');