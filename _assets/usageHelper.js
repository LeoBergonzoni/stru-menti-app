// /_assets/usageHelper.js — contatore unico mensile per tutti i tool

import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

export const MONTH_KEY = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
};

const LS_MONTH  = "anonMonth_global";
const LS_CLICKS = "anonClicks_global";

export async function loadUsage(app, userFromCaller = null) {
  const auth = getAuth(app);
  const db   = getFirestore(app);
  const user = userFromCaller ?? auth.currentUser;

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

  const m = MONTH_KEY();
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const d = snap.exists() ? snap.data() : {};

  const rawPlan = d.plan || "free";
  const plan = (rawPlan === "free-logged" || rawPlan === "freelogged") ? "free" : rawPlan;

  planLabel =
    plan === "free"             ? "Free logged" :
    plan === "premium300"       ? "Premium 300" :
    plan === "premium400"       ? "Premium 400" :
    plan === "premiumUnlimited" ? "Premium Unlimited" : "Premium";

  maxClicks = (typeof d.clicksPerTool === "number") ? d.clicksPerTool : (plan !== "free" ? 300 : 40);
  if (maxClicks > 1e8) maxClicks = 999999999;

  const clicksRef = doc(db, "clicks_total", user.uid);
  const cSnap = await getDoc(clicksRef);
  if (!cSnap.exists()) {
    await setDoc(clicksRef, { [m]: 0 }, { merge: true });
    monthlyClicks = 0;
  } else {
    monthlyClicks = cSnap.data()?.[m] ?? 0;
  }

  return { db, auth, user, planLabel, maxClicks, monthlyClicks, monthKey: m };
}

export async function incrementUsage({ db, user, monthKey, monthlyClicks }) {
  if (!user) {
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

  const ref = doc(db, "clicks_total", user.uid);
  await setDoc(ref, { [monthKey]: increment(1) }, { merge: true });  // crea se manca
  return monthlyClicks + 1;
}