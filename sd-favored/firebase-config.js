// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

// REPLACE THIS WITH YOUR ACTUAL CONFIG FROM FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyCq3RPAsO3n7UBDAyh0rStQakWlrFnuM5M",
  authDomain: "favored-guided-engraving-dae18.firebaseapp.com",
  projectId: "favored-guided-engraving-dae18",
  storageBucket: "favored-guided-engraving-dae18.firebasestorage.app",
  messagingSenderId: "526466641024",
  appId: "1:526466641024:web:faff4dc79039a37c0f4a65",
  measurementId: "G-20P2Q6FV2E"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export for use in app.js
export { auth, db, storage };