import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, query, orderBy, onSnapshot, where } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let selectedUserId = null;
let editingProductId = null;

// --- AUTH MONITOR ---
onAuthStateChanged(auth, (user) => {
    if (user && user.email === "admin@favored.com") {
        loadInventory();
        loadOrders();
    } else {
        window.location.href = "/"; 
    }
});

// --- NAVIGATION & MODALS ---
window.showAdminSection = (id) => {
    ['products', 'orders', 'admin-chat'].forEach(sec => {
        const el = document.getElementById(sec);
        if(el) el.style.display = (sec === id) ? 'block' : 'none';
    });
    if(id === 'admin-chat') loadChatUsers();
};

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = (id) => document.getElementById(id).style.display = 'none';

window.logoutAdmin = () => signOut(auth).then(() => window.location.href = "/");

// --- INVENTORY MANAGEMENT ---
async function loadInventory() {
    const container = document.getElementById('adminProducts');
    const template = document.getElementById('product-template');
    if(!container || !template) return;
    
    onSnapshot(collection(db, "products"), (snapshot) => {
        container.innerHTML = "";
        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            const id = docSnap.id;
            const clone = template.content.cloneNode(true);

            clone.querySelector('.p-img').src = p.imageUrl;
            clone.querySelector('.p-name').textContent = p.name;
            clone.querySelector('.p-price').textContent = `₱${p.price}`;
            
            const stockEl = clone.querySelector('.p-stock');
            stockEl.textContent = p.stock > 0 ? `${p.stock} in stock` : "Out of Stock";
            stockEl.style.color = p.stock > 0 ? 'green' : 'red';

            clone.querySelector('.btn-plus').onclick = () => updateStock(id, p.stock + 1);
            clone.querySelector('.btn-minus').onclick = () => updateStock(id, p.stock - 1);
            clone.querySelector('.btn-edit').onclick = () => openEditProductModal(id, p.name, p.price, p.stock);
            clone.querySelector('.btn-delete').onclick = () => deleteProduct(id);

            container.appendChild(clone);
        });
    });
}

window.updateStock = async (id, newStock) => {
    if (newStock < 0) return;
    await updateDoc(doc(db, "products", id), { stock: newStock });
};

window.openEditProductModal = (id, name, price, stock) => {
    editingProductId = id;
    document.getElementById('editName').value = name;
    document.getElementById('editPrice').value = price;
    document.getElementById('editStock').value = stock;
    window.openModal('editProductModal');
};

window.saveProductEdit = async () => {
    await updateDoc(doc(db, "products", editingProductId), {
        name: document.getElementById('editName').value,
        price: Number(document.getElementById('editPrice').value),
        stock: Number(document.getElementById('editStock').value)
    });
    window.closeModal('editProductModal');
};

// --- ADD PRODUCT (BASE64) ---
window.addProduct = async () => {
    const name = document.getElementById('addName').value;
    const price = document.getElementById('addPrice').value;
    const file = document.getElementById('addImageFile').files[0];

    if (!name || !price || !file) return alert("Fill all fields");

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (e) => {
        await addDoc(collection(db, "products"), {
            name, price: Number(price), stock: 10, imageUrl: e.target.result, date: new Date().toISOString()
        });
        window.closeModal('addProductModal');
    };
};

window.deleteProduct = async (id) => { if(confirm("Remove item?")) await deleteDoc(doc(db, "products", id)); };

// --- ORDER MANAGEMENT ---
window.loadOrders = () => {
    const container = document.getElementById('admin-orders-container');
    const template = document.getElementById('order-template');
    if(!container || !template) return;

    onSnapshot(query(collection(db, "orders"), orderBy("date", "desc")), (snapshot) => {
        container.innerHTML = "";
        snapshot.forEach(docSnap => {
            const o = docSnap.data();
            const id = docSnap.id;
            const clone = template.content.cloneNode(true);

            clone.querySelector('.order-id').textContent = `#${id.slice(0,6)}`;
            clone.querySelector('.order-date').textContent = new Date(o.date).toLocaleDateString();
            clone.querySelector('.order-img').src = o.imageUrl;
            clone.querySelector('.order-product-name').textContent = o.productName;
            clone.querySelector('.order-email').textContent = o.userEmail;
            clone.querySelector('.order-total').textContent = `₱${o.totalPrice}`;
            clone.querySelector('.order-note').textContent = `Note: ${o.personalization || "None"}`;

            const select = clone.querySelector('.status-select');
            ["Pending", "Preparing", "Ready", "Completed", "Rejected"].forEach(stat => {
                const opt = document.createElement('option');
                opt.value = stat; opt.textContent = stat;
                if(o.status === stat) opt.selected = true;
                select.appendChild(opt);
            });
            select.onchange = (e) => updateOrderStatus(id, e.target.value);
            container.appendChild(clone);
        });
    });
};

window.updateOrderStatus = async (id, status) => await updateDoc(doc(db, "orders", id), { status });


// ==========================================
// 5. CHAT SYSTEM (Improved)
// ==========================================
function loadChatUsers() {
    const list = document.getElementById('adminChatUserList');
    if(!list) return;

    // Listen to all chats to find unique users
    const q = query(collection(db, "chats"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        const users = {};
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Store the most recent email for each unique ID
            if (!users[data.userId]) {
                users[data.userId] = data.userEmail || "Guest User";
            }
        });
        
        list.innerHTML = ""; // Clear list
        
        Object.keys(users).forEach(uid => {
            const userDiv = document.createElement('div');
            userDiv.className = `user-tab ${selectedUserId === uid ? 'active' : ''}`;
            userDiv.style.padding = "15px";
            userDiv.style.cursor = "pointer";
            userDiv.style.borderBottom = "1px solid #eee";
            userDiv.innerHTML = `<i class="fas fa-user-circle"></i> ${users[uid]}`;
            
            userDiv.onclick = () => {
                // Update styling for all tabs
                document.querySelectorAll('.user-tab').forEach(t => t.classList.remove('active'));
                userDiv.classList.add('active');
                selectUserChat(uid);
            };
            
            list.appendChild(userDiv);
        });
    });
}

// Global variable to hold the unsubscribe function for the message listener
let unsubscribeMessages = null;

window.selectUserChat = (uid) => {
    selectedUserId = uid;
    const container = document.getElementById('adminChatMessages');
    if(!container) return;

    // If there's an existing listener for another user, stop it
    if (unsubscribeMessages) unsubscribeMessages();

    const q = query(
        collection(db, "chats"), 
        where("userId", "==", uid), 
        orderBy("timestamp", "asc")
    );

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        container.innerHTML = ""; // Clear current view
        
        snapshot.forEach(docSnap => {
            const m = docSnap.data();
            const msgDiv = document.createElement('div');
            // The class 'admin' or 'user' determines if it's left or right
            msgDiv.className = `msg ${m.sender === 'admin' ? 'admin' : 'user'}`;
            msgDiv.textContent = m.text;
            container.appendChild(msgDiv);
        });
        
        // Auto-scroll to bottom
        container.scrollTop = container.scrollHeight;
    }, (error) => {
        console.error("Chat Listener Error:", error);
    });
};

window.sendAdminMessage = async () => {
    const input = document.getElementById('adminChatInput');
    
    // 1. Check if an input exists
    if (!input) return console.error("Could not find input field 'adminChatInput'");

    const messageText = input.value.trim();

    // 2. Check if text is empty
    if (!messageText) return;

    // 3. Check if a user is selected
    if (!selectedUserId) {
        alert("Please select a customer from the left sidebar first.");
        return;
    }

    try {
        // 4. Send to Firestore
        await addDoc(collection(db, "chats"), {
            userId: selectedUserId,
            text: messageText,
            sender: "admin", // This tells the app to put the bubble on the right
            timestamp: new Date()
        });

        // 5. Clear input on success
        input.value = "";
        console.log("Message sent to:", selectedUserId);

    } catch (e) {
        console.error("Send Error:", e);
        alert("Failed to send: " + e.message);
    }
};
