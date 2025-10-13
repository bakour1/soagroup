// assets/js/firebase-init.js
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
  signInAnonymously,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBM3gTilif9M4CYPQJ_l9qusvweT2uWKsE",
  authDomain: "soa-group-df829.firebaseapp.com",
  projectId: "soa-group-df829",
  storageBucket: "soa-group-df829.appspot.com",
  messagingSenderId: "843665578533",
  appId: "1:843665578533:web:695f984e495fa6ce713dcc",
  measurementId: "G-BGQQCZ2BET",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- اختيار طريقة الدخول ---
// 1) تطوير: دخول مجهول (يحتاج قواعد تسمح بكتابة المستخدم المصادق فقط أو بشرط الوقت)
const USE_ANON = true;

// 2) إنتاج: بريد/كلمة مرور لمشرفين محددين (طابق الإيميل داخل rules)
const ADMIN_EMAIL = ""; // مثال: "bakour512@gmail.com"
const ADMIN_PASS = ""; // ضعها من .env/سرّي، لا تضعها مكشوفة علنًا

async function ensureSignIn() {
  if (USE_ANON) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.warn("Anon sign-in failed", e);
    }
  } else if (ADMIN_EMAIL && ADMIN_PASS) {
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASS);
    } catch (e) {
      console.error("Email/Password sign-in failed", e);
    }
  }
}

onAuthStateChanged(auth, (user) => {
  // بعد التأكد من حالة الدخول، أعلن جاهزية Firebase
  if (!window.FB_READY) {
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
    window.FB_READY = true;
    window.dispatchEvent(new Event("fb-ready"));
  }
});

// ابدأ الدخول
ensureSignIn();

// نصيحة: أضف نطاقاتك المصرح بها في Firebase Auth → Settings → Authorized domains
// - 127.0.0.1 و localhost
// - bakour1.github.io
