// assets/js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

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
