import { auth, db } from "./firebase-config.js";
import { 
    onAuthStateChanged, signOut, updatePassword 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    collection, getDocs, doc, getDoc, updateDoc, query, where, addDoc, orderBy, onSnapshot, setDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let userWishlist = new Set();
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

async function loadUserOrders(uid) {
    const container = document.getElementById('order-container');
    if(!container) return;

    // 1. Listen for Order Updates
    const q = query(collection(db, "orders"), where("userId", "==", uid));

    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = "<p style='text-align:center; padding:20px;'>No orders yet.</p>";
            return;
        }

        container.innerHTML = "";
        
        // Sort in memory (fixes the Index Error you had before)
        const orders = [];
        snapshot.forEach(doc => orders.push({id: doc.id, ...doc.data()}));
        orders.sort((a,b) => new Date(b.date) - new Date(a.date));

        orders.forEach(o => {
            // 2. Generate the Tracker HTML
            const trackerHTML = getTrackerHTML(o.status);

            container.innerHTML += `
                <div class="product-card" style="margin-bottom:20px; padding:20px; border:1px solid #eee;">
                    <div style="display:flex; gap:15px; align-items:center; margin-bottom:15px;">
                        <img src="${o.imageUrl}" style="width:70px; height:70px; object-fit:cover; border-radius:10px;">
                        <div>
                            <h4 style="margin:0;">${o.productName}</h4>
                            <p style="margin:5px 0; font-size:13px; color:#888;">
                                Total: ₱${o.totalPrice} <br> Qty: ${o.quantity}
                            </p>
                        </div>
                    </div>

                    ${trackerHTML}
                </div>
            `;
        });
    });
}

// --- HELPER: Generates the Step Tracker HTML ---
function getTrackerHTML(status) {
    // If rejected, show a simple red badge instead of the tracker
    if (status === 'Rejected') {
        return `<div style="background:#fdedec; color:#e74c3c; padding:10px; border-radius:8px; text-align:center; font-weight:bold;">
                    Order Rejected
                </div>`;
    }

    // Define the stages
    const stages = ["Pending", "Preparing", "Ready", "Completed"];
    
    // Find which step we are on (0, 1, 2, or 3)
    // Note: 'Accepted' counts as step 0 (Pending/Placed)
    let currentStepIndex = stages.indexOf(status);
    if (status === 'Accepted') currentStepIndex = 0; 
    if (currentStepIndex === -1) currentStepIndex = 0; // Default to start

    // Calculate width of the colored line (0%, 33%, 66%, 100%)
    const progressWidth = (currentStepIndex / (stages.length - 1)) * 100;

    // Generate the circles
    let stepsHTML = '';
    stages.forEach((stage, index) => {
        const isActive = index <= currentStepIndex ? 'active' : '';
        const icon = index < currentStepIndex ? '✓' : (index + 1); // Checkmark for past steps
        
        // Rename 'Pending' to 'Placed' for better UI text
        let label = stage === 'Pending' ? 'Placed' : stage;
        if(label === 'Ready') label = 'Pick Up';

        stepsHTML += `
            <div class="step-item ${isActive}">
                <div class="step-circle">${icon}</div>
                <div class="step-text">${label}</div>
            </div>
        `;
    });

    return `
        <div class="tracker-container">
            <div class="steps">
                <div class="progress-line" style="width: ${progressWidth}%"></div>
                ${stepsHTML}
            </div>
        </div>
    `;
}
// --- PRODUCT CATALOG (FIXED FOR BASE64 IMAGES) ---
async function loadProducts() {
    const container = document.getElementById('products-container');
    if(!container) return;

    // Load user's wishlist if logged in
    if(currentUser) {
        const wishSnap = await getDocs(collection(db, "users", currentUser.uid, "wishlist"));
        userWishlist = new Set(wishSnap.docs.map(doc => doc.id));
    }

    const snapshot = await getDocs(collection(db, "products"));
    container.innerHTML = "";
    
    snapshot.forEach((docSnap) => {
        const p = docSnap.data();
        const id = docSnap.id;
        
        // Check if this product is in the wishlist
        const isLiked = userWishlist.has(id) ? 'active' : '';

        // Store data globally
        window.productsData[id] = { id: id, ...p };

        container.innerHTML += `
            <div class="product-card">
                <button class="wishlist-btn ${isLiked}" onclick="toggleWishlist('${id}', this)">
                    <i class="fas fa-heart"></i>
                </button>

                <img src="${p.imageUrl}" onclick="openProductDetail('${id}')" style="cursor:pointer;">
                
                <h3>${p.name}</h3>
                <p class="price">₱${p.price}</p>
                <button class="btn-primary" onclick="openProductDetail('${id}')">View Details</button>
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

// --- WISHLIST TOGGLE ---
window.toggleWishlist = async (productId, btnElement) => {
    // 1. Check Login
    if (!currentUser) {
        alert("Please log in to save items to your wishlist!");
        return;
    }

    // 2. Toggle the Visuals immediately (for speed)
    const isActive = btnElement.classList.contains('active');
    
    if (isActive) {
        // REMOVE from Wishlist
        btnElement.classList.remove('active');
        try {
            await deleteDoc(doc(db, "users", currentUser.uid, "wishlist", productId));
            userWishlist.delete(productId);
        } catch(e) { 
            console.error(e); 
            btnElement.classList.add('active'); // Revert if error
        }
    } else {
        // ADD to Wishlist
        btnElement.classList.add('active');
        try {
            // We save the ID and the Name so we can display a list later if needed
            const product = window.productsData[productId];
            await setDoc(doc(db, "users", currentUser.uid, "wishlist", productId), {
                name: product.name,
                price: product.price,
                imageUrl: product.imageUrl,
                addedAt: new Date()
            });
            userWishlist.add(productId);
        } catch(e) { 
            console.error(e); 
            btnElement.classList.remove('active'); // Revert if error
        }
    }
};

window.closeModal = (id) => document.getElementById(id).style.display = 'none';




