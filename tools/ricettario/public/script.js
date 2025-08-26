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
const shoppingTitle = shoppingOutput.querySelector('h2'); // 👈 per aggiornare il titolo
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
    ensureInputs(2);
    trimInputsTo(2);
  } else {
    modeDesc.innerHTML = 'Inserisci uno o più <strong>macro ingredienti</strong> per scatenare la fantasia dello chef: preparati a fare la spesa!';
    ensureInputs(1);
    trimInputsTo(1);
  }

  outputsWrap?.classList?.add('hidden');
  outputsWrap?.classList?.remove('single');
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

const authLinks = document.createElement('p');
authLinks.id = 'auth-links';
authLinks.style.cssText = "text-align:center; margin:.25rem 0 0; font-size:0.9rem;";
authLinks.innerHTML = `<a href="login.html">Accedi</a> | <a href="signup.html">Registrati</a>`;
counterDiv.after(authLinks);
authLinks.hidden = true; // mostrali solo se anonimo

function showAuthLinks(isAnon){
  authLinks.hidden = !isAnon;
}

let usage = { user: null, planLabel: "Anonimo", monthlyClicks: 0, maxClicks: 5 };
function updateCounter(){
  const shownMax = (usage.maxClicks > 1e8) ? "∞" : usage.maxClicks;
  counterDiv.innerHTML = `👤 Utente: <strong>${usage.planLabel}</strong> — Utilizzi: <strong>${usage.monthlyClicks}/${shownMax}</strong>`;
}
onAuthStateChanged(auth, async (user) => { usage = await loadUsage(app, user); updateCounter(); showAuthLinks(!user); });

// ===== Submit =====
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
  shoppingOutput.classList.add('hidden'); // lo apriamo dopo in base alla modalità

  // Disabilita pulsanti durante la richiesta
  const prevStates = { add: addButton.disabled, remove: removeButton.disabled, newBtn: newRecipeBtn.disabled };
  addButton.disabled = true; removeButton.disabled = true; newRecipeBtn.disabled = true;

  try {
    const data = await fetchRecipe(ingredients, location, currentMode);

    if(currentMode === 'fantasia'){
      const parsed = tryParseFantasiaJSON(data.message);
      if(parsed){
        recipeTitleEl.textContent = `🍽️ ${parsed.title}`;
        recipeText.textContent = parsed.instructions;
        shoppingText.innerHTML = renderShoppingList(parsed.shopping_list);
      } else {
        const { title, body, shopping } = fallbackSplitFantasia(data.message);
        recipeTitleEl.textContent = `🍽️ ${title}`;
        recipeText.textContent = body;
        shoppingText.innerHTML = shopping || '<em>Lista non disponibile.</em>';
      }
      shoppingTitle.textContent = '🧾 Ingredienti e dosi';
      shoppingOutput.classList.remove('hidden');
      outputsWrap.classList.remove('single');

    } else {
      // 🔸 SVUOTA FRIGO — ora risposta JSON uguale a Fantasia
      const parsed = tryParseFantasiaJSON(data.message);
      if(parsed){
        recipeTitleEl.textContent = `🍽️ ${parsed.title}`;
        recipeText.textContent = parsed.instructions; // ingredienti vanno nel riquadro a destra
        shoppingText.innerHTML = renderShoppingList(parsed.shopping_list);
      } else {
        // fallback: prova a splittare e costruire lista
        const clean = data.message.trim();
        recipeTitleEl.textContent = '🍽️ Ricetta';
        recipeText.textContent = clean;
        // riga di sicurezza: se non abbiamo lista, mostra gli ingredienti originali
        shoppingText.innerHTML = '<ul>' + ingredients.map(i=>`<li>${i}</li>`).join('') + '</ul>';
      }
      shoppingTitle.innerHTML = '🧾 Ingredienti e dosi <small style="opacity:.7;font-weight:normal">(adatta a seconda delle quantità che hai)</small>';
      shoppingOutput.classList.remove('hidden');
      outputsWrap.classList.remove('single');
    }

    // ✅ Incrementa SOLO dopo risposta OK
    usage.monthlyClicks = await incrementUsage(usage);
    updateCounter();

    // ⭐ aggiorna stato stellina
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
function saveFavsLS(list){
  if(list.length > 5) list = list.slice(0,5); // cap 5
  localStorage.setItem('ricettario:favorites', JSON.stringify(list));
}
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
      favs.splice(idx, 1);
      saveFavsLS(favs);
      updateFavBtnState();
      return;
    }
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

// ===== Helpers JSON / fallback =====
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

// Inizializza modalità default
setMode('svuota');