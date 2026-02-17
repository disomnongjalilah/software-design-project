console.log("Admin.js Loaded Successfully");

// --- FIREBASE IMPORTS ---
import { auth, db, storage } from "./firebase-config.js";
import { 
    onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy, onSnapshot, where 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { 
    ref, uploadBytesResumable, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

let selectedUserId = null;

// ==========================================
// 1. AUTH MONITOR & PROTECTION
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user && user.email === "admin@favored.com") {
        console.log("Admin Authorized:", user.email);
        loadInventory();
        loadOrders();
    } else {
        console.warn("Unauthorized access attempt.");
        window.location.href = "/"; 
    }
});

// ==========================================
// 2. EXPORT FUNCTIONS TO WINDOW
// ==========================================
window.showAdminSection = (id) => {
    const sections = ['products', 'orders', 'admin-chat'];
    sections.forEach(sec => {
        const el = document.getElementById(sec);
        if(el) el.style.display = (sec === id) ? 'block' : 'none';
    });

    if(id === 'admin-chat') loadChatUsers();

    document.querySelectorAll('.nav-center a').forEach(a => a.classList.remove('active'));
    const activeLink = document.querySelector(`[onclick="showAdminSection('${id}')"]`);
    if(activeLink) activeLink.classList.add('active');
};

window.openModal = (id) => {
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'flex';
};

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'none';
};

window.logoutAdmin = async () => {
    try {
        await signOut(auth);
        window.location.href = "/";
    } catch (err) {
        alert("Logout failed: " + err.message);
    }
};

// ==========================================
// 3. PRODUCT & STOCK MANAGEMENT (Optimized Upload)
// ==========================================

async function loadInventory() {
    const container = document.getElementById('adminProducts');
    if(!container) return;
    
    onSnapshot(collection(db, "products"), (snapshot) => {
        container.innerHTML = "";
        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            const stockStatus = p.stock > 0 ? `${p.stock} in stock` : "Out of Stock";
            container.innerHTML += `
                <div class="product-card">
                    <img src="${p.imageUrl}" alt="${p.name}" style="width:100%; border-radius:15px;">
                    <h3>${p.name}</h3>
                    <p class="price">₱${p.price}</p>
                    <p style="font-size: 12px; color: ${p.stock > 0 ? 'green' : 'red'}">${stockStatus}</p>
                    <div style="display:flex; gap:5px; margin-top:10px;">
                        <button class="btn-outline" style="flex:1; padding:5px; font-size:11px;" onclick="updateStock('${docSnap.id}', ${p.stock + 1})">+</button>
                        <button class="btn-outline" style="flex:1; padding:5px; font-size:11px;" onclick="updateStock('${docSnap.id}', ${p.stock - 1})">-</button>
                    </div>
                    <button class="btn-outline" style="color:red; border-color:#ffcccc; width:100%; margin-top:10px;" onclick="deleteProduct('${docSnap.id}')">
                        Remove Item
                    </button>
                </div>`;
        });
    });
}

window.updateStock = async (id, newStock) => {
    if (newStock < 0) return;
    await updateDoc(doc(db, "products", id), { stock: newStock });
};

window.addProduct = async () => {
    console.log("Starting addProduct..."); // Check Console

    // STEP 1: Get Elements
    const nameEl = document.getElementById('addName');
    const priceEl = document.getElementById('addPrice');
    const fileInput = document.getElementById('addImageFile');

    if (!nameEl || !priceEl || !fileInput) {
        alert("Error: Could not find HTML elements. Check your IDs!");
        return;
    }

    const name = nameEl.value;
    const price = priceEl.value;
    const file = fileInput.files[0];

    // STEP 2: Check Values
    if (!name || !price) {
        alert("Please enter a name and price.");
        return;
    }
    if (!file) {
        alert("Please select an image file from your computer.");
        return;
    }

    const saveBtn = document.querySelector("#addProductModal .btn-primary");
    saveBtn.innerText = "Processing...";
    saveBtn.disabled = true;

    // STEP 3: Compress Image
    const compressImage = (imageFile) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(imageFile);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Resize to 500px width
                    const scaleSize = 500 / img.width;
                    canvas.width = 500;
                    canvas.height = img.height * scaleSize;

                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    // Compress to 0.5 (50% quality)
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
                    resolve(dataUrl);
                };
            };
            reader.onerror = (error) => reject(error);
        });
    };

    try {
        // STEP 4: Run Compression
        alert("Compressing image..."); // DEBUG ALERT
        const base64String = await compressImage(file);
        
        console.log("Image converted string length:", base64String.length);

        // STEP 5: Save to Firestore
        alert("Saving to database..."); // DEBUG ALERT
        
        await addDoc(collection(db, "products"), {
            name: name,
            price: Number(price),
            stock: 10,
            imageUrl: base64String,
            createdAt: new Date()
        });

        alert("SUCCESS! Product saved.");
        window.closeModal('addProductModal');
        
        // Clear form
        nameEl.value = "";
        priceEl.value = "";
        fileInput.value = "";

    } catch (e) {
        console.error("FULL ERROR:", e);
        alert("FAILED: " + e.message);
    } finally {
        saveBtn.innerText = "Save Product";
        saveBtn.disabled = false;
    }
};
window.deleteProduct = async (id) => {
    if(confirm("Are you sure?")) {
        await deleteDoc(doc(db, "products", id));
    }
};

// ==========================================
// 4. ORDERS MANAGEMENT (Accept/Reject Logic)
// ==========================================
// --- LOAD ORDERS FOR ADMIN ---
window.loadOrders = () => {
    const container = document.getElementById('admin-orders-container');
    if(!container) return;

    // Listen to real-time updates
    const q = query(collection(db, "orders"), orderBy("date", "desc"));
    
    onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = "<p>No active orders.</p>";
            return;
        }

        container.innerHTML = "";
        
        snapshot.forEach(docSnap => {
            const o = docSnap.data();
            const id = docSnap.id;

            // Generate the Dropdown Menu (Select)
            // It automatically selects the current status
            const statusOptions = `
                <select onchange="updateOrderStatus('${id}', this.value)" class="status-select ${o.status.toLowerCase()}">
                    <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="Preparing" ${o.status === 'Preparing' ? 'selected' : ''}>Preparing</option>
                    <option value="Ready" ${o.status === 'Ready' ? 'selected' : ''}>Ready for Pick Up</option>
                    <option value="Completed" ${o.status === 'Completed' ? 'selected' : ''}>Completed</option>
                    <option value="Rejected" ${o.status === 'Rejected' ? 'selected' : ''}>Reject Order</option>
                </select>
            `;

            container.innerHTML += `
                <div class="order-card-admin">
                    <div class="order-header">
                        <span class="order-id">#${id.slice(0,6)}</span>
                        <span class="order-date">${new Date(o.date).toLocaleDateString()}</span>
                    </div>
                    
                    <div class="order-body">
                        <img src="${o.imageUrl}" class="order-img">
                        <div class="order-info">
                            <h4>${o.productName}</h4>
                            <p>Customer: ${o.userEmail}</p>
                            <p class="price">Total: ₱${o.totalPrice}</p>
                            <p class="note">Note: ${o.personalization || "None"}</p>
                        </div>
                    </div>

                    <div class="order-actions">
                        <label>Update Status:</label>
                        ${statusOptions}
                    </div>
                </div>
            `;
        });
    });
};

// --- FUNCTION TO SAVE THE STATUS ---
window.updateOrderStatus = async (orderId, newStatus) => {
    try {
        const orderRef = doc(db, "orders", orderId);
        
        await updateDoc(orderRef, {
            status: newStatus
        });
        
        // Optional: Alert is annoying, so we use a console log or a toast instead
        console.log(`Order ${orderId} updated to ${newStatus}`);
        
    } catch (error) {
        alert("Error updating status: " + error.message);
    }
};

// ==========================================
// 5. CHAT SYSTEM
// ==========================================
function loadChatUsers() {
    const q = query(collection(db, "chats"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('adminChatUserList');
        if(!list) return;
        
        const users = {};
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!users[data.userId]) users[data.userId] = data.userEmail || "Guest User";
        });
        
        list.innerHTML = "";
        Object.keys(users).forEach(uid => {
            list.innerHTML += `
                <div class="user-tab ${selectedUserId === uid ? 'active' : ''}" onclick="selectUserChat('${uid}')">
                    <i class="fas fa-user-circle"></i> ${users[uid]}
                </div>`;
        });
    });
}

window.selectUserChat = (uid) => {
    selectedUserId = uid;
    document.querySelectorAll('.user-tab').forEach(tab => tab.classList.remove('active'));
    
    const q = query(collection(db, "chats"), where("userId", "==", uid), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('adminChatMessages');
        if(!container) return;
        
        container.innerHTML = "";
        snapshot.forEach(docSnap => {
            const m = docSnap.data();
            const side = m.sender === "admin" ? "admin" : "user";
            container.innerHTML += `<div class="msg ${side}">${m.text}</div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
};

window.sendAdminMessage = async () => {
    const input = document.getElementById('adminChatInput');
    if (!input || !input.value.trim() || !selectedUserId) return;

    try {
        await addDoc(collection(db, "chats"), {
            userId: selectedUserId,
            text: input.value,
            sender: "admin",
            timestamp: new Date()
        });
        input.value = "";
    } catch(e) { console.error(e); }
};



