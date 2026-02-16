import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    GoogleAuthProvider, FacebookAuthProvider, signInWithPopup 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, getDocs, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Basic Modal & Nav logic
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

// Social Sign-In Helper
async function saveSocialUser(user) {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
        await setDoc(userRef, { name: user.displayName, email: user.email, role: "customer" });
    }
}

window.signInWithGoogle = async () => {
    try {
        const res = await signInWithPopup(auth, new GoogleAuthProvider());
        await saveSocialUser(res.user);
        window.location.href = "/user";
    } catch (e) { alert(e.message); }
};

window.signInWithFacebook = async () => {
    try {
        const res = await signInWithPopup(auth, new FacebookAuthProvider());
        await saveSocialUser(res.user);
        window.location.href = "/user";
    } catch (e) { alert(e.message); }
};

window.signupUser = async () => {
    const pass = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (pass !== confirm) return alert("Passwords do not match!");
    // Firebase create user logic...
};

// Product Loader
async function renderProducts() {
    const container = document.getElementById('products-container');
    if(!container) return;
    const snapshot = await getDocs(collection(db, "products"));
    container.innerHTML = "";
    snapshot.forEach(docSnap => { // Fixed 'doc' naming conflict [cite: 18, 42]
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
document.addEventListener("DOMContentLoaded", renderProducts);
