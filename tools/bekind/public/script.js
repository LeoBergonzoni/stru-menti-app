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
  increment
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

// UI elements
const beKindBtn = document.getElementById('beKindBtn');
const responseText = document.getElementById('responseText');
const outputContainer = document.getElementById('outputContainer');
const modal = document.getElementById('popup-modal');
const modalClose = document.getElementById('close-modal');

// Contatore in fondo alla pagina
const counterDiv = document.createElement("div");
counterDiv.style.cssText = "text-align:center; margin-top:2rem; font-size:0.85rem; color:#888;";
document.body.insertBefore(counterDiv, document.querySelector("footer"));

let user = null;
let userPlan = "Anonimo";
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
    user = null;
    userPlan = "Anonimo";
    maxClicks = 15;
    const storedClicks = localStorage.getItem("anonBeKindClicks");
    const storedMonth = localStorage.getItem("anonBeKindMonth");
    const nowMonth = getCurrentMonthKey();
    monthlyClicks = (storedMonth === nowMonth) ? parseInt(storedClicks || "0") : 0;
  }

  updateCounter();
});

beKindBtn.addEventListener("click", async () => {
  const userInput = document.getElementById('userInput').value.trim();
  if (!userInput) return alert("Scrivi prima una frase!");

  if (monthlyClicks >= maxClicks) {
    alert("Hai raggiunto il limite mensile. Accedi o passa a Premium per più utilizzi!");
    return;
  }

  const prompt = `Riformula questa frase: "${userInput}" in maniera gentile, corretta e professionale, in modo che chi la legge sia invogliato ad essere d’accordo con te.`;

  try {
    const res = await fetch("/.netlify/functions/bekind-rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    responseText.textContent = data.result || "🤖 L'AI non ha generato una risposta. Riprova con una frase più chiara.";
    outputContainer.style.display = 'block';
  } catch (error) {
    responseText.textContent = "Errore nella comunicazione con l’intelligenza artificiale.";
    outputContainer.style.display = 'block';
  }

  monthlyClicks++;
  if (user) {
    const monthKey = getCurrentMonthKey();
    const clickRef = doc(db, "clicks", user.uid);
    await updateDoc(clickRef, { [monthKey]: increment(1) });
  } else {
    localStorage.setItem("anonBeKindClicks", monthlyClicks);
    localStorage.setItem("anonBeKindMonth", getCurrentMonthKey());
  }

  updateCounter();
});

window.copyText = function () {
  navigator.clipboard.writeText(responseText.textContent);
  alert("Frase copiata negli appunti!");
};