import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
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
  const form = document.getElementById("dialect-form");
  const resultDiv = document.getElementById("result");
  const counterDiv = document.getElementById("counter");
  const modal = document.getElementById("popup-modal");

  // Contatore in fondo se non presente
  if (!counterDiv) {
    const div = document.createElement("div");
    div.id = "counter";
    div.style.cssText = "text-align:center; margin-top:1rem; font-size:0.85rem; color:#555;";
    document.body.insertBefore(div, document.querySelector("footer"));
  }

  let user = null;
  let userPlan = "Anonimo";
  let maxClicks = 5;
  let monthlyClicks = 0;

  const getMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}`;
  };

  const updateCounter = () => {
    counterDiv.innerHTML = `👤 Utente: <strong>${userPlan}</strong> — Utilizzi: <strong>${monthlyClicks}/${maxClicks}</strong>`;
  };

  // Check login e recupera piano
  onAuthStateChanged(auth, async (currentUser) => {
    if (currentUser) {
      user = currentUser;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        userPlan = data.plan || "free-logged";
      }

      maxClicks = userPlan === "premium" ? 300 : 30;

      const clickRef = doc(db, "clicks", user.uid);
      const snap = await getDoc(clickRef);
      const monthKey = getMonthKey();

      if (!snap.exists()) {
        await setDoc(clickRef, { [monthKey]: 0 });
        monthlyClicks = 0;
      } else {
        monthlyClicks = snap.data()[monthKey] || 0;
      }
    } else {
      user = null;
      userPlan = "Anonimo";
      maxClicks = 5;
      const stored = localStorage.getItem("anonClicks");
      const storedMonth = localStorage.getItem("anonMonth");
      const nowMonth = getMonthKey();
      monthlyClicks = (storedMonth === nowMonth) ? parseInt(stored || "0") : 0;
    }

    updateCounter();
  });

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (monthlyClicks >= maxClicks) {
      modal.classList.remove("hidden");
      return;
    }

    const userInput = document.getElementById("userInput").value.trim();
    const mode = document.getElementById("mode").value;

    if (!userInput) {
      alert("Scrivi una frase prima!");
      return;
    }

    resultDiv.textContent = "💬 Sto traducendo...";
    resultDiv.classList.remove("hidden");

    try {
      const res = await fetch("/.netlify/functions/dialettami", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userInput, mode })
      });

      const data = await res.json();
      const output = data.result || "❌ Nessuna risposta ricevuta.";
      resultDiv.innerHTML = `
        <p>${output}</p>
        <button id="copyBtn" class="mt-3 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">📋 Copia</button>
      `;

      document.getElementById("copyBtn").addEventListener("click", () => {
        navigator.clipboard.writeText(output);
        alert("Testo copiato! 📋");
      });

    } catch (error) {
      resultDiv.textContent = "Errore nella richiesta.";
    }

    // Incrementa click
    monthlyClicks++;
    updateCounter();

    if (user) {
      const ref = doc(db, "clicks", user.uid);
      await updateDoc(ref, {
        [getMonthKey()]: increment(1)
      });
    } else {
      localStorage.setItem("anonClicks", monthlyClicks);
      localStorage.setItem("anonMonth", getMonthKey());
    }
    // Integrazione dettatura vocale
const micBtn = document.getElementById("dictate-btn");
const inputField = document.getElementById("userInput");

if (micBtn && inputField) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.title = "Il tuo browser non supporta la dettatura vocale.";
  } else {
    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;

    micBtn.addEventListener("click", () => {
      recognition.start();
      micBtn.disabled = true;
      micBtn.textContent = "🎙️ Ascolto...";
    });

    recognition.addEventListener("result", (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      inputField.value = transcript;
    });

    recognition.addEventListener("end", () => {
      micBtn.disabled = false;
      micBtn.textContent = "🎙️";
    });

    recognition.addEventListener("error", (e) => {
      alert("Errore nella dettatura vocale: " + e.error);
      micBtn.disabled = false;
      micBtn.textContent = "🎙️";
    });
  }
}
  });
});
