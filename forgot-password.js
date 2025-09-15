// forgot-password.js
import { auth } from "/shared/firebase.js";
import {
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const form = document.getElementById("reset-form");
const emailInput = document.getElementById("email");
const doneCard = document.getElementById("done");

// Prefill da ?email=... se presente
(function prefill() {
  const q = new URLSearchParams(location.search);
  const em = q.get("email");
  if (em) emailInput.value = em;
})();

function setLoading(b) {
  form?.querySelectorAll("button, input").forEach(el => el.disabled = b);
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = (emailInput.value || "").trim();
  if (!email) return;

  setLoading(true);
  try {
    // Opzionale: continua al login dopo il reset (mostrerà un pulsante "Continua")
    const continueUrl = new URL(location.origin + "/login.html");
    continueUrl.searchParams.set("email", email);

    await sendPasswordResetEmail(auth, email, {
      url: continueUrl.toString(),
      handleCodeInApp: false,   // usa la pagina hosted di Firebase per il reset
    });
    // UI generica (non rivela se l'email esiste)
    form.style.display = "none";
    doneCard.style.display = "block";
  } catch (err) {
    console.error("reset error:", err?.code, err?.message, err);
    // Mostra comunque messaggio generico per sicurezza
    form.style.display = "none";
    doneCard.style.display = "block";
  } finally {
    setLoading(false);
  }
});