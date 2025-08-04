// Firebase e contatore click
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, increment
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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
let userPlan = "anonymous";
let monthlyClicks = 0;
let maxClicks = 15;

const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
};

const counterDiv = document.createElement("div");
counterDiv.style.cssText = "text-align:center;margin-top:1rem;font-size:0.85rem;color:#cbd5e1;";
document.body.appendChild(counterDiv);

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
    user = null;
    userPlan = "Anonimo";
    maxClicks = 15;
    const storedClicks = localStorage.getItem("anonClicks");
    const storedMonth = localStorage.getItem("anonMonth");
    const nowMonth = getCurrentMonthKey();
    monthlyClicks = (storedMonth === nowMonth) ? parseInt(storedClicks || "0") : 0;
  }

  updateCounter();
});

// Script originale DOM

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("priceForm");
  const locationSelect = document.getElementById("location");
  const customLocationInput = document.getElementById("customLocation");
  const resultDiv = document.getElementById("result");

  locationSelect.addEventListener("change", () => {
    customLocationInput.classList.toggle("hidden", locationSelect.value !== "custom");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (monthlyClicks >= maxClicks) {
      alert("Hai raggiunto il numero massimo di utilizzi per questo mese.\nAccedi o aggiorna il piano per continuare.");
      if (!user) window.location.href = "/login.html";
      return;
    }

    const product = document.getElementById("product").value;
    const rawPrice = document.getElementById("price").value.replace(',', '.');
    const price = parseFloat(rawPrice);
    if (isNaN(price)) {
      alert("Inserisci un prezzo valido (es. 1,99 o 1,3)");
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

    try {
      const res = await fetch("/.netlify/functions/checkPrice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, price, location }),
      });

      const data = await res.json();

      if (data.result) {
        const text = data.result.toLowerCase();
        let colorClass = "bg-blue-600";

        if (text.includes("molto sopra la media")) colorClass = "bg-red-600";
        else if (text.includes("sopra la media")) colorClass = "bg-yellow-600";
        else if (text.includes("molto sotto la media") || text.includes("sotto la media")) colorClass = "bg-green-600";

        resultDiv.className = `mt-6 p-4 rounded text-white font-bold text-center ${colorClass}`;
        resultDiv.innerText = data.result;
        resultDiv.classList.remove("hidden");
      } else {
        resultDiv.className = "mt-6 p-4 rounded text-white font-bold text-center bg-red-600";
        resultDiv.innerText = "Errore nella risposta dell'intelligenza artificiale.";
        resultDiv.classList.remove("hidden");
      }
    } catch (error) {
      resultDiv.className = "mt-6 p-4 rounded text-white font-bold text-center bg-red-600";
      resultDiv.innerText = "Errore nella richiesta: " + error.message;
      resultDiv.classList.remove("hidden");
    }

    // aggiorna conteggio
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
  });

  function getGeolocation() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  }
});