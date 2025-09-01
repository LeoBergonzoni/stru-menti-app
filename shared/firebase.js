// shared/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// --- Config PRODUCTION ---
const prodConfig = {
  apiKey: "AIzaSyCRLUzNFa7GPLKzLYD440lNLONeUZGe-gI",
  authDomain: "stru-menti.firebaseapp.com",
  projectId: "stru-menti",
  storageBucket: "stru-menti.appspot.com",
  messagingSenderId: "851395234512",
  appId: "1:851395234512:web:9b2d36080c23ba4a2cecd5"
};

// --- Config STAGING ---
const stagingConfig = {
  apiKey: "AIzaSyDsKioDHP2Be_sM5x261ak_LrxFZqNn5is",
  authDomain: "stru-menti-staging.firebaseapp.com",
  projectId: "stru-menti-staging",
  storageBucket: "stru-menti-staging.firebasestorage.app", // ok come da tua console
  messagingSenderId: "472772497669",
  appId: "1:472772497669:web:e90b6abde26f32e694a76c"
};

// === Rilevamento ambiente STAGING/PROD ===
const host = location.hostname;

// override manuale: ?env=staging|prod
const qenv = new URLSearchParams(location.search).get("env");
if (qenv) localStorage.setItem("FORCE_ENV", qenv);
const forced = (localStorage.getItem("FORCE_ENV") || "").toLowerCase();

const WHITELIST_STAGING = new Set([
  "stru-menti-staging.netlify.app",
  "staging.stru-menti.com",
]);

const WHITELIST_PROD = new Set([
  "stru-menti.com",
  "www.stru-menti.com",
]);

const isNetlifyBranchLike =
  host.endsWith(".netlify.app") && (host.includes("--") || host.startsWith("deploy-preview-"));

const isStagingAuto =
  WHITELIST_STAGING.has(host) ||
  (!WHITELIST_PROD.has(host) && isNetlifyBranchLike);

const isStaging =
  forced === "staging" ? true :
  forced === "prod"    ? false :
  isStagingAuto;

// Log diagnostici
console.log("[ENV] host:", host);
console.log("[ENV] forced:", forced || "(none)");
console.log("[ENV] auto:", isStagingAuto ? "STAGING" : "PROD");
console.log("[ENV] final:", isStaging ? "STAGING" : "PROD");
console.log("[ENV] project:", (isStaging ? stagingConfig : prodConfig).projectId);

// Init
const app = initializeApp(isStaging ? stagingConfig : prodConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { app, auth, db, isStaging };