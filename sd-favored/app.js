// --- FIREBASE IMPORTS ---
import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    collection, addDoc, getDocs, doc, setDoc, query, where 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

import { 
    GoogleAuthProvider, 
    FacebookAuthProvider, 
    signInWithPopup 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- GLOBAL VARIABLES ---
let currentUser = null; 
let currentProduct = null; // Stores data for the product being viewed

// ==========================================
// 1. AUTHENTICATION MONITORS
// ==========================================

onAuthStateChanged(auth, async (user) => {
    const guestBtns = document.getElementById("guest-buttons");
    const userBtns = document.getElementById("user-buttons");

    if (user) {
        currentUser = user;
        console.log("User logged in:", user.email);
        
        // Show User Buttons
        if(guestBtns) guestBtns.style.display = "none";
        if(userBtns) userBtns.style.display = "flex"; 


        if(user.email === "admin@favored.com") {
    
             const nav = document.querySelector('.nav-right');
             if(nav && !document.getElementById('adminLink')) {
                 const adminBtn = document.createElement('a');
                 adminBtn.id = 'adminLink';
                 adminBtn.href = 'admin.html';
                 adminBtn.className = 'btn-outline';
                 adminBtn.innerText = 'Admin Panel';
                 adminBtn.style.marginRight = '10px';
                 nav.prepend(adminBtn);
             }
        }

    } else {
        currentUser = null;
        if(guestBtns) guestBtns.style.display = "flex";
        if(userBtns) userBtns.style.display = "none";
    }
});

// Run on load
document.addEventListener("DOMContentLoaded", () => {
    // Load products if the container exists
    if(document.getElementById('products-container')) {
        renderProducts();
    }
    // Set default view
    window.showSection('hero');
});

// --- Google Sign In ---
window.signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await saveSocialUserToFirestore(result.user);
        window.location.href = "user.html";
    } catch (error) {
        alert("Google Sign-In Error: " + error.message);
    }
};

// --- Facebook Sign In ---
window.signInWithFacebook = async () => {
    const provider = new FacebookAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await saveSocialUserToFirestore(result.user);
        window.location.href = "user.html";
    } catch (error) {
        alert("Facebook Sign-In Error: " + error.message);
    }
};

// --- Helper to save social user to Firestore if they are new ---
async function saveSocialUserToFirestore(user) {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        await setDoc(userRef, {
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            createdAt: new Date(),
            role: "customer"
        });
    }
}

// ==========================================
// 2. EXPORT FUNCTIONS TO WINDOW (Fixes your issue)
// ==========================================

// --- NAVIGATION ---
window.showSection = (id) => {
    // Hide all sections
    document.getElementById('hero').style.display = 'none';
    document.getElementById('products').style.display = 'none';
    document.getElementById('about').style.display = 'none';
    
    // Show selected
    const selected = document.getElementById(id);
    if (selected) selected.style.display = 'block';

    // Update styling for nav links
    document.querySelectorAll('.nav-center a').forEach(a => a.classList.remove('active'));
    // (Optional: add active class logic here if needed)
}

// --- MODALS ---
window.openModal = (id) => {
    document.getElementById(id).style.display = 'flex';
}

window.closeModal = (id) => {
    document.getElementById(id).style.display = 'none';
}

window.toggleAuth = (type) => {
    if(type === 'signup') {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('signupSection').style.display = 'block';
    } else {
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('signupSection').style.display = 'none';
    }
}

// --- AUTHENTICATION ACTIONS ---
window.loginUser = async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.closeModal('authModal');
        alert("Logged in successfully!");
    } catch (error) {
        alert("Login failed: " + error.message);
    }
}

window.signupUser = async () => {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;
    const pass = document.getElementById('signupPassword').value;

    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        
        // Save Name and Phone to Firestore
        await setDoc(doc(db, "users", cred.user.uid), {
            uid: cred.user.uid,
            name: name,
            email: email,
            phone: phone,
            role: "customer"
        });

        window.closeModal('authModal');
        alert("Account created! Welcome, " + name);
    } catch (error) {
        alert("Signup failed: " + error.message);
    }
}

window.logout = async () => {
    await signOut(auth);
    alert("Logged out.");
    window.location.reload();
}

// --- PRODUCTS ---
async function renderProducts() {
    const container = document.getElementById('products-container');
    container.innerHTML = "Loading...";

    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        container.innerHTML = ""; // Clear loading text

        querySnapshot.forEach((doc) => {
            const p = doc.data();
            // Create a safe object to pass to the button
            const safeProduct = encodeURIComponent(JSON.stringify({id: doc.id, ...p}));
            
            container.innerHTML += `
                <div class="product-card" style="background:#fff; padding:15px; border:1px solid #ddd; border-radius:8px; text-align:center;">
                    <img src="${p.imageUrl || 'https://via.placeholder.com/150'}" style="width:100%; height:200px; object-fit:cover;">
                    <h3>${p.name}</h3>
                    <p>₱${p.price}</p>
                    <button class="btn-primary" onclick="openProductDetail('${safeProduct}')">View Details</button>
                </div>
            `;
        });
    } catch (error) {
        console.error(error);
        container.innerHTML = "Error loading products.";
    }
}

window.openProductDetail = (encodedProduct) => {
    currentProduct = JSON.parse(decodeURIComponent(encodedProduct));
    
    document.getElementById('detailName').innerText = currentProduct.name;
    document.getElementById('detailDesc').innerText = currentProduct.desc || currentProduct.description || "No description";
    document.getElementById('detailPrice').innerText = "₱" + currentProduct.price;
    document.getElementById('detailImg').src = currentProduct.imageUrl;
    
    window.openModal('productDetailsModal');
}

// --- ORDERING ---
window.placeOrder = async () => {
    if (!currentUser) {
        alert("Please log in to place an order.");
        return;
    }

    const qty = document.getElementById('orderQty').value;
    const total = currentProduct.price * qty;
    // GRAB THE ENGRAVING TEXT
    const engraving = document.getElementById('engravingText').value;

    try {
        await addDoc(collection(db, "orders"), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            productName: currentProduct.name,
            productId: currentProduct.id,
            price: currentProduct.price,
            quantity: qty,
            totalPrice: total,
            personalization: engraving, // SAVE TO FIREBASE
            status: "Pending",
            date: new Date().toISOString()
        });
        
        alert("Order Placed Successfully!");
        closeModal('productDetailsModal');
        // Reset the text area
        document.getElementById('engravingText').value = ""; 
    } catch (error) {
        alert("Error: " + error.message);
    }
}

// --- CHAT ---
window.toggleChat = () => {
    const box = document.getElementById('chatBox');
    box.style.display = (box.style.display === 'none') ? 'flex' : 'none';
}

window.sendMessage = async () => {
    const input = document.getElementById('chatInput');
    const msg = input.value;
    if(!msg) return;

    if(!currentUser) return alert("Please log in to chat.");

    try {
        await addDoc(collection(db, "chats"), {
            text: msg,
            sender: currentUser.email,
            uid: currentUser.uid,
            timestamp: new Date()
        });
        
        // Add to UI immediately (or wait for Firestore listener)
        const chatArea = document.getElementById('chatMessages');
        chatArea.innerHTML += `<p style="text-align:right; margin:5px; background:#eee; padding:5px;">${msg}</p>`;
        input.value = "";
    } catch(e) {
        console.error(e);
    }
}