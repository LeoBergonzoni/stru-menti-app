// verify-email.js
import { auth } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  sendEmailVerification,
  reload,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// Legge parametri (email, redirect/app)
const q = new URLSearchParams(location.search);
const emailParam = q.get("email") || "";
const redirectUri = q.get("redirect_uri")?.startsWith("stru-menti://")
  ? q.get("redirect_uri")
  : null; // facoltativo: rientro in app

document.getElementById("target-email").textContent = emailParam || "(la tua email)";
document.getElementById("open-mail").href = "mailto:" + (emailParam || "");

const statusEl = document.getElementById("status");
function toast(msg){ statusEl.textContent = msg; }

// Stato auth → se già verified vai via
onAuthStateChanged(auth, async (u) => {
  if (!u) return;
  if (u.emailVerified) {
    // Verified → vai in app o home
    if (redirectUri) location.replace(redirectUri);
    else location.replace("index.html");
  }
});

document.getElementById("resend").addEventListener("click", async () => {
  const u = auth.currentUser;
  if (!u) { toast("Devi prima effettuare l’accesso."); return; }
  try {
    await sendEmailVerification(u, {
      url: location.origin + "/index.html", // al termine della verifica
      handleCodeInApp: false,
    });
    toast("Nuova email inviata.");
  } catch (e) {
    console.error(e);
    toast("Impossibile inviare ora. Riprova tra poco.");
  }
});

document.getElementById("i-verified").addEventListener("click", async () => {
  const u = auth.currentUser;
  if (!u) { toast("Devi prima effettuare l’accesso."); return; }
  try {
    await reload(u); // aggiorna i token
    if (u.emailVerified) {
      if (redirectUri) location.replace(redirectUri);
      else location.replace("index.html");
    } else {
      toast("Non risulta ancora verificata. Controlla la posta/spam.");
    }
  } catch (e) {
    console.error(e);
    toast("Errore di aggiornamento. Riprova.");
  }
});