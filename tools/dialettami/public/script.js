
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

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

const form = document.getElementById("dialect-form");
const resultDiv = document.getElementById("result");
const counterDiv = document.getElementById("counter");
const modal = document.getElementById("popup-modal");

let user = null;
let userPlan = "Anonimo";
let maxClicks = 5;
let monthlyClicks = 0;

function getMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}
function updateCounter() {
  counterDiv.innerHTML = `👤 Utente: <strong>${userPlan}</strong> — Utilizzi: <strong>${monthlyClicks}/${maxClicks}</strong>`;
}

onAuthStateChanged(auth, async (currentUser) => {
  if (currentUser) {
    user = currentUser;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      userPlan = data.plan || "free-logged";
    }
    maxClicks = userPlan === "premium" ? 300 : 30;
    const clickDoc = await getDoc(doc(db, "clicks", user.uid));
    monthlyClicks = clickDoc.exists() ? (clickDoc.data()[getMonthKey()] || 0) : 0;
  } else {
    const stored = localStorage.getItem("anonClicks");
    const storedMonth = localStorage.getItem("anonMonth");
    const now = getMonthKey();
    monthlyClicks = (storedMonth === now) ? parseInt(stored || "0") : 0;
  }
  updateCounter();
});

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

  const res = await fetch("/.netlify/functions/dialettami", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: userInput, mode })
  });

  const data = await res.json();
  resultDiv.textContent = data.result || "❌ Nessuna risposta ricevuta.";

  // Conteggio
  monthlyClicks++;
  updateCounter();

  if (user) {
    await updateDoc(doc(db, "clicks", user.uid), {
      [getMonthKey()]: increment(1)
    });
  } else {
    localStorage.setItem("anonClicks", monthlyClicks);
    localStorage.setItem("anonMonth", getMonthKey());
  }
});
