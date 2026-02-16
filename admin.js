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
    const name = document.getElementById('addName').value;
    const price = document.getElementById('addPrice').value;
    const fileInput = document.getElementById('addImageFile');
    const file = fileInput ? fileInput.files[0] : null;

    if (!name || !price || !file) return alert("Please fill all fields and select an image.");

    const saveBtn = document.querySelector("#addProductModal .btn-primary");
    saveBtn.disabled = true;

    try {
        const storageRef = ref(storage, `products/${Date.now()}-${file.name}`);
        // Switched to resumable upload to show progress
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                saveBtn.innerText = `Uploading: ${Math.round(progress)}%`;
            }, 
            (error) => { alert("Upload failed: " + error.message); saveBtn.disabled = false; }, 
            async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                await addDoc(collection(db, "products"), {
                    name: name,
                    price: Number(price),
                    stock: 10,
                    imageUrl: url,
                    createdAt: new Date()
                });
                alert("Product Added Successfully!");
                saveBtn.innerText = "Save Product";
                saveBtn.disabled = false;
                
                // Reset inputs
                document.getElementById('addName').value = "";
                document.getElementById('addPrice').value = "";
                document.getElementById('addImageFile').value = "";
                window.closeModal('addProductModal');
            }
        );
    } catch(e) { alert("Error: " + e.message); saveBtn.disabled = false; }
};

window.deleteProduct = async (id) => {
    if(confirm("Are you sure?")) {
        await deleteDoc(doc(db, "products", id));
    }
};

// ==========================================
// 4. ORDERS MANAGEMENT (Accept/Reject Logic)
// ==========================================
function loadOrders() {
    const list = document.getElementById('adminOrdersList');
    if(!list) return;

    const q = query(collection(db, "orders"), orderBy("date", "desc"));
    
    onSnapshot(q, (snapshot) => {
        list.innerHTML = "";
        snapshot.forEach(d => {
            const o = d.data();
            const statusColor = o.status === 'Accepted' ? '#27ae60' : (o.status === 'Rejected' ? '#e74c3c' : '#c06b45');
            list.innerHTML += `
                <tr>
                    <td>${new Date(o.date).toLocaleDateString()}</td>
                    <td>${o.userEmail}</td>
                    <td>${o.productName}</td>
                    <td>₱${o.totalPrice}</td>
                    <td><span style="color:${statusColor}; font-weight:bold;">${o.status}</span></td>
                    <td>
                        <button class="btn-primary" style="padding: 5px 10px; font-size: 11px; background:#27ae60;" onclick="updateOrderStatus('${d.id}', 'Accepted')">Accept</button>
                        <button class="btn-outline" style="padding: 5px 10px; font-size: 11px; color:#e74c3c; border-color:#e74c3c;" onclick="updateOrderStatus('${d.id}', 'Rejected')">Reject</button>
                    </td>
                </tr>`;
        });
    });
}

window.updateOrderStatus = async (id, status) => {
    try {
        await updateDoc(doc(db, "orders", id), { status: status });
    } catch(e) { console.error(e); }
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
