import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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
const modal = document.getElementById("popup-modal");
const modalClose = document.getElementById("close-modal");

// Contatore visibile in fondo
const counterDiv = document.createElement("div");
counterDiv.style.cssText = "text-align:center; margin-top:1rem; font-size:0.85rem; color:#888;";
document.body.insertBefore(counterDiv, document.querySelector("footer"));

let user = null;
let userPlan = "anonymous";
let monthlyClicks = 0;
let maxClicks = 15;

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
};

function updateCounter() {
  counterDiv.innerHTML = `👤 Utente: <strong>${userPlan}</strong> — Utilizzi: <strong>${monthlyClicks}/${maxClicks}</strong>`;
}

onAuthStateChanged(auth, async (currentUser) => {
  if (currentUser) {
    user = currentUser;
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (userSnap.exists()) {
      const userData = userSnap.data();
      userPlan = userData.plan || "free-logged";
    }

    maxClicks = userPlan === "premium" ? 300 : 30;

    const clickRef = doc(db, "clicks", user.uid);
    const clickSnap = await getDoc(clickRef);
    const monthKey = getCurrentMonthKey();

    if (!clickSnap.exists()) {
      await setDoc(clickRef, { [monthKey]: 0 });
      monthlyClicks = 0;
    } else {
      monthlyClicks = clickSnap.data()[monthKey] || 0;
    }
  } else {
    // Anonimo
    user = null;
    userPlan = "Anonimo";
    maxClicks = 15;
    const storedClicks = localStorage.getItem("anonClicks");
    const storedMonth = localStorage.getItem("anonMonth");
    const nowMonth = getCurrentMonthKey();
    monthlyClicks = (storedMonth === nowMonth) ? parseInt(storedClicks || "0") : 0;
  }

  if (monthlyClicks >= maxClicks) {
    alert("Hai raggiunto il numero massimo di utilizzi mensili per utenti anonimi. Per continuare, effettua il login.");
    window.location.href = "/login.html";
    return;
  }


  updateCounter();
});

addButton.addEventListener("click", () => {
  const currentInputs = ingredientContainer.querySelectorAll("input").length;
  if (currentInputs < 10) {
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
  if (inputs.length > 2) {
    ingredientContainer.removeChild(inputs[inputs.length - 1]);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (monthlyClicks >= maxClicks) {
    modal.classList.remove("hidden");
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
  const [titleLine, ...rest] = recipe.split('\n');
  const cleanTitle = titleLine.replace(/^["#*\- ]+/, '').trim();
  const body = rest.join('\n').trim();

  recipeTitle.textContent = `🍽️ ${cleanTitle}`;
  recipeText.textContent = body;

  // Aggiorna conteggio
  monthlyClicks++;

  if (user) {
    const monthKey = getCurrentMonthKey();
    const clickRef = doc(db, "clicks", user.uid);
    await updateDoc(clickRef, { [monthKey]: increment(1) });
  } else {
    localStorage.setItem("anonClicks", monthlyClicks);
    localStorage.setItem("anonMonth", getCurrentMonthKey());
  }

  updateCounter(); // aggiorna subito il testo visibile
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
  modal.classList.add("hidden");
});

// Funzione API
async function fetchRecipe(ingredients, location) {
  const response = await fetch("/.netlify/functions/ricettario-chatgpt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredients, location })
  });

  const data = await response.json();
  return data.message;
}