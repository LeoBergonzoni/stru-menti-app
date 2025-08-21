// usageHelper.js — contatore unico mensile per tutti i tool

import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

export const MONTH_KEY = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;        // es. 2025-08
};

// 🔢 chiavi condivise (contatore unico anche per anonimi)
const LS_MONTH = "anonMonth_global";
const LS_CLICKS = "anonClicks_global";

export async function loadUsage(app) {
  const auth = getAuth(app);
  const db = getFirestore(app);
  const user = auth.currentUser;

  // default: anonimo
  let planLabel = "Anonimo";
  let maxClicks = 5;
  let monthlyClicks = 0;

  // anonimo: contatore globale in localStorage
  if (!user) {
    const m = MONTH_KEY();
    const curM = localStorage.getItem(LS_MONTH);
    const curC = localStorage.getItem(LS_CLICKS);
    monthlyClicks = (curM === m) ? parseInt(curC || "0", 10) : 0;
    return { db, auth, user: null, planLabel, maxClicks, monthlyClicks, monthKey: m };
  }

  // loggato: leggi piano e limite dal doc utente
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const d = snap.exists() ? snap.data() : {};
  const plan = d.plan || "free";
  planLabel = (plan !== "free") ? plan : "Free logged";

  // 🔧 questa è la fonte di verità
  maxClicks = (typeof d.clicksPerTool === "number") ? d.clicksPerTool : (plan !== "free" ? 300 : 40);
  if (maxClicks > 1e8) maxClicks = 999999999; // 'illimitato'

  // contatore totale condiviso da tutti i tool:
  // clicks_total/{uid} -> { "YYYY-MM": number }
  const m = MONTH_KEY();
  const clicksRef = doc(db, "clicks_total", user.uid);
  const cSnap = await getDoc(clicksRef);
  if (!cSnap.exists()) {
    await setDoc(clicksRef, { [m]: 0 });
    monthlyClicks = 0;
  } else {
    monthlyClicks = cSnap.data()?.[m] ?? 0;
  }

  return { db, auth, user, planLabel, maxClicks, monthlyClicks, monthKey: m };
}

export async function incrementUsage({ db, user, monthKey, monthlyClicks }) {
  // ritorna il nuovo valore per aggiornare la UI subito
  if (!user) {
    // anonimo globale
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
  // loggato → incrementa clicks_total/{uid}[YYYY-MM]
  const ref = doc(db, "clicks_total", user.uid);
  await updateDoc(ref, { [monthKey]: increment(1) });
  return monthlyClicks + 1;
}