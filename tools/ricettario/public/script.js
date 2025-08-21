// Ricettario — script.js (contatore unico globale via usageHelper)

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
const recipeOutput = document.getElementById("recipe-output");
const recipeTitle = document.querySelector("#recipe-output h2");
const recipeText = document.getElementById("recipe-text");
const newRecipeBtn = document.getElementById("new-recipe");
const copyBtn = document.getElementById("copy-recipe");

// Modale limite
const modal = document.getElementById("limit-modal");
const modalClose = document.getElementById("close-limit");

// Contatore visibile in fondo (stile leggero)
const counterDiv = document.createElement("div");
counterDiv.style.cssText = "text-align:center; margin-top:1rem; font-size:0.85rem; color:#888;";
const footer = document.querySelector("footer");
if (footer) document.body.insertBefore(counterDiv, footer); else document.body.appendChild(counterDiv);

// Stato usage condiviso (verrà popolato da loadUsage)
let usage = { user: null, planLabel: "Anonimo", monthlyClicks: 0, maxClicks: 5 };

function updateCounter() {
  const shownMax = (usage.maxClicks > 1e8) ? "∞" : usage.maxClicks;
  counterDiv.innerHTML = `👤 Utente: <strong>${usage.planLabel}</strong> — Utilizzi: <strong>${usage.monthlyClicks}/${shownMax}</strong>`;
}

// Carica piano + contatore globale all’accesso/uscita
onAuthStateChanged(auth, async (user) => {
  usage = await loadUsage(app, user);
  updateCounter();
});

// Gestione ingredienti
addButton.addEventListener("click", () => {
  const currentInputs = ingredientContainer.querySelectorAll("input").length;
  if (currentInputs < 10) {
    const input = document.createElement("input");
    input.type = "text";
    input.name = "ingredient";
    input.placeholder = `Ingrediente ${currentInputs + 1}`;
    ingredientContainer.appendChild(input);
  }
});

removeButton.addEventListener("click", () => {
  const inputs = ingredientContainer.querySelectorAll("input");
  if (inputs.length > 2) {
    ingredientContainer.removeChild(inputs[inputs.length - 1]);
  }
});

// Submit: controllo limiti + chiamata AI
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Limite mensile globale
  if (usage.monthlyClicks >= usage.maxClicks) {
    modal.classList.add("active");
    modal.classList.remove("hidden");
    return;
  }

  const ingredients = Array.from(
    document.querySelectorAll("input[name='ingredient']")
  ).map(i => i.value.trim()).filter(Boolean);
  const location = locationSelect.value;

  recipeText.textContent = "🍳 Sto preparando la ricetta...";
  recipeTitle.textContent = "";
  recipeOutput.classList.remove("hidden");

  // Disabilita pulsanti durante la richiesta
  const prevStates = { add: addButton.disabled, remove: removeButton.disabled, newBtn: newRecipeBtn.disabled };
  addButton.disabled = true; removeButton.disabled = true; newRecipeBtn.disabled = true;

  try {
    const recipe = await fetchRecipe(ingredients, location);
    const [titleLine, ...rest] = recipe.split('\n');
    const cleanTitle = titleLine.replace(/^["#*\- ]+/, '').trim();
    const body = rest.join('\n').trim();

    recipeTitle.textContent = `🍽️ ${cleanTitle}`;
    recipeText.textContent = body;

    // ✅ Incrementa SOLO dopo risposta OK → contatore globale
    usage.monthlyClicks = await incrementUsage(usage);
    updateCounter();

  } catch (err) {
    recipeOutput.classList.add("hidden");
    alert("Si è verificato un errore. Riprova tra poco.");
    console.error(err);
  } finally {
    addButton.disabled = prevStates.add;
    removeButton.disabled = prevStates.remove;
    newRecipeBtn.disabled = prevStates.newBtn;
  }
});

newRecipeBtn.addEventListener("click", () => {
  form.dispatchEvent(new Event("submit"));
});

copyBtn.addEventListener("click", () => {
  const fullText = `${recipeTitle.textContent}\n\n${recipeText.textContent}`;
  navigator.clipboard.writeText(fullText);
  alert("Ricetta copiata! 📋");
});

// Modale
modalClose.addEventListener("click", () => {
  modal.classList.remove("active");
  modal.classList.add("hidden");
});

// Funzione API con gestione errori HTTP
async function fetchRecipe(ingredients, location) {
  const res = await fetch("/.netlify/functions/ricettario-chatgpt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredients, location })
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  if (!data?.message) throw new Error("Risposta API non valida");
  return data.message;
}