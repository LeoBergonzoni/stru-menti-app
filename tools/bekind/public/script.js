// BeKind — script.js (contatore unico globale via usageHelper)

// Firebase + Auth
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Helper contatore condiviso
import { loadUsage, incrementUsage } from "/_assets/usageHelper.js";

// Config Firebase (uguale agli altri tool)
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

// Stato usage condiviso
let usage = { user: null, planLabel: "Anonimo", monthlyClicks: 0, maxClicks: 5 };

// UI elements
const beKindBtn = document.getElementById('beKindBtn');
const responseText = document.getElementById('responseText');
const outputContainer = document.getElementById('outputContainer');

// Modale limite (identico agli altri)
const limitModal = document.getElementById('limit-modal');
const closeLimit = document.getElementById('close-limit');

// Contatore visibile in fondo
const counterDiv = document.createElement("div");
counterDiv.style.cssText = "text-align:center; margin-top:2rem; font-size:0.85rem; color:#888;";
const footer = document.querySelector("footer");
if (footer) document.body.insertBefore(counterDiv, footer); else document.body.appendChild(counterDiv);

const authLinks = document.createElement('p');
authLinks.id = 'auth-links';
authLinks.style.cssText = "text-align:center; margin:.25rem 0 0; font-size:0.9rem;";
authLinks.innerHTML = `<a href="https://stru-menti.com/login.html">Accedi</a> | <a href="https://stru-menti.com/signup.html">Registrati</a>`;
counterDiv.after(authLinks);
authLinks.hidden = true; // mostrali solo se anonimo

function showAuthLinks(isAnon){
  authLinks.hidden = !isAnon;
}

function updateCounter() {
  const shownMax = (usage.maxClicks > 1e8) ? "∞" : usage.maxClicks;
  counterDiv.innerHTML = `👤 Utente: <strong>${usage.planLabel}</strong> — Utilizzi: <strong>${usage.monthlyClicks}/${shownMax}</strong>`;
}

// Carica piano + contatore globale quando cambia l’auth
onAuthStateChanged(auth, async (user) => {
  usage = await loadUsage(app, user);
  updateCounter(); showAuthLinks(!user)
});

closeLimit?.addEventListener("click", () => {
  limitModal.classList.remove("active");
  limitModal.classList.add("hidden");
});

beKindBtn.addEventListener("click", async () => {
  const userInput = document.getElementById('userInput').value.trim();
  if (!userInput) return alert("Scrivi prima una frase!");

  // ✅ Controllo limite mensile globale
  if (usage.monthlyClicks >= usage.maxClicks) {
    limitModal.classList.add("active");
    limitModal.classList.remove("hidden");
    return;
  }

  const prompt = `Riformula questa frase: "${userInput}" in maniera gentile, corretta e professionale, in modo che chi la legge sia invogliato ad essere d’accordo con te.`;

  // Disabilita bottone durante la richiesta
  const prevDisabled = beKindBtn.disabled;
  beKindBtn.disabled = true;

  try {
    const res = await fetch("/.netlify/functions/bekind-rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    if (!data?.result) throw new Error("Risposta AI non valida");

    responseText.textContent = data.result;
    outputContainer.style.display = 'block';

    // ✅ Incremento SOLO dopo risposta OK → contatore globale
    usage.monthlyClicks = await incrementUsage(usage);
    updateCounter();

  } catch (error) {
    responseText.textContent = "Errore nella comunicazione con l’AI: " + error.message;
    outputContainer.style.display = 'block';
    // ❌ niente incremento in caso d’errore
  } finally {
    beKindBtn.disabled = prevDisabled;
  }
});

window.copyText = function () {
  navigator.clipboard.writeText(responseText.textContent);
  alert("Frase copiata negli appunti!");
};