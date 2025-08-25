// Ricettario — script.js (doppia modalità + lista spesa) — contatore unico globale via usageHelper

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

// Tabs modalità
const modeTabs = document.querySelectorAll('.mode-tab');
const modeDesc = document.getElementById('mode-desc');
let currentMode = 'svuota'; // 'svuota' | 'fantasia'

function setMode(mode){
  currentMode = mode;
  modeTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  if(mode === 'svuota'){
    modeDesc.innerHTML = 'Inserisci gli ingredienti <strong>esatti</strong> per ottenere la tua ricetta con quello che hai in casa.';
    ensureInputs(2); // minimo 2 campi
  } else {
    modeDesc.innerHTML = 'Inserisci uno o più <strong>macro ingredienti</strong> per scatenare la fantasia dello chef: preparati a fare la spesa!';
    ensureInputs(1); // minimo 1 campo
  }
  outputsWrap.classList.add('hidden');
}
modeTabs.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

function ensureInputs(min){
  // Mantiene almeno "min" input, rimuove required in eccesso coerentemente
  const inputs = ingredientContainer.querySelectorAll("input[name='ingredient']");
  // Aggiungi se mancano
  while(inputs.length < min){
    addIngredientField();
  }
  // Rendi i primi min required, gli altri no
  ingredientContainer.querySelectorAll("input[name='ingredient']").forEach((inp, idx)=>{
    inp.required = idx < min;
    inp.placeholder = `Ingrediente ${idx+1}`;
  });
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

// Modale limite
const modal = document.getElementById("limit-modal");
const modalClose = document.getElementById("close-limit");
modalClose.addEventListener("click", () => { modal.classList.remove("active"); modal.classList.add("hidden"); });

// Contatore visibile in fondo (stile leggero)
const counterDiv = document.createElement("div");
counterDiv.style.cssText = "text-align:center; margin-top:1rem; font-size:0.85rem; color:#888;";
const footer = document.querySelector("footer");
if (footer) document.body.insertBefore(counterDiv, footer); else document.body.appendChild(counterDiv);

let usage = { user: null, planLabel: "Anonimo", monthlyClicks: 0, maxClicks: 5 };
function updateCounter(){ const shownMax = (usage.maxClicks > 1e8) ? "∞" : usage.maxClicks; counterDiv.innerHTML = `👤 Utente: <strong>${usage.planLabel}</strong> — Utilizzi: <strong>${usage.monthlyClicks}/${shownMax}</strong>`; }

onAuthStateChanged(auth, async (user) => { usage = await loadUsage(app, user); updateCounter(); });

// Submit: controllo limiti + chiamata AI
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (usage.monthlyClicks >= usage.maxClicks) {
    modal.classList.add("active");
    modal.classList.remove("hidden");
    return;
  }

  const ingredients = Array.from(document.querySelectorAll("input[name='ingredient']")).map(i => i.value.trim()).filter(Boolean);
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
      } else {
        const { title, body, shopping } = fallbackSplitFantasia(data.message);
        recipeTitleEl.textContent = `🍽️ ${title}`;
        recipeText.textContent = body;
        shoppingText.innerHTML = shopping || '<em>Lista non disponibile.</em>';
        shoppingOutput.classList.remove('hidden');
      }
    } else {
      const [titleLine, ...rest] = data.message.split('\n');
      const cleanTitle = titleLine.replace(/^["#*\- ]+/, '').trim();
      const body = rest.join('\n').trim();
      recipeTitleEl.textContent = `🍽️ ${cleanTitle}`;
      recipeText.textContent = body;
      shoppingOutput.classList.add('hidden');
    }

    // ✅ Incrementa SOLO dopo risposta OK → contatore globale
    usage.monthlyClicks = await incrementUsage(usage);
    updateCounter();

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

// Funzione API con gestione errori HTTP
async function fetchRecipe(ingredients, location, mode) {
  const res = await fetch("/.netlify/functions/ricettario-chatgpt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredients, location, mode })
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (!data?.message) throw new Error("Risposta API non valida");
  return data;
}

// ===== Helpers parsing Fantasia =====
function tryParseFantasiaJSON(text){
  // Cerca un blocco JSON nel testo (anche se circondato da spiegazioni)
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

// Inizializza modalità default
setMode('svuota');
