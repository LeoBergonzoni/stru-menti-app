import { auth } from "/shared/firebase.js";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { ensureUserDoc } from "/shared/ensureUserDoc.js";
import { db } from "/shared/firebase.js";

const signupForm = document.getElementById("signup-form");
const googleSignupBtn = document.getElementById("google-signup");
const provider = new GoogleAuthProvider();

function goHome(){ window.location.replace("index.html"); }
function setLoading(b){ signupForm?.querySelectorAll("button").forEach(x=>x.disabled=b); }

onAuthStateChanged(auth, (u)=>{ if(u) goHome(); });

// Email+password
signupForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const email = signupForm.email.value.trim();
  const pass  = signupForm.password.value;
  const pass2 = signupForm.confirmPassword.value;
  if(pass !== pass2){ alert("Le password non coincidono."); return; }

  setLoading(true);
  try{
    const { user } = await createUserWithEmailAndPassword(auth, email, pass);

    // 1) manda la mail — aspetta davvero che finisca
    await sendEmailVerification(user, { url: `${location.origin}/login.html` });

    // 2) messaggio all’utente
    alert("Ti abbiamo inviato l’email di verifica. Controlla anche in Spam/Promozioni.");

    // 3) piccolo respiro per evitare abort durante cleanup
    await new Promise(r=>setTimeout(r, 150));

    // 4) logout e redirect
    await signOut(auth);
    window.location.href = "login.html";
  }catch(err){
    console.error("Errore registrazione:", err?.code, err?.message, err);
    alert(`Errore: ${err?.code || ''} — ${err?.message || 'impossibile registrarsi'}`);
  }finally{
    setLoading(false);
  }
});

// Google
googleSignupBtn?.addEventListener("click", async ()=>{
  setLoading(true);
  try{
    const { user } = await signInWithPopup(auth, provider);
    await ensureUserDoc(auth, db);
    goHome();
  }catch(err){
    console.error("Errore con Google:", err?.code, err?.message, err);
    alert(`Errore: ${err?.code || ''} — ${err?.message || 'impossibile registrarsi con Google'}`);
  }finally{
    setLoading(false);
  }
});