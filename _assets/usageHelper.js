// /_assets/usageHelper.js — contatore unico mensile per tutti i tool

import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

export const MONTH_KEY = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`; // es. 2025-08
};

// Chiavi localStorage per anonimi (contatore unico globale)
const LS_MONTH  = "anonMonth_global";
const LS_CLICKS = "anonClicks_global";

/**
 * Carica info piano + contatore mensile globale.
 * Accetta opzionalmente `userFromCaller` per evitare race condition
 * con onAuthStateChanged (dove currentUser può essere ancora null).
 */
export async function loadUsage(app, userFromCaller = null) {
  const auth = getAuth(app);
  const db   = getFirestore(app);
  const user = userFromCaller ?? auth.currentUser;

  // default: anonimo
  let planLabel = "Anonimo";
  let maxClicks = 5;
  let monthlyClicks = 0;

  if (!user) {
    const m   = MONTH_KEY();
    const cur = localStorage.getItem(LS_MONTH);
    const val = localStorage.getItem(LS_CLICKS);
    monthlyClicks = (cur === m) ? parseInt(val || "0", 10) : 0;
    return { db, auth, user: null, planLabel, maxClicks, monthlyClicks, monthKey: m };
  }

  // LOGGATO → leggi profilo utente per piano/limite
  const m = MONTH_KEY();
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const d = snap.exists() ? snap.data() : {};

  const plan = d.plan || "free";
  planLabel = (plan === "free" || plan === "free-logged" || plan === "freelogged") ? "Free logged"
             : (plan === "premium300" ? "Premium 300"
             : (plan === "premium400" ? "Premium 400"
             : (plan === "premiumUnlimited" ? "Premium Unlimited" : "Premium")));

  // Fonte di verità dal backend (webhook)
  maxClicks = (typeof d.clicksPerTool === "number") ? d.clicksPerTool : (plan !== "free" ? 300 : 40);
  if (maxClicks > 1e8) maxClicks = 999999999; // "illimitato"

  // Contatore totale condiviso da tutti i tool: clicks_total/{uid} -> { "YYYY-MM": number }
  const clicksRef = doc(db, "clicks_total", user.uid);
  const cSnap = await getDoc(clicksRef);
  if (!cSnap.exists()) {
    // crea doc con mese corrente a 0
    await setDoc(clicksRef, { [m]: 0 }, { merge: true });
    monthlyClicks = 0;
  } else {
    monthlyClicks = cSnap.data()?.[m] ?? 0;
  }

  return { db, auth, user, planLabel, maxClicks, monthlyClicks, monthKey: m };
}

/**
 * Incrementa il contatore globale. Ritorna il nuovo valore per aggiornare subito la UI.
 */
export async function incrementUsage({ db, user, monthKey, monthlyClicks }) {
  if (!user) {
    // ANONIMO
    const curM = localStorage.getItem(LS_MONTH);
    if (curM !== monthKey) {
      localStorage.setItem(LS_MONTH, monthKey);
      localStorage.setItem(LS_CLICKS, "0");
      monthlyClicks = 0;
    }
    monthlyClicks += 1;
    localStorage.setItem(LS_MONTH, monthKey);
    localStorage.setItem(LS_CLICKS, String(monthlyClicks));
    return monthlyClicks;
  }

  // LOGGATO → crea se manca e incrementa in modo idempotente
  const ref = doc(db, "clicks_total", user.uid);
  await setDoc(ref, { [monthKey]: increment(1) }, { merge: true });
  return monthlyClicks + 1;
}