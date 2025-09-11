// verify-email.js — pagina di attesa/verifica + creazione doc utente post-verifica
import { auth, db } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  sendEmailVerification,
  reload,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Legge parametri (email, redirect/app)
const q = new URLSearchParams(location.search);
const emailParam = q.get("email") || "";
const redirectUri = q.get("redirect_uri")?.startsWith("stru-menti://")
  ? q.get("redirect_uri")
  : null;

document.getElementById("target-email").textContent = emailParam || "(la tua email)";
document.getElementById("open-mail").href = "mailto:" + (emailParam || "");

const statusEl = document.getElementById("status");
function toast(msg){ statusEl.textContent = msg; }

// Scrive/aggiorna il doc utente SOLO dopo verifica
async function finalizeUserDoc(u) {
  // recupera eventuale profilo temporaneo
  let pending = {};
  try { pending = JSON.parse(sessionStorage.getItem("pendingProfile") || "{}"); } catch {}
  const firstName = pending.firstName ?? null;
  const lastName  = pending.lastName ?? null;

  // opzionale: imposta displayName se mancante
  if ((firstName || lastName) && !u.displayName) {
    try { await updateProfile(u, { displayName: `${firstName || ""} ${lastName || ""}`.trim() }); } catch {}
  }

  await setDoc(
    doc(db, "users", u.uid),
    {
      email: u.email || null,
      firstName, lastName,
      plan: "free-logged",
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );

  // pulizia
  sessionStorage.removeItem("pendingProfile");
}

// Stato auth → se già verified: finalizza doc e vai via
onAuthStateChanged(auth, async (u) => {
  if (!u) return;
  try { await reload(u); } catch {}
  if (u.emailVerified) {
    try { await finalizeUserDoc(u); } catch (e) { console.error("finalize doc err:", e); }
    if (redirectUri) location.replace(redirectUri);
    else location.replace("index.html");
  }
});

document.getElementById("resend").addEventListener("click", async () => {
  const u = auth.currentUser;
  if (!u) { toast("Devi prima effettuare l’accesso."); return; }
  try {
    await sendEmailVerification(u, {
      url: location.origin + "/index.html",
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
    await reload(u);
    if (u.emailVerified) {
      try { await finalizeUserDoc(u); } catch (e) { console.error("finalize doc err:", e); }
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