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
  storageBucket: "stru-menti-staging.firebasestorage.app",
  messagingSenderId: "472772497669",
  appId: "1:472772497669:web:e90b6abde26f32e694a76c"
};

// Riconosce se sei su staging
const isStaging =
  location.hostname.startsWith("staging.") ||
  (location.hostname.includes("netlify.app") && location.hostname.includes("staging"));

const app = initializeApp(isStaging ? stagingConfig : prodConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { app, auth, db, isStaging };