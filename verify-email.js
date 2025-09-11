// verify-email.js — pagina verifica + scrittura doc utente post-verifica (tollerante agli errori)
import { auth, db } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  sendEmailVerification,
  reload,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// --- Query params (email, redirect/app) ---
const q = new URLSearchParams(location.search);
const emailParam = q.get("email") || "";
const redirectUri = q.get("redirect_uri")?.startsWith("stru-menti://")
  ? q.get("redirect_uri")
  : null;

// --- Safe DOM helpers ---
const $ = (id) => document.getElementById(id);
const targetEmailEl = $("target-email");
const openMailEl    = $("open-mail");
const statusEl      = $("status");
const resendBtn     = $("resend");
const iVerifiedBtn  = $("i-verified");

if (targetEmailEl) targetEmailEl.textContent = emailParam || "(la tua email)";
if (openMailEl)    openMailEl.href = "mailto:" + (emailParam || "");

function toast(msg){
  if (statusEl) statusEl.textContent = msg;
  console.log("[verify-email]", msg);
}

// --- Scrive/aggiorna il doc utente SOLO dopo verifica ---
async function finalizeUserDoc(u) {
  console.log("[verify-email] finalizeUserDoc", { uid: u?.uid, verified: u?.emailVerified });
  if (!u || !u.uid) return;

  // 1) profilo temporaneo (nome/cognome) salvato da signup
  let pending = {};
  try { pending = JSON.parse(sessionStorage.getItem("pendingProfile") || "{}"); } catch {}
  const firstName = pending.firstName ?? null;
  const lastName  = pending.lastName ?? null;

  // 2) (opzionale) imposta displayName se mancante
  if ((firstName || lastName) && !u.displayName) {
    try { await updateProfile(u, { displayName: `${firstName || ""} ${lastName || ""}`.trim() }); } catch {}
  }

  // 3) scrittura doc utente (merge: true)
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

function finishAndLeave() {
  if (redirectUri) location.replace(redirectUri);
  else location.replace("index.html");
}

// --- Flusso principale ---
onAuthStateChanged(auth, async (u) => {
  console.log("[verify-email] onAuthStateChanged; user:", !!u);
  if (!u) {
    toast("Accedi per completare la verifica (stesso browser).");
    return;
  }
  try { await reload(u); } catch {}
  console.log("[verify-email] emailVerified =", u.emailVerified);

  if (u.emailVerified) {
    try {
      // Se il doc manca → crealo; se c'è ma è pending → promuovi
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await finalizeUserDoc(u);
        console.log("[verify-email] user doc created");
      } else {
        const cur = snap.data() || {};
        if (cur.plan === "pending-verify" || !("plan" in cur)) {
          await setDoc(ref, { plan: "free-logged" }, { merge: true });
          console.log("[verify-email] user plan promoted to free-logged");
        } else {
          console.log("[verify-email] user doc already ok");
        }
      }
    } catch (e) {
      console.error("[verify-email] Firestore write error:", e?.code, e?.message, e);
      // NON blocchiamo il flusso: la home con _assets/auth-bootstrap.js completerà la creazione
      toast("Non riesco a salvare ora. Continuiamo: completerò in automatico.");
    }
    finishAndLeave();
  } else {
    toast("Email non ancora verificata. Controlla la posta o usa i pulsanti qui sotto.");
  }
});

// --- Bottoni ---
if (resendBtn) {
  resendBtn.addEventListener("click", async () => {
    const u = auth.currentUser;
    if (!u) { toast("Devi prima effettuare l’accesso."); return; }
    try {
      // continue verso verify-email.html per garantire finalize in ogni percorso
      const contUrl = new URL(location.origin + "/verify-email.html");
      contUrl.searchParams.set("email", u.email || "");
      if (redirectUri) contUrl.searchParams.set("redirect_uri", redirectUri);
      await sendEmailVerification(u, {
        url: contUrl.toString(),
        handleCodeInApp: false,
      });
      toast("Nuova email inviata.");
    } catch (e) {
      console.error(e);
      toast("Impossibile inviare ora. Riprova tra poco.");
    }
  });
}

if (iVerifiedBtn) {
  iVerifiedBtn.addEventListener("click", async () => {
    const u = auth.currentUser;
    if (!u) { toast("Devi prima effettuare l’accesso."); return; }
    try {
      await reload(u);
      if (u.emailVerified) {
        try { await finalizeUserDoc(u); } 
        catch (e) { console.error("finalize doc err:", e); toast("Non riesco a salvare ora. Proseguo."); }
        finishAndLeave();
      } else {
        toast("Non risulta ancora verificata. Controlla la posta/spam.");
      }
    } catch (e) {
      console.error(e);
      toast("Errore di aggiornamento. Riprova.");
    }
  });
}