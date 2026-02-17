// --- FIREBASE IMPORTS ---
import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    getAuth,
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

// --- SOCIAL LOGIN LOGIC ---

// Google Login
window.loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Check if user exists in Firestore, if not, create them
        await syncUserToFirestore(user);
        
        window.location.href = "user.html"; 
    } catch (error) {
        alert("Google Login Failed: " + error.message);
    }
};

// Facebook Login
window.loginWithFacebook = async () => {
    const provider = new FacebookAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        await syncUserToFirestore(user);
        
        window.location.href = "user.html";
    } catch (error) {
        alert("Facebook Login Failed: " + error.message);
    }
};

// Helper to ensure social users have a profile in your 'users' collection
async function syncUserToFirestore(user) {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
        await setDoc(userRef, {
            name: user.displayName,
            email: user.email,
            phone: user.phoneNumber || "Not Set",
            createdAt: new Date()
        });
    }
}

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

// --- SOCIAL AUTHENTICATION ---

window.signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await saveSocialUser(result.user);
        window.location.href = "/user"; // [cite: 12]
    } catch (error) { alert(error.message); }
};

window.signInWithFacebook = async () => {
    const provider = new FacebookAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        await saveSocialUser(result.user);
        window.location.href = "/user";
    } catch (error) { alert(error.message); }
};

async function saveSocialUser(user) {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
        await setDoc(userRef, { 
            name: user.displayName, 
            email: user.email, 
            role: "customer",
            createdAt: new Date().toISOString() 
        }); // [cite: 16, 17]
    }
}

// --- EMAIL AUTHENTICATION ---

window.loginUser = async () => {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.location.href = (email === "admin@favored.com") ? "/admin" : "/user"; // [cite: 14]
    } catch (error) { alert(error.message); }
};

window.signupUser = async () => {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('confirmPassword').value; // Dual Password confirmation

    if (pass !== confirm) {
        return alert("Passwords do not match!");
    }

    try {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", result.user.uid), {
            name: name,
            email: email,
            role: "customer"
        });
        window.location.href = "/user";
    } catch (error) { alert(error.message); }
};

// --- PRODUCT RENDERING ---

async function renderProducts() {
    const container = document.getElementById('products-container');
    if(!container) return;
    
    container.innerHTML = '<p style="text-align:center; width:100%;">Loading Collection...</p>';
    
    try {
        const snapshot = await getDocs(collection(db, "products"));
        container.innerHTML = ""; 
        
        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center; width:100%;">No products found.</p>';
            return;
        }

        snapshot.forEach((docSnap) => { 
            const p = docSnap.data();
            const id = docSnap.id;
            
            container.innerHTML += `
                <div class="product-card">
                    <button class="wishlist-btn" onclick="handleGuestWishlist()">
                        <i class="fas fa-heart"></i>
                    </button>

                    <img src="${p.imageUrl}" alt="${p.name}">
                    <h3>${p.name}</h3>
                    <p class="price">₱${p.price}</p>
                    <button class="btn-primary" onclick="openModal('authModal')">View Details</button>
                </div>`; 
        });
    } catch (error) {
        console.error("Error loading products:", error);
        container.innerHTML = '<p style="text-align:center;">Unable to load products.</p>';
    }
}

// Helper function to prompt login when guest clicks heart
window.handleGuestWishlist = () => {
    alert("Please log in to save items to your wishlist!");
    window.openModal('authModal');
};

// --- CHAT LOGIC ---

window.toggleChat = () => {
    const body = document.getElementById('chat-body');
    const icon = document.getElementById('chat-icon');
    if (body.style.display === 'none') {
        body.style.display = 'flex';
        icon.className = 'fas fa-chevron-down'; // [cite: 50]
    } else {
        body.style.display = 'none';
        icon.className = 'fas fa-chevron-up'; // [cite: 51]
    }
};

window.sendMessage = async () => {
    const input = document.getElementById('chatInput');
    if (!input.value.trim() || !currentUser) return;

    await addDoc(collection(db, "chats"), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        text: input.value,
        sender: "user",
        timestamp: new Date()
    }); // [cite: 55]
    input.value = "";
};

document.addEventListener("DOMContentLoaded", renderProducts);




