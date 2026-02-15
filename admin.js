import { auth, db, storage } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { 
    ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

let selectedUserId = null;

// Load unique users who messaged
async function loadChatUsers() {
    const q = query(collection(db, "chats"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('adminChatUserList');
        const users = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            if (!users[data.userId]) users[data.userId] = data.userEmail;
        });
        
        list.innerHTML = "";
        Object.keys(users).forEach(uid => {
            list.innerHTML += `<div class="user-tab ${selectedUserId === uid ? 'active' : ''}" onclick="selectUserChat('${uid}')">${users[uid]}</div>`;
        });
    });
}

window.selectUserChat = (uid) => {
    selectedUserId = uid;
    loadChatUsers(); // Refresh active state
    listenToConversation(uid);
};

function listenToConversation(uid) {
    const q = query(collection(db, "chats"), where("userId", "==", uid), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('adminChatMessages');
        container.innerHTML = "";
        snapshot.forEach(doc => {
            const m = doc.data();
            const side = m.sender === "admin" ? "admin" : "user";
            container.innerHTML += `<div class="msg ${side}">${m.text}</div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

window.sendAdminMessage = async () => {
    const input = document.getElementById('adminChatInput');
    if (!input.value.trim() || !selectedUserId) return;

    await addDoc(collection(db, "chats"), {
        userId: selectedUserId,
        text: input.value,
        sender: "admin",
        timestamp: new Date()
    });
    input.value = "";
};

// Add this to your admin sections switcher
window.showAdminSection = (id) => {
    ['products', 'orders', 'admin-chat'].forEach(sec => document.getElementById(sec).style.display = 'none');
    document.getElementById(id).style.display = 'block';
    if(id === 'admin-chat') loadChatUsers();
};

// ================= INITIALIZATION =================
onAuthStateChanged(auth, (user) => {
    if (user && user.email === "admin@favored.com") {
        console.log("Admin Verified:", user.email);
        loadInventory();
        loadOrders();
    } else {
        // If not admin, kick back to home
        window.location.href = "index.html"; 
    }
});

// ================= 1. GLOBAL UI FUNCTIONS (RESTORED) =================

window.openModal = (id) => {
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'flex';
};

window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'none';
};

window.showAdminSection = (id) => {
    // Sections
    const productsSec = document.getElementById('products');
    const ordersSec = document.getElementById('orders');
    
    if(productsSec) productsSec.style.display = 'none';
    if(ordersSec) ordersSec.style.display = 'none';
    
    const target = document.getElementById(id);
    if(target) target.style.display = 'block';
    
    // Update Active Nav Links
    document.querySelectorAll('.nav-center a').forEach(a => a.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
};

window.switchTab = (tabName) => {
    const activeTab = document.getElementById('tab-active');
    const completedTab = document.getElementById('tab-completed');
    
    if(activeTab) activeTab.style.display = 'none';
    if(completedTab) completedTab.style.display = 'none';
    
    const selected = document.getElementById('tab-' + tabName);
    if(selected) selected.style.display = 'block';
    
    // Toggle button active class
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
};

window.logoutAdmin = async () => {
    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (err) {
        alert("Logout failed: " + err.message);
    }
};

// ================= 2. PRODUCT MANAGEMENT (RESTORED) =================

window.loadInventory = async () => {
    const container = document.getElementById('adminProducts');
    if(!container) return;
    container.innerHTML = "<p>Loading Boutique Inventory...</p>";

    try {
        const snapshot = await getDocs(collection(db, "products"));
        container.innerHTML = "";

        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            container.innerHTML += `
                <div class="product-card">
                    <img src="${p.imageUrl}" alt="${p.name}">
                    <span class="category">${p.category}</span>
                    <h3>${p.name}</h3>
                    <p class="price">₱${p.price}</p>
                    <button class="btn-outline" style="color:red; border-color:#ffcccc;" onclick="deleteProduct('${docSnap.id}')">
                        Remove
                    </button>
                </div>
            `;
        });
    } catch(e) {
        console.error("Load Inventory Error:", e);
    }
};

window.addProduct = async () => {
    const name = document.getElementById('addName').value;
    const cat = document.getElementById('addCategory').value;
    const price = document.getElementById('addPrice').value;
    const desc = document.getElementById('addDesc').value;
    const fileInput = document.getElementById('addImageFile');
    const file = fileInput ? fileInput.files[0] : null;

    if (!name || !price || !file) {
        return alert("Please fill in Name, Price, and Image.");
    }

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = "Processing...";
    btn.disabled = true;

    try {
        // Upload
        const storageRef = ref(storage, `products/${Date.now()}-${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);

        // Firestore
        await addDoc(collection(db, "products"), {
            name: name,
            category: cat,
            price: Number(price),
            description: desc,
            imageUrl: url,
            createdAt: new Date()
        });

        alert("Product Added!");
        window.closeModal('addProductModal');
        document.getElementById('addName').value = ""; // Clear form
        loadInventory();
    } catch(e) {
        alert("Add Product Error: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.deleteProduct = async (id) => {
    if(confirm("Permanently remove this item?")) {
        try {
            await deleteDoc(doc(db, "products", id));
            loadInventory();
        } catch(e) {
            alert("Delete failed: " + e.message);
        }
    }
};

// ================= 3. ORDER MANAGEMENT (RESTORED) =================

window.loadOrders = async () => {
    const activeBody = document.querySelector('#activeOrdersTable tbody');
    const historyBody = document.querySelector('#historyOrdersTable tbody');
    if(!activeBody) return;

    try {
        const snapshot = await getDocs(collection(db, "orders"));
        activeBody.innerHTML = "";
        historyBody.innerHTML = "";

        snapshot.forEach(docSnap => {
            const o = docSnap.data();
            const date = o.date ? new Date(o.date).toLocaleDateString() : "Recent";
            
            const row = `
                <tr>
                    <td>${date}</td>
                    <td><strong>${o.userEmail}</strong></td>
                    <td>
                        <strong>${o.productName}</strong> (x${o.quantity})
                        ${o.personalization ? `<br><small style="color:var(--primary)">Engraving: ${o.personalization}</small>` : ''}
                    </td>
                    <td>₱${o.totalPrice}</td>
                    <td><strong>${o.status}</strong></td>
                    <td>
                        ${o.status === 'Pending' ? `
                            <button class="btn-primary" style="padding:5px 10px; font-size:0.7rem;" onclick="updateStatus('${docSnap.id}', 'Accepted')">Accept</button>
                            <button class="btn-outline" style="padding:5px 10px; font-size:0.7rem; color:red;" onclick="updateStatus('${docSnap.id}', 'Rejected')">Reject</button>
                        ` : '-'}
                    </td>
                </tr>
            `;

            if(o.status === 'Pending' || o.status === 'Accepted') {
                activeBody.innerHTML += row;
            } else {
                historyBody.innerHTML += row;
            }
        });
    } catch(e) {
        console.error("Load Orders Error:", e);
    }
};

window.updateStatus = async (id, status) => {
    try {
        await updateDoc(doc(db, "orders", id), { status: status });
        loadOrders();
    } catch (e) {
        alert("Status update failed: " + e.message);
    }
};