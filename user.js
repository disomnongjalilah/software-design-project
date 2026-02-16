import { auth, db } from "./firebase-config.js";
import { 
    onAuthStateChanged, signOut, updatePassword 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    collection, getDocs, doc, getDoc, updateDoc, query, where, addDoc, orderBy, onSnapshot 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let currentUser = null;
let currentProduct = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        loadUserProfile(user.uid);
        loadUserOrders(user.uid);
        loadProducts();
    } else {
        window.location.href = "/"; // Redirect to root for Vercel
    }
});

window.showSection = (id) => {
    ['hero', 'products', 'account', 'edit-details', 'change-password'].forEach(sec => {
        const el = document.getElementById(sec);
        if(el) el.style.display = 'none';
    });
    const target = document.getElementById(id);
    if(target) target.style.display = 'block';

    document.querySelectorAll('.nav-center a').forEach(a => a.classList.remove('active'));
    const navLink = document.getElementById('nav-' + id);
    if(navLink) navLink.classList.add('active');
}

window.logoutUser = async () => {
    await signOut(auth);
    window.location.href = "/"; // Redirect to root for Vercel
}

async function loadUserProfile(uid) {
    try {
        const docSnap = await getDoc(doc(db, "users", uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const name = data.name || "User";
            
            document.getElementById('welcomeName').innerText = name;
            document.getElementById('userNameDisplay').innerText = name; 
            document.getElementById('accountFullname').innerText = name;
            document.getElementById('accountEmail').innerText = data.email || currentUser.email;
            document.getElementById('accountPhone').innerText = data.phone || "N/A";

            document.getElementById('editFullname').value = name;
            document.getElementById('editPhone').value = data.phone || "";
        }
    } catch (e) { console.error(e); }
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
            alert("Profile Updated!");
            loadUserProfile(currentUser.uid);
            window.showSection('account');
        } catch(e) { alert(e.message); }
    });
}

const passForm = document.getElementById('changePasswordForm');
if(passForm) {
    passForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPass = document.getElementById('newPassword').value;
        if(newPass !== document.getElementById('confirmNewPassword').value) return alert("Passwords do not match");

        try {
            await updatePassword(currentUser, newPass);
            alert("Password Changed Successfully!");
            window.showSection('account');
            passForm.reset();
        } catch(e) { alert(e.message); }
    });
}

async function loadUserOrders(uid) {
    const container = document.getElementById('userOrders');
    if(!container) return;

    const q = query(collection(db, "orders"), where("userId", "==", uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        container.innerHTML = "<p>No orders placed yet.</p>";
        return;
    }

    container.innerHTML = "";
    snapshot.forEach(docSnap => { // Changed 'doc' to 'docSnap'
        const o = docSnap.data();
        container.innerHTML += `
            <div class="product-card" style="margin-bottom:15px; padding:15px; border:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h4 style="margin:0;">${o.productName}</h4>
                    <p style="margin:5px 0; font-size:13px; color:#888;">Qty: ${o.quantity} | Total: ₱${o.totalPrice}</p>
                    <span style="font-size:12px; font-weight:700; color:var(--primary)">Status: ${o.status}</span>
                </div>
            </div>
        `;
    });
}

async function loadProducts() {
    const container = document.getElementById('products-container');
    if(!container) return;

    const snapshot = await getDocs(collection(db, "products"));
    container.innerHTML = "";
    snapshot.forEach((docSnap) => { // Changed 'doc' to 'docSnap'
        const p = docSnap.data();
        const safeProduct = encodeURIComponent(JSON.stringify({id: docSnap.id, ...p}));
        container.innerHTML += `
            <div class="product-card">
                <img src="${p.imageUrl}">
                <h3>${p.name}</h3>
                <p class="price">₱${p.price}</p>
                <button class="btn-primary" onclick="openProductDetail('${safeProduct}')">View Details</button>
            </div>
        `;
    });
}

window.openProductDetail = (encodedProduct) => {
    currentProduct = JSON.parse(decodeURIComponent(encodedProduct));
    document.getElementById('detailName').innerText = currentProduct.name;
    document.getElementById('detailDesc').innerText = currentProduct.description || "";
    document.getElementById('detailPrice').innerText = "₱" + currentProduct.price;
    document.getElementById('detailImg').src = currentProduct.imageUrl;
    document.getElementById('productDetailsModal').style.display = 'flex';
}

window.placeOrder = async () => {
    try {
        await addDoc(collection(db, "orders"), {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            productName: currentProduct.name,
            productId: currentProduct.id,
            price: currentProduct.price,
            quantity: document.getElementById('orderQty').value,
            totalPrice: currentProduct.price * document.getElementById('orderQty').value,
            personalization: document.getElementById('engravingText').value,
            status: "Pending",
            date: new Date().toISOString()
        });
        alert("Order Placed Successfully!");
        window.closeModal('productDetailsModal');
        loadUserOrders(currentUser.uid);
    } catch(e) { alert(e.message); }
}

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

function listenForMessages() {
    if (!currentUser) return;
    const q = query(collection(db, "chats"), where("userId", "==", currentUser.uid), orderBy("timestamp", "asc"));
    
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('chat-messages');
        if(!container) return;

        container.innerHTML = "";
        snapshot.forEach(docSnap => { // Changed 'doc' to 'docSnap'
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
