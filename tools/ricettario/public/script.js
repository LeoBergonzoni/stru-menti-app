// Firebase (localStorage per ora, ma puoi estendere)
const firebaseConfig = {
  apiKey: "AIzaSyCRLUzNFa7GPLKzLYD440lNLONeUZGe-gI",
  authDomain: "stru-menti.firebaseapp.com",
  projectId: "stru-menti",
  storageBucket: "stru-menti.appspot.com",
  messagingSenderId: "851395234512",
  appId: "1:851395234512:web:9b2d36080c23ba4a2cecd5"
};

// Nessuna chiamata initializeApp() perché usiamo solo localStorage per ora

// UI references
const ingredientContainer = document.getElementById("ingredient-fields");
const addButton = document.getElementById("add-ingredient");
const removeButton = document.getElementById("remove-ingredient");
const form = document.getElementById("ingredients-form");
const locationSelect = document.getElementById("location");
const recipeOutput = document.getElementById("recipe-output");
const recipeTitle = document.querySelector("#recipe-output h2");
const recipeText = document.getElementById("recipe-text");
const newRecipeBtn = document.getElementById("new-recipe");
const copyBtn = document.getElementById("copy-recipe");

let maxIngredients = 10;
let minIngredients = 2;

// ➕➖ Aggiungi/Rimuovi ingredienti
addButton.addEventListener("click", () => {
  const currentInputs = ingredientContainer.querySelectorAll("input").length;
  if (currentInputs < maxIngredients) {
    const input = document.createElement("input");
    input.type = "text";
    input.name = "ingredient";
    input.placeholder = `Ingrediente ${currentInputs + 1}`;
    input.required = true;
    ingredientContainer.appendChild(input);
  }
});

removeButton.addEventListener("click", () => {
  const inputs = ingredientContainer.querySelectorAll("input");
  if (inputs.length > minIngredients) {
    ingredientContainer.removeChild(inputs[inputs.length - 1]);
  }
});

// 🔄 Reset mensile dei click (locale)
function resetMonthlyClickCount() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const lastSavedMonth = localStorage.getItem("ricettario-click-month");

  if (lastSavedMonth !== monthKey) {
    localStorage.setItem("ricettario-click-month", monthKey);
    localStorage.setItem("ricettario-click-count", "0");
  }
}

function getClickCount() {
  return parseInt(localStorage.getItem("ricettario-click-count") || "0");
}

function incrementClickCount() {
  const current = getClickCount();
  localStorage.setItem("ricettario-click-count", current + 1);
  updateClickDisplay();
}

function updateClickDisplay() {
  let display = document.getElementById("click-counter");
  if (!display) {
    display = document.createElement("div");
    display.id = "click-counter";
    display.style.fontSize = "0.85rem";
    display.style.color = "#888";
    display.style.textAlign = "center";
    display.style.margin = "1rem auto";
    form.parentNode.insertBefore(display, form.nextSibling);
  }

  const count = getClickCount();
  display.textContent = `Hai usato questo strumento ${count}/15 volte questo mese`;
}

resetMonthlyClickCount();
updateClickDisplay();

// 🎯 Chiamata a funzione server
async function fetchRecipe(ingredients, location) {
  const response = await fetch("/.netlify/functions/ricettario-chatgpt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ingredients, location })
  });

  const data = await response.json();
  return data.message;
}

// 🚀 Invio del form
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (getClickCount() >= 15) {
    alert("Hai raggiunto il limite mensile gratuito per questo strumento. Accedi o passa a Premium per continuare.");
    return;
  }

  const ingredients = Array.from(
    document.querySelectorAll("input[name='ingredient']")
  ).map(input => input.value.trim()).filter(Boolean);

  const location = locationSelect.value;

  recipeText.textContent = "🍳 Sto preparando la ricetta...";
  recipeTitle.textContent = "";
  recipeOutput.classList.remove("hidden");

  try {
    const recipe = await fetchRecipe(ingredients, location);

    // Estrai titolo e corpo della ricetta
    const [titleLine, ...rest] = recipe.split('\n');
    const cleanTitle = titleLine.replace(/^["#*\- ]+/, '').trim();
    const body = rest.join('\n').trim();

    recipeTitle.textContent = `🍽️ ${cleanTitle}`;
    recipeText.textContent = body;

    incrementClickCount();
  } catch (error) {
    recipeTitle.textContent = "Errore";
    recipeText.textContent = "Impossibile generare la ricetta. Riprova più tardi.";
    console.error("Errore nella richiesta:", error);
  }
});

// 🔁 Nuova ricetta
newRecipeBtn.addEventListener("click", () => {
  form.dispatchEvent(new Event("submit"));
});

// 📋 Copia
copyBtn.addEventListener("click", () => {
  const fullText = `${recipeTitle.textContent}\n\n${recipeText.textContent}`;
  navigator.clipboard.writeText(fullText);
  alert("Ricetta copiata! 📋");
});