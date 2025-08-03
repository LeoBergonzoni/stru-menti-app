// Firebase setup
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();
let user = null;
let clickLimit = 15;

const clickCounter = document.createElement("div");
clickCounter.id = "click-counter";
clickCounter.style.textAlign = "center";
clickCounter.style.fontSize = "0.85rem";
clickCounter.style.color = "#888";
clickCounter.style.marginTop = "1rem";
document.querySelector(".container").appendChild(clickCounter);

onAuthStateChanged(auth, async (u) => {
  user = u;
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  if (user) {
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      await setDoc(docRef, { usage: {}, premium: false });
    }

    const data = (await getDoc(docRef)).data();
    clickLimit = data.premium ? 300 : 30;
    const clicks = data.usage?.[monthKey] || 0;
    updateCounter(clicks, clickLimit);
  } else {
    const localClicks = parseInt(localStorage.getItem(`ricettario_${monthKey}`) || "0");
    updateCounter(localClicks, clickLimit);
  }
});

function updateCounter(count, limit) {
  clickCounter.textContent = `🍳 Ricette usate: ${count}/${limit}`;
}

async function checkAndIncrementClick() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  if (user) {
    const ref = doc(db, "users", user.uid);
    const docSnap = await getDoc(ref);
    const data = docSnap.data();
    const currentClicks = data.usage?.[monthKey] || 0;

    if (currentClicks >= clickLimit) {
      alert("Hai raggiunto il limite mensile di utilizzo.");
      return false;
    }

    await updateDoc(ref, {
      [`usage.${monthKey}`]: increment(1)
    });
    updateCounter(currentClicks + 1, clickLimit);
    return true;
  } else {
    const localKey = `ricettario_${monthKey}`;
    let clicks = parseInt(localStorage.getItem(localKey) || "0");
    if (clicks >= clickLimit) {
      alert("Hai raggiunto il limite. Accedi per ottenere più utilizzi!");
      return false;
    }
    localStorage.setItem(localKey, clicks + 1);
    updateCounter(clicks + 1, clickLimit);
    return true;
  }
}

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

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const allowed = await checkAndIncrementClick();
  if (!allowed) return;

  const ingredients = Array.from(
    document.querySelectorAll("input[name='ingredient']")
  ).map(input => input.value.trim()).filter(Boolean);

  const location = locationSelect.value;

  recipeText.textContent = "🍳 Sto preparando la ricetta...";
  recipeTitle.textContent = "";
  recipeOutput.classList.remove("hidden");

  const recipe = await fetchRecipe(ingredients, location);

  const [titleLine, ...rest] = recipe.split('\n');
  const cleanTitle = titleLine.replace(/^\[#*\- ]+/, '').trim();
  const body = rest.join('\n').trim();

  recipeTitle.textContent = `🍽️ ${cleanTitle}`;
  recipeText.textContent = body;
});

newRecipeBtn.addEventListener("click", () => {
  form.dispatchEvent(new Event("submit"));
});

copyBtn.addEventListener("click", () => {
  const fullText = `${recipeTitle.textContent}\n\n${recipeText.textContent}`;
  navigator.clipboard.writeText(fullText);
  alert("Ricetta copiata! 📋");
});