// Firebase e contatore click
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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

let user = null;
let userPlan = "Anonimo";
let monthlyClicks = 0;
let maxClicks = 5;

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
};

// Contatore visibile
const counterDiv = document.createElement("div");
counterDiv.style.cssText = "text-align:center;margin-top:1rem;font-size:0.85rem;color:#cbd5e1;";
const footer = document.querySelector("footer");
if (footer) document.body.insertBefore(counterDiv, footer); else document.body.appendChild(counterDiv);

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
      monthlyClicks = clickSnap.data()?.[monthKey] ?? 0;
    }
  } else {
    user = null;
    userPlan = "Anonimo";
    maxClicks = 5;

    const storedClicks = localStorage.getItem("anonClicks");
    const storedMonth = localStorage.getItem("anonMonth");
    const nowMonth = getCurrentMonthKey();
    monthlyClicks = (storedMonth === nowMonth) ? parseInt(storedClicks || "0") : 0;
  }

  updateCounter();
});

// --- DOM logic ---
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("priceForm");
  const submitBtn = document.getElementById("submitBtn");
  const locationSelect = document.getElementById("location");
  const customLocationInput = document.getElementById("customLocation");
  const resultDiv = document.getElementById("result");

  // Modale
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

    if (monthlyClicks >= maxClicks) {
      // Mostra modale, niente redirect
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

      // ✅ Conteggio SOLO dopo risposta OK
      monthlyClicks++;
      if (user) {
        const monthKey = getCurrentMonthKey();
        const clickRef = doc(db, "clicks", user.uid);
        await updateDoc(clickRef, { [monthKey]: increment(1) });
      } else {
        localStorage.setItem("anonClicks", monthlyClicks);
        localStorage.setItem("anonMonth", getCurrentMonthKey());
      }
      updateCounter();

    } catch (error) {
      resultDiv.className = "mt-6 p-4 rounded text-white font-bold text-center bg-red-600";
      resultDiv.innerText = "Errore nella richiesta: " + error.message;
      resultDiv.classList.remove("hidden");
      // ❌ Niente incremento in caso di errore
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