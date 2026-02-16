import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    GoogleAuthProvider, FacebookAuthProvider, signInWithPopup 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, getDocs, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Basic Functions
window.showSection = (id) => {
    ['hero', 'products'].forEach(s => {
        const el = document.getElementById(s);
        if(el) el.style.display = (s === id) ? 'block' : 'none';
    });
};
window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = (id) => document.getElementById(id).style.display = 'none';
window.toggleAuth = (type) => {
    document.getElementById('loginSection').style.display = (type === 'signup' ? 'none' : 'block');
    document.getElementById('signupSection').style.display = (type === 'signup' ? 'block' : 'none');
};

// Social Sign-In (Saves data to Firestore)
async function saveSocialUser(user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, { name: user.displayName, email: user.email, role: "customer" });
    }
}

window.signInWithGoogle = async () => {
    try {
        const res = await signInWithPopup(auth, new GoogleAuthProvider());
        await saveSocialUser(res.user);
        window.location.href = "/user"; // Vercel Clean URL
    } catch (e) { alert(e.message); }
};

window.signInWithFacebook = async () => {
    try {
        const res = await signInWithPopup(auth, new FacebookAuthProvider());
        await saveSocialUser(res.user);
        window.location.href = "/user";
    } catch (e) { alert(e.message); }
};

// Signup with Dual Password Confirmation
window.signupUser = async () => {
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (pass !== confirm) return alert("Passwords do not match!");

    try {
        await createUserWithEmailAndPassword(auth, email, pass);
        window.location.href = "/user";
    } catch (e) { alert(e.message); }
};

// Login Logic
window.loginUser = async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.location.href = (email === "admin@favored.com") ? "/admin" : "/user";
    } catch (e) { alert(e.message); }
};

// Render Products (Fixed conflict by using docSnap)
async function renderProducts() {
    const container = document.getElementById('products-container');
    if(!container) return;
    const snapshot = await getDocs(collection(db, "products"));
    container.innerHTML = "";
    snapshot.forEach(docSnap => { // Fixed identifier conflict
        const p = docSnap.data();
        container.innerHTML += `
            <div class="product-card">
                <img src="${p.imageUrl}">
                <h3>${p.name}</h3>
                <p class="price">₱${p.price}</p>
                <button class="btn-primary" onclick="openModal('authModal')">View Details</button>
            </div>`;
    });
}

// Chat Box Toggle
window.toggleChat = () => {
    const body = document.getElementById('chat-body');
    const icon = document.getElementById('chat-icon');
    body.style.display = (body.style.display === 'none') ? 'flex' : 'none';
    icon.className = (body.style.display === 'none') ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
};

document.addEventListener("DOMContentLoaded", renderProducts);
