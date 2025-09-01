// BeKind — script.js (contatore unico globale via usageHelper + Preferiti in localStorage)

import { app, auth } from "/shared/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { loadUsage, incrementUsage } from "/_assets/usageHelper.js";

// ===== Stato usage condiviso
let usage = { user: null, planLabel: "Anonimo", monthlyClicks: 0, maxClicks: 5 };

// ===== Preferiti (localStorage)
const FAVORITES_KEY = "bekind:favorites";
let lastRaw = "";
function loadFavs() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]"); }
  catch { return []; }
}
function saveFav(pair) {
  let list = loadFavs();
  // Evita duplicati identici su tutta la lista
  const exists = list.some(x => x.raw === pair.raw && x.polite === pair.polite);
  if (!exists) {
    list.unshift({ id: Date.now(), ...pair });
    if (list.length > 5) list = list.slice(0, 5);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  }
}

// ===== UI helpers
let counterDiv, authLinks;
function showAuthLinks(isAnon) {
  if (authLinks) authLinks.hidden = !isAnon;
}
function updateCounter() {
  if (!counterDiv) return;
  const shownMax = (usage.maxClicks > 1e8) ? "∞" : usage.maxClicks;
  counterDiv.innerHTML = `👤 Utente: <strong>${usage.planLabel}</strong> — Utilizzi: <strong>${usage.monthlyClicks}/${shownMax}</strong>`;
}

// ===== DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  // --- Selettori UI principali
  const beKindBtn = document.getElementById('beKindBtn');
  const responseText = document.getElementById('responseText');
  const outputContainer = document.getElementById('outputContainer');

  // --- Modale limite
  const limitModal = document.getElementById('limit-modal');
  const closeLimit = document.getElementById('close-limit');
  closeLimit?.addEventListener("click", () => {
    limitModal?.classList.remove("active");
    limitModal?.classList.add("hidden");
  });

  // --- Contatore visibile in fondo
  counterDiv = document.createElement("div");
  counterDiv.style.cssText = "text-align:center; margin-top:2rem; font-size:0.85rem; color:#888;";
  const footer = document.querySelector("footer");
  if (footer) document.body.insertBefore(counterDiv, footer); else document.body.appendChild(counterDiv);

  // --- Link Accedi/Registrati (nascosti se loggati)
  authLinks = document.createElement('p');
  authLinks.id = 'auth-links';
  authLinks.style.cssText = "text-align:center; margin:.25rem 0 0; font-size:0.9rem;";
  const base = location.origin;
  authLinks.innerHTML = `<a href="${base}/login.html">Accedi</a> | <a href="${base}/signup.html">Registrati</a>`;
  counterDiv.after(authLinks);
  authLinks.hidden = true;

  // --- Auth state → carica piano + contatore globale
  onAuthStateChanged(auth, async (user) => {
    usage = await loadUsage(app, user);
    updateCounter();
    showAuthLinks(!user);
  });

  // --- Click principale "Riformula"
  beKindBtn?.addEventListener("click", async () => {
    const userInputEl = document.getElementById('userInput');
    const userInput = (userInputEl?.value || "").trim();
    lastRaw = userInput;
    if (!userInput) return alert("Scrivi prima una frase!");

    // Limite mensile globale
    if (usage.monthlyClicks >= usage.maxClicks) {
      if (limitModal) {
        limitModal.classList.add("active");
        limitModal.classList.remove("hidden");
      }
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
      if (outputContainer) outputContainer.style.display = 'block';

      // --- Preferiti: usa onclick per evitare accumulo di listener
      const saveBtn = document.getElementById('saveFavoriteBtn');
      if (saveBtn) {
        saveBtn.onclick = null; // pulisci handler precedenti
        saveBtn.onclick = () => {
          const polite = (responseText.textContent || "").trim();
          if (!polite) return alert("Niente da salvare.");
          saveFav({ raw: lastRaw, polite });
          alert("Salvato nei preferiti!");
        };
      }

      // Incremento contatore globale SOLO dopo risposta OK
      usage.monthlyClicks = await incrementUsage(usage);
      updateCounter();

    } catch (error) {
      responseText.textContent = "Errore nella comunicazione con l’AI: " + error.message;
      if (outputContainer) outputContainer.style.display = 'block';
      // niente incremento in caso d’errore
    } finally {
      beKindBtn.disabled = prevDisabled;
    }
  });

  // --- Funzione globale copia (usata da onclick in HTML)
  window.copyText = function () {
    const text = (responseText?.textContent || "");
    navigator.clipboard.writeText(text);
    alert("Frase copiata negli appunti!");
  };
});