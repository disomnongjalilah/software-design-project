// --- FIREBASE IMPORTS ---
import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    GoogleAuthProvider, 
    FacebookAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    collection, addDoc, getDocs, doc, setDoc, getDoc, query, where 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let currentUser = null; 
let currentProduct = null; 

// --- AUTH MONITOR ---
onAuthStateChanged(auth, async (user) => {
    const guestBtns = document.getElementById("guest-buttons");
    const userBtns = document.getElementById("user-buttons");

    if (user) {
        currentUser = user;
        if(guestBtns) guestBtns.style.display = "none";
        if(userBtns) userBtns.style.display = "flex"; 
    } else {
        currentUser = null;
        if(guestBtns) guestBtns.style.display = "flex";
        if(userBtns) userBtns.style.display = "none";
    }
});

// --- EXPORT TO WINDOW (Fixes Click Issue) ---

window.showSection = (id) => {
    ['hero', 'products', 'about'].forEach(sec => {
        const el = document.getElementById(sec);
        if (el) el.style.display = (sec === id) ? 'block' : 'none';
    });
    // Remove active class from all links
    document.querySelectorAll('.nav-center a').forEach(a => a.classList.remove('active'));
};

window.openModal = (id) => {
    const el = document.getElementById(id);
    if(el) el.style.display = 'flex';
};

window.closeModal = (id) => {
    const el = document.getElementById(id);
    if(el) el.style.display = 'none';
};

window.toggleAuth = (type) => {
    document.getElementById('loginSection').style.display = (type === 'signup') ? 'none' : 'block';
    document.getElementById('signupSection').style.display = (type === 'signup') ? 'block' : 'none';
};

window.signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await saveSocialUser(result.user);
        window.location.href = "/user"; // Updated for Vercel Clean URLs
    } catch (error) { alert(error.message); }
};

window.loginUser = async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.location.href = "/user"; // Updated for Vercel Clean URLs
    } catch (error) { alert(error.message); }
};

async function saveSocialUser(user) {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
        await setDoc(userRef, { name: user.displayName, email: user.email, role: "customer" });
    }
}

// --- PRODUCT RENDERING ---
async function renderProducts() {
    const container = document.getElementById('products-container');
    if(!container) return;
    
    try {
        const snapshot = await getDocs(collection(db, "products"));
        container.innerHTML = "";
        
        // CHANGED: Use 'docSnap' to avoid conflict with 'doc' import
        snapshot.forEach((docSnap) => { 
            const p = docSnap.data();
            container.innerHTML += `
                <div class="product-card">
                    <img src="${p.imageUrl}">
                    <h3>${p.name}</h3>
                    <p class="price">₱${p.price}</p>
                    <button class="btn-primary" onclick="openModal('authModal')">Log in to Order</button>
                </div>`;
        });
    } catch (error) {
        console.error("Error loading products:", error);
    }
}

document.addEventListener("DOMContentLoaded", renderProducts);
