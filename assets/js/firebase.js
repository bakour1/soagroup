/* assets/js/firebase.js (module) */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

/* إعدادات مشروعك */
const firebaseConfig = {
  apiKey: "AIzaSyBM3gTilif9M4CYPQJ_l9qusvweT2uWKsE",
  authDomain: "soa-group-df829.firebaseapp.com",
  projectId: "soa-group-df829",
  storageBucket: "soa-group-df829.firebasestorage.app",
  messagingSenderId: "843665578533",
  appId: "1:843665578533:web:695f984e495fa6ce713dcc",
  measurementId: "G-BGQQCZ2BET",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);

/* helper: نحول username إلى ايميل تركيبي ثابت */
function unameToEmail(u) {
  const slug = String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".") // مسافات → نقاط
    .replace(/[^a-z0-9._-]/g, ""); // مسموح a-z0-9._-
  if (!slug)
    throw new Error("اسم المستخدم غير صالح. استخدم أحرف إنجليزية/أرقام فقط.");
  return `${slug}@soa.local`;
}

async function roleOf(uid) {
  try {
    const s = await getDoc(doc(db, "users", uid));
    return (s.exists() && s.data().role) || "member";
  } catch (e) {
    return "member";
  }
}

/* Firestore API */
window.FB = {
  async saveDoc(path, data) {
    const ref = doc(db, ...path.split("/"));
    await setDoc(
      ref,
      { ...data, _updatedAt: serverTimestamp() },
      { merge: true }
    );
  },
  async loadDoc(path) {
    const ref = doc(db, ...path.split("/"));
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Document not found");
    const { _updatedAt, ...rest } = snap.data() || {};
    return rest;
  },
};

/* Auth API: تقبل username أو email */
window.AUTH = {
  async login(usernameOrEmail, password) {
    const isEmail = /@/.test(usernameOrEmail);
    const email = isEmail ? usernameOrEmail : unameToEmail(usernameOrEmail);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const role = await roleOf(cred.user.uid);
    return { user: cred.user, role };
  },
  logout() {
    return signOut(auth);
  },
  onReady(cb) {
    return onAuthStateChanged(auth, cb);
  },
  getCurrentUser() {
    return auth.currentUser;
  },
  getRole: roleOf,
};

/* ضبط data-role وإرسال fb-ready عند كل تغيّر */
onAuthStateChanged(auth, async (user) => {
  const role = user ? await roleOf(user.uid) : "guest";
  document.documentElement.setAttribute("data-role", role);
  window.FB_READY = true;
  window.dispatchEvent(new Event("fb-ready"));
});
