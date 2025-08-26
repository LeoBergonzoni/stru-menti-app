// PrezzoGiusto — script.js (contatore unico globale via usageHelper)

// Firebase + Auth
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Helper contatore condiviso
import { loadUsage, incrementUsage } from "/_assets/usageHelper.js";

// Config Firebase (come negli altri tool)
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

// Stato usage condiviso (verrà popolato da loadUsage)
let usage = { user: null, planLabel: "Anonimo", monthlyClicks: 0, maxClicks: 5 };

// Contatore visibile in fondo
const counterDiv = document.createElement("div");
counterDiv.style.cssText = "text-align:center;margin-top:1rem;font-size:0.85rem;color:#cbd5e1;";
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
  updateCounter(); showAuthLinks(!user);
});

// --- DOM logic ---
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("priceForm");
  const submitBtn = document.getElementById("submitBtn");
  const locationSelect = document.getElementById("location");
  const customLocationInput = document.getElementById("customLocation");
  const resultDiv = document.getElementById("result");

  // Modale limite
  const limitModal = document.getElementById("limit-modal");
  const closeLimit = document.getElementById("close-limit");

  locationSelect.addEventListener("change", () => {
    customLocationInput.classList.toggle("hidden", locationSelect.value !== "custom");
  });

  closeLimit.addEventListener("click", () => {
    limitModal.classList.remove("active");
    limitModal.classList.add("hidden");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // ✅ Controllo limite mensile globale
    if (usage.monthlyClicks >= usage.maxClicks) {
      limitModal.classList.add("active");
      limitModal.classList.remove("hidden");
      return;
    }

    const product = document.getElementById("product").value;
    const rawPrice = document.getElementById("price").value.replace(',', '.');
    const price = parseFloat(rawPrice);
    if (isNaN(price)) {
      alert("Inserisci un prezzo valido (es. 1,99 o 1.3)");
      return;
    }

    let location = locationSelect.value;
    if (location === "geolocate") {
      try {
        const position = await getGeolocation();
        location = `lat: ${position.coords.latitude}, lon: ${position.coords.longitude}`;
      } catch (err) {
        alert("Geolocalizzazione non disponibile: " + err.message);
        return;
      }
    } else if (location === "custom") {
      location = customLocationInput.value || "non specificato";
    }

    // Disabilita pulsante durante la richiesta
    const prevDisabled = submitBtn.disabled;
    submitBtn.disabled = true;

    try {
      const res = await fetch("/.netlify/functions/checkPrice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, price, location }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      if (!data?.result) throw new Error("Risposta AI non valida");

      const text = data.result.toLowerCase();
      let colorClass = "bg-blue-600";
      if (text.includes("molto sopra la media")) colorClass = "bg-red-600";
      else if (text.includes("sopra la media")) colorClass = "bg-yellow-600";
      else if (text.includes("molto sotto la media") || text.includes("sotto la media")) colorClass = "bg-green-600";

      resultDiv.className = `mt-6 p-4 rounded text-white font-bold text-center ${colorClass}`;
      resultDiv.innerText = data.result;
      resultDiv.classList.remove("hidden");

      // ✅ Incremento SOLO dopo risposta OK → contatore globale
      usage.monthlyClicks = await incrementUsage(usage);
      updateCounter();

    } catch (error) {
      resultDiv.className = "mt-6 p-4 rounded text-white font-bold text-center bg-red-600";
      resultDiv.innerText = "Errore nella richiesta: " + error.message;
      resultDiv.classList.remove("hidden");
      // ❌ niente incremento
    } finally {
      submitBtn.disabled = prevDisabled;
    }
  });

  function getGeolocation() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  }
});