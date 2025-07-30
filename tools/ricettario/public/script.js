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
  const response = await fetch("/.tools/ricettario/netlify/functions/chatgpt.js", {
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

  const ingredients = Array.from(
    document.querySelectorAll("input[name='ingredient']")
  ).map(input => input.value.trim()).filter(Boolean);

  const location = locationSelect.value;

  recipeText.textContent = "🍳 Sto preparando la ricetta...";
  recipeTitle.textContent = "";
  recipeOutput.classList.remove("hidden");

  const recipe = await fetchRecipe(ingredients, location);

  // Estrai titolo e corpo della ricetta
  const [titleLine, ...rest] = recipe.split('\n');
  const cleanTitle = titleLine.replace(/^["#*\- ]+/, '').trim(); // rimuove eventuali simboli Markdown
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