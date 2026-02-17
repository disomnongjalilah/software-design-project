import { auth, db } from "./firebase-config.js";
import { 
    onAuthStateChanged, signOut, updatePassword 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    collection, getDocs, doc, getDoc, updateDoc, query, where, addDoc, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let currentUser = null;
let currentProduct = null;
window.productsData = {}; // NEW: Stores product data to avoid passing huge strings

// --- AUTH MONITOR ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loadUserProfile(user.uid);
        loadUserOrders(user.uid);
        loadProducts();
    } else {
        window.location.href = "/"; // Redirect if not logged in
    }
});

// --- NAVIGATION ---
window.showSection = (id) => {
    ['hero', 'products', 'account', 'edit-details', 'change-password', 'order'].forEach(sec => {
        const el = document.getElementById(sec);
        if(el) el.style.display = 'none';
    });
    const target = document.getElementById(id);
    if(target) target.style.display = 'block';

    document.querySelectorAll('.nav-center a').forEach(a => a.classList.remove('active'));
    const navLink = document.getElementById('nav-' + id);
    if(navLink) navLink.classList.add('active');
};

window.logoutUser = async () => {
    await signOut(auth);
    window.location.href = "/";
};

// --- PROFILE MANAGEMENT ---
async function loadUserProfile(uid) {
    try {
        const docSnap = await getDoc(doc(db, "users", uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const name = data.name || "User";
            
            // Update UI
            if(document.getElementById('welcomeName')) document.getElementById('welcomeName').innerText = name;
            if(document.getElementById('userNameDisplay')) document.getElementById('userNameDisplay').innerText = name; 
            if(document.getElementById('accountFullname')) document.getElementById('accountFullname').innerText = name;
            if(document.getElementById('accountEmail')) document.getElementById('accountEmail').innerText = data.email || currentUser.email;
            if(document.getElementById('accountPhone')) document.getElementById('accountPhone').innerText = data.phone || "Not Set";

            // Pre-fill Edit Forms
            if(document.getElementById('editFullname')) document.getElementById('editFullname').value = name;
            if(document.getElementById('editPhone')) document.getElementById('editPhone').value = data.phone || "";
        }
    } catch (e) { console.error("Error loading profile:", e); }
}

const editForm = document.getElementById('editDetailsForm');
if(editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await updateDoc(doc(db, "users", currentUser.uid), {
                name: document.getElementById('editFullname').value,
                phone: document.getElementById('editPhone').value
            });
            alert("Profile Updated Successfully!");
            loadUserProfile(currentUser.uid);
            window.showSection('account');
        } catch(e) { alert("Error updating profile: " + e.message); }
    });
}

const passForm = document.getElementById('changePasswordForm');
if(passForm) {
    passForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPass = document.getElementById('newPassword').value;
        const confirm = document.getElementById('confirmNewPassword').value;

        if(newPass !== confirm) return alert("Passwords do not match");

        try {
            await updatePassword(currentUser, newPass);
            alert("Password Changed Successfully!");
            window.showSection('account');
            passForm.reset();
        } catch(e) { alert("Error: " + e.message); }
    });
}

// --- ORDER TRACKING (REAL-TIME) ---
async function loadUserOrders(uid) {
    const container = document.getElementById('userOrders'); // Matches your HTML ID
    if(!container) return;

    const q = query(collection(db, "orders"), where("userId", "==", uid), orderBy("date", "desc"));
    
    // Uses onSnapshot so orders appear instantly when you buy
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = "<p>No orders placed yet.</p>";
            return;
        }

        container.innerHTML = "";
        snapshot.forEach(docSnap => {
            const o = docSnap.data();
            // Status Color Logic
            let statusColor = '#c06b45'; // Default (Pending)
            if (o.status === 'Accepted') statusColor = '#27ae60';
            if (o.status === 'Rejected') statusColor = '#e74c3c';
            
            // Render Order Card
            container.innerHTML += `
                <div class="product-card" style="margin-bottom:15px; padding:15px; border:1px solid #eee; display:flex; gap:15px; align-items:center;">
                    <img src="${o.imageUrl}" style="width:80px; height:80px; object-fit:cover; border-radius:10px;">
                    <div style="flex:1; text-align:left;">
                        <h4 style="margin:0;">${o.productName}</h4>
                        <p style="margin:5px 0; font-size:13px; color:#888;">
                             Total: ₱${o.totalPrice} <br> Note: ${o.personalization || "None"}
                        </p>
                        <span style="font-size:12px; font-weight:700; color:${statusColor}">Status: ${o.status}</span>
                    </div>
                </div>
            `;
        });
    });
}

// --- PRODUCT CATALOG (FIXED FOR BASE64 IMAGES) ---
async function loadProducts() {
    const container = document.getElementById('products-container');
    if(!container) return;

    const snapshot = await getDocs(collection(db, "products"));
    container.innerHTML = "";
    
    snapshot.forEach((docSnap) => {
        const p = docSnap.data();
        
        // 1. Store data globally so we don't have to pass huge strings in HTML
        window.productsData[docSnap.id] = { id: docSnap.id, ...p };

        // 2. Pass ONLY the ID to the function
        container.innerHTML += `
            <div class="product-card">
                <img src="${p.imageUrl}">
                <h3>${p.name}</h3>
                <p class="price">₱${p.price}</p>
                <button class="btn-primary" onclick="openProductDetail('${docSnap.id}')">View Details</button>
            </div>
        `;
    });
}

// Open Modal using the ID to lookup data
window.openProductDetail = (id) => {
    currentProduct = window.productsData[id]; // Retrieve from global storage
    
    if(!currentProduct) return;

    document.getElementById('detailName').innerText = currentProduct.name;
    document.getElementById('detailDesc').innerText = currentProduct.description || "No description available.";
    document.getElementById('detailPrice').innerText = "₱" + currentProduct.price;
    document.getElementById('detailImg').src = currentProduct.imageUrl;
    
    // Reset inputs
    document.getElementById('orderQty').value = 1;
    document.getElementById('engravingText').value = "";
    
    document.getElementById('productDetailsModal').style.display = 'flex';
};

window.placeOrder = async () => {
    if(!currentProduct) return;

    const qty = document.getElementById('orderQty').value;
    const note = document.getElementById('engravingText').value;

    try {
        await addDoc(collection(db, "orders"), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            productName: currentProduct.name,
            productId: currentProduct.id,
            price: Number(currentProduct.price),
            quantity: Number(qty),
            totalPrice: Number(currentProduct.price) * Number(qty),
            personalization: note,
            imageUrl: currentProduct.imageUrl, // IMPORTANT: Save image for order history
            status: "Pending", 
            date: new Date().toISOString()
        });
        
        alert("Order Placed Successfully!");
        window.closeModal('productDetailsModal');
        window.showSection('order'); // Auto-redirect to My Orders page
    } catch(e) { 
        alert("Order failed: " + e.message); 
    }
};

// --- CHAT SYSTEM ---
window.toggleChat = () => {
    const body = document.getElementById('chat-body');
    const icon = document.getElementById('chat-icon');
    if (body.style.display === 'none') {
        body.style.display = 'flex';
        icon.className = 'fas fa-chevron-down';
        listenForMessages();
    } else {
        body.style.display = 'none';
        icon.className = 'fas fa-chevron-up';
    }
};

let chatListener = null; // Store listener to avoid duplicates
function listenForMessages() {
    if (!currentUser || chatListener) return;

    const q = query(collection(db, "chats"), where("userId", "==", currentUser.uid), orderBy("timestamp", "asc"));
    
    chatListener = onSnapshot(q, (snapshot) => {
        const container = document.getElementById('chat-messages');
        if(!container) return;

        container.innerHTML = "";
        snapshot.forEach(docSnap => {
            const m = docSnap.data();
            const side = m.sender === "user" ? "user" : "admin";
            container.innerHTML += `<div class="msg ${side}">${m.text}</div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

window.sendMessage = async () => {
    const input = document.getElementById('chatInput');
    if (!input.value.trim() || !currentUser) return;

    await addDoc(collection(db, "chats"), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        text: input.value,
        sender: "user",
        timestamp: new Date()
    });
    input.value = "";
};

window.closeModal = (id) => document.getElementById(id).style.display = 'none';
