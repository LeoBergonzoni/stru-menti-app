import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Config
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
const counterDiv = document.createElement("div");
counterDiv.style.cssText = "text-align:center; margin-top:1rem; font-size:0.85rem; color:#888;";
document.body.insertBefore(counterDiv, document.querySelector("footer"));

let maxIngredients = 10;
let minIngredients = 2;

let currentUser = null;
let userLevel = "Anonimo";
let clickLimit = 15;
let currentClickCount = 0;

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

async function getUserClickCount(uid) {
  const docRef = doc(db, "clicks", uid);
  const snap = await getDoc(docRef);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  if (snap.exists()) {
    const data = snap.data();
    return data[monthKey] || 0;
  }
  return 0;
}

async function incrementUserClick(uid) {
  const docRef = doc(db, "clicks", uid);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  const currentData = (await getDoc(docRef)).data() || {};
  const currentCount = currentData[monthKey] || 0;

  await setDoc(docRef, {
    ...currentData,
    [monthKey]: currentCount + 1,
    lastUpdated: serverTimestamp()
  });
}

function getAnonymousClickCount() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const stored = JSON.parse(localStorage.getItem("anonClicks")) || {};
  return stored[monthKey] || 0;
}

function incrementAnonymousClick() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const stored = JSON.parse(localStorage.getItem("anonClicks")) || {};
  stored[monthKey] = (stored[monthKey] || 0) + 1;
  localStorage.setItem("anonClicks", JSON.stringify(stored));
}

function updateCounter() {
  counterDiv.innerHTML = `👤 Utente: <strong>${userLevel}</strong> — Utilizzi: <strong>${currentClickCount}/${clickLimit}</strong>`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (currentClickCount >= clickLimit) {
    window.location.href = "/iscriviti.html";
    return;
  }

  const ingredients = Array.from(
    document.querySelectorAll("input[name='ingredient']")
  ).map(input => input.value.trim()).filter(Boolean);

  const location = locationSelect.value;

  recipeText.textContent = "🍳 Sto preparando la ricetta...";
  recipeTitle.textContent = "";
  recipeOutput.classList.remove("hidden");

  const recipe = await fetchRecipe(ingredients, location);

  // Estrai titolo e corpo
  const [titleLine, ...rest] = recipe.split('\n');
  const cleanTitle = titleLine.replace(/^["#*\- ]+/, '').trim();
  const body = rest.join('\n').trim();

  recipeTitle.textContent = `🍽️ ${cleanTitle}`;
  recipeText.textContent = body;

  // Aggiorna contatore
  if (currentUser) {
    await incrementUserClick(currentUser.uid);
    currentClickCount++;
  } else {
    incrementAnonymousClick();
    currentClickCount++;
  }
  updateCounter();
});

newRecipeBtn.addEventListener("click", () => {
  form.dispatchEvent(new Event("submit"));
});

copyBtn.addEventListener("click", () => {
  const fullText = `${recipeTitle.textContent}\n\n${recipeText.textContent}`;
  navigator.clipboard.writeText(fullText);
  alert("Ricetta copiata! 📋");
});

// Inizializza utente e click
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const docRef = doc(db, "users", user.uid);
    const snap = await getDoc(docRef);
    const userData = snap.data();
    if (userData && userData.role === "premium") {
      userLevel = "Premium";
      clickLimit = 300;
    } else {
      userLevel = "Loggato";
      clickLimit = 30;
    }
    currentClickCount = await getUserClickCount(user.uid);
  } else {
    userLevel = "Anonimo";
    clickLimit = 15;
    currentClickCount = getAnonymousClickCount();
  }
  updateCounter();
});