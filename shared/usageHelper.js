// shared/usageHelper.js
// Helper per leggere piano/limite e gestire i click mensili per tool

import {
    getFirestore, doc, getDoc, setDoc, runTransaction, serverTimestamp
  } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
  
  /**
   * Legge il piano dell'utente da Firestore.
   * @param {Firestore} db - istanza Firestore
   * @param {string} uid  - uid Firebase dell'utente
   * @returns {Promise<{plan:string, billing:string|null, clicksPerTool:number, status:string}>}
   */
  export async function getUserPlanAndLimit(db, uid) {
    const fallback = { plan: "free", billing: null, clicksPerTool: 40, status: "inactive" };
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return fallback;
      const d = snap.data();
      return {
        plan: d.plan || "free",
        billing: d.billing || null,
        clicksPerTool: typeof d.clicksPerTool === "number" ? d.clicksPerTool : 40,
        status: d.status || "active",
      };
    } catch (e) {
      console.error("[getUserPlanAndLimit] ", e);
      return fallback;
    }
  }
  
  /**
   * Restituisce la chiave "mese" corrente tipo 2025-08.
   */
  export function currentMonthKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  
  /**
   * Riferimento al documento di usage mensile per uno specifico tool.
   * Struttura proposta:
   * users/{uid}/usage/{YYYY-MM}/tools/{toolKey}
   */
  function usageDocRef(db, uid, monthKey, toolKey) {
    return doc(db, "users", uid, "usage", monthKey, "tools", toolKey);
  }
  
  /**
   * Legge il numero di click consumati per un tool nel mese corrente (utente loggato).
   * @returns {Promise<number>}
   */
  export async function getMonthlyUsage(db, uid, toolKey, monthKey = currentMonthKey()) {
    try {
      const ref = usageDocRef(db, uid, monthKey, toolKey);
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data().count || 0) : 0;
    } catch (e) {
      console.error("[getMonthlyUsage] ", e);
      return 0;
    }
  }
  
  /**
   * Prova a consumare 1 click (utente loggato) in modo atomico.
   * Se superi il limite, non incrementa e ritorna {ok:false, remaining:0}.
   * @returns {Promise<{ok:boolean, used:number, remaining:number}>}
   */
  export async function consumeClickIfAllowed(db, uid, toolKey, limit, monthKey = currentMonthKey()) {
    const ref = usageDocRef(db, uid, monthKey, toolKey);
  
    try {
      const result = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const prev = snap.exists() ? (snap.data().count || 0) : 0;
        if (prev >= limit) {
          return { ok: false, used: prev, remaining: 0 };
        }
        const next = prev + 1;
        if (snap.exists()) {
          tx.update(ref, { count: next, updatedAt: serverTimestamp() });
        } else {
          tx.set(ref, { count: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        }
        return { ok: true, used: next, remaining: Math.max(limit - next, 0) };
      });
  
      return result;
    } catch (e) {
      console.error("[consumeClickIfAllowed] ", e);
      // fallback ottimistico: non consumare
      return { ok: false, used: 0, remaining: 0 };
    }
  }
  
  /**
   * Gestione ANONIMI: usa localStorage per contatore mensile.
   * @returns { used:number, remaining:number, ok:boolean }
   */
  export function consumeAnonClickIfAllowed(toolKey, anonLimit = 5, date = new Date()) {
    const monthKey = currentMonthKey(date);
    const storageKey = `usage:${toolKey}:${monthKey}:anon`;
    const prev = parseInt(localStorage.getItem(storageKey) || "0", 10);
    if (prev >= anonLimit) {
      return { ok: false, used: prev, remaining: 0 };
    }
    const next = prev + 1;
    localStorage.setItem(storageKey, String(next));
    return { ok: true, used: next, remaining: Math.max(anonLimit - next, 0) };
  }