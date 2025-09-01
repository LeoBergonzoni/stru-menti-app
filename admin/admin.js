// admin/admin.js
import { auth, db } from "/shared/firebase.js";
import {
  onAuthStateChanged, signOut, getIdTokenResult
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  collection, getDocs, doc, getDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// UI refs
const $ = (s)=>document.querySelector(s);
const rows = $("#rows");
const monthInput = $("#month");
const searchInput = $("#search");
const statusEl = $("#status");
const who = $("#who");

// Helpers
const monthKey = (d)=> `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
if (!monthInput.value) monthInput.value = monthKey(new Date());

// ───────────────── AUTH GUARD (solo admin) ─────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    statusEl.textContent = "Non autenticato. Reindirizzo al login…";
    location.href = "/login.html?next=/admin/";
    return;
  }
  who.textContent = user.email;

  // 1) Custom claim 'admin'
  const token = await getIdTokenResult(user).catch(()=>null);
  const hasClaim = !!(token && token.claims && token.claims.admin === true);

  // 2) Fallback: doc /admins/{uid} con {isAdmin:true}
  let hasDoc = false;
  if (!hasClaim) {
    const aRef = doc(db, "admins", user.uid);
    const aSnap = await getDoc(aRef);
    hasDoc = aSnap.exists() && aSnap.data().isAdmin === true;
  }

  if (!(hasClaim || hasDoc)) {
    statusEl.textContent = "Accesso negato: non sei admin.";
    who.className = "pill bad";
    return;
  }
  who.className = "pill ok";
  statusEl.textContent = "OK admin";

  await loadTable();
});

// ───────────────── LOAD DATA ─────────────────
async function loadTable() {
  statusEl.textContent = "Carico dati…";
  rows.innerHTML = "";

  const m = monthInput.value.trim(); // es: "2025-09"

  // users
  const usersSnap = await getDocs(collection(db, "users"));
  const users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

  // funzione che legge clicks_total/{uid}
  async function getClicks(uid) {
    const ref = doc(db, "clicks_total", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { month: 0, lifetime: 0 };

    const data = snap.data() || {};
    // mese corrente
    const month = Number(data[m] || 0);
    // lifetime = somma di tutti i campi numerici
    let lifetime = 0;
    for (const v of Object.values(data)) {
      if (typeof v === "number" && Number.isFinite(v)) lifetime += v;
    }
    return { month, lifetime };
  }

  // Build rows
  const q = (searchInput.value||"").toLowerCase();
  let tMonth = 0, tLife = 0;

  for (const u of users) {
    const hay = [u.name, u.email, u.uid].filter(Boolean).join(" ").toLowerCase();
    if (!hay.includes(q)) continue;

    const { month, lifetime } = await getClicks(u.uid);

    tMonth += month;
    tLife  += lifetime;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(u.name || "")}</td>
      <td>${escapeHtml(u.email || "")}</td>
      <td class="muted" style="font-size:12px">${u.uid}</td>
      <td>${escapeHtml(u.plan || u.tier || "-")}</td>
      <td class="tot">${month}</td>
      <td>${lifetime}</td>
      <td>${m}</td>
    `;
    rows.appendChild(tr);
  }

  // Totali
  $("#tMonth").textContent = tMonth;
  $("#tLife").textContent  = tLife;

  statusEl.textContent = "Pronto";
}

// ───────────────── Events ─────────────────
monthInput.addEventListener("change", loadTable);
searchInput.addEventListener("input", () => {
  clearTimeout(window.__t);
  window.__t = setTimeout(loadTable, 200);
});
$("#exportCsv").addEventListener("click", exportCSV);
$("#logoutBtn").addEventListener("click", ()=> signOut(auth));

// ───────────────── CSV ─────────────────
function exportCSV() {
  const headers = ["Nome","Email","UID","Piano","Click mese","Click totali","Mese"];
  const rowsArr = [headers];

  [...rows.querySelectorAll("tr")].forEach(tr=>{
    const cells = [...tr.children].map(td=> td.textContent.trim());
    rowsArr.push(cells);
  });

  const csv = rowsArr.map(r=> r.map(s=> `"${(s||"").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report_${$("#month").value}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ───────────────── Utils ─────────────────
function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, m=> (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}