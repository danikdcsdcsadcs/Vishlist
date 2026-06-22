import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// КОНФИГУРАЦИЯ FIREBASE (Оставлена в коде по запросу)
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCS8ekWaGkhU2k7t8foHzn8I2U-zEDJUYU",
    authDomain: "mywishlistapp-1db3d.firebaseapp.com",
    databaseURL: "https://mywishlistapp-1db3d-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "mywishlistapp-1db3d",
    storageBucket: "mywishlistapp-1db3d.firebasestorage.app",
    messagingSenderId: "209220916434",
    appId: "1:209220916434:web:bc121ca5583b1885f9c90b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Глобальные состояния
let currentUser = localStorage.getItem('wishlist_user') || '';
let currentTheme = localStorage.getItem('wishlist_theme') || 'light';
let roomsData = [];
let currentRoomId = null;
let currentRoomName = '';
let giftsData = [];
let searchQuery = '';
let currentSort = 'default';

// DOM Элементы
const loginScreen = document.getElementById('login-screen');
const roomsScreen = document.getElementById('rooms-screen');
const appScreen = document.getElementById('app-screen');

function init() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentUser) { showRoomsScreen(); } else { showLoginScreen(); }
}

function showLoginScreen() {
    appScreen.classList.remove('active');
    roomsScreen.classList.remove('active');
    loginScreen.classList.add('active');
}

function showRoomsScreen() {
    loginScreen.classList.remove('active');
    appScreen.classList.remove('active');
    roomsScreen.classList.add('active');
    document.getElementById('rooms-user-display').textContent = currentUser;
    document.getElementById('user-avatar').src = getAvatarUrl(currentUser);
    listenToRooms();
}

function showAppScreen(roomId, roomName) {
    currentRoomId = roomId;
    currentRoomName = roomName;
    document.getElementById('current-room-name').textContent = roomName;
    
    const idDisplay = document.getElementById('current-room-id');
    idDisplay.textContent = roomId;
    idDisplay.onclick = () => {
        navigator.clipboard.writeText(roomId).then(() => {
            idDisplay.textContent = 'Скопировано!';
            setTimeout(() => idDisplay.textContent = roomId, 1500);
        });
    };
    
    // Добавляем себя в список участников комнаты
    const safeUser = getSafeUserKey(currentUser);
    set(ref(db, `rooms/${roomId}/users_count/${safeUser}`), true);
    
    roomsScreen.classList.remove('active');
    appScreen.classList.add('active');
    listenToRoomData();
    listenToChat();
}

// ==========================================
// АВТОРИЗАЦИЯ (Кастомная по Логину и Паролю)
// ==========================================
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const login = document.getElementById('username-input').value.trim();
    const pass = document.getElementById('password-input').value.trim();
    
    if (!login || !pass) return;

    const safeLogin = getSafeUserKey(login);
    const userRef = ref(db, `users/${safeLogin}`);

    get(userRef).then((snapshot) => {
        if (snapshot.exists()) {
            // Пользователь есть, проверяем пароль
            if (snapshot.val().password === pass) {
                loginSuccess(login);
            } else {
                alert('Неверный пароль для этого логина!');
            }
        } else {
            // Новый пользователь — регистрируем
            set(userRef, { password: pass }).then(() => {
                alert('Новый аккаунт создан!');
                loginSuccess(login);
            });
        }
    });
});

function loginSuccess(login) {
    currentUser = login;
    localStorage.setItem('wishlist_user', currentUser);
    document.getElementById('username-input').value = '';
    document.getElementById('password-input').value = '';
    showRoomsScreen();
}

document.getElementById('logout-btn').onclick = () => {
    localStorage.removeItem('wishlist_user');
    currentUser = '';
    showLoginScreen();
};

document.getElementById('back-to-rooms-btn').onclick = () => {
    currentRoomId = null;
    showRoomsScreen();
};

// Темы
const toggleTheme = () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('wishlist_theme', currentTheme);
};
document.getElementById('theme-toggle-rooms').onclick = toggleTheme;
document.getElementById('theme-toggle-app').onclick = toggleTheme;

// Утилиты
function generateUserColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}
function triggerConfetti() { confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } }); }
function renderStars(rating) { let s = ''; for (let i=1; i<=5; i++) s += i <= rating ? '★' : '☆'; return s; }
function getSafeUserKey(username) { return username.replace(/[\.\$\#\[\]\/]/g, "_"); }
function getAvatarUrl(username) { return `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}&backgroundColor=b6e3f4`; }

// ==========================================
// ЛОГИКА КОМНАТ
// ==========================================
function listenToRooms() {
    const safeUser = getSafeUserKey(currentUser);
    onValue(ref(db, `user_rooms/${safeUser}`), (userRoomsSnap) => {
        const userRooms = userRoomsSnap.val() || {};
        const roomIds = Object.keys(userRooms);
        
        if (roomIds.length === 0) {
            roomsData = [];
            renderRooms();
            return;
        }

        get(ref(db, 'rooms')).then((allRoomsSnap) => {
            const allRooms = allRoomsSnap.val() || {};
            roomsData = [];
            roomIds.forEach(id => {
                if (allRooms[id]) roomsData.push({ id, name: allRooms[id].name, createdBy: allRooms[id].createdBy });
                else remove(ref(db, `user_rooms/${safeUser}/${id}`));
            });
            renderRooms();
        });
    });
}

document.getElementById('create-room-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('room-name-input');
    const name = nameInput.value.trim();
    if (name) {
        const newRoomRef = push(ref(db, 'rooms'));
        const roomId = newRoomRef.key;
        set(newRoomRef, { name, createdBy: currentUser }).then(() => {
            set(ref(db, `user_rooms/${getSafeUserKey(currentUser)}/${roomId}`), true);
            nameInput.value = '';
        });
    }
});

document.getElementById('join-room-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const idInput = document.getElementById('room-id-input');
    const roomId = idInput.value.trim();
    if (roomId) {
        get(ref(db, `rooms/${roomId}`)).then((snapshot) => {
            if (snapshot.exists()) {
                set(ref(db, `user_rooms/${getSafeUserKey(currentUser)}/${roomId}`), true).then(() => {
                    idInput.value = '';
                    alert('Успешно присоединились!');
                });
            } else alert('Комната не найдена.');
        });
    }
});

function renderRooms() {
    const container = document.getElementById('rooms-container');
    container.innerHTML = '';
    if (roomsData.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">У вас нет комнат. Создайте или введите код!</div>';
        return;
    }
    roomsData.forEach(room => {
        const card = document.createElement('div');
        card.className = 'room-card';
        card.onclick = () => showAppScreen(room.id, room.name);
        card.innerHTML = `<div class="room-title">${room.name}</div><div class="gift-creator">Создатель: ${room.createdBy}</div>`;
        if (room.createdBy === currentUser) {
            const btn = document.createElement('button');
            btn.className = 'btn-delete'; btn.innerHTML = '&#x2715;';
            btn.onclick = (e) => { e.stopPropagation(); if(confirm('Удалить комнату?')) remove(ref(db, `rooms/${room.id}`)); };
            card.appendChild(btn);
        }
        container.appendChild(card);
    });
}

// ==========================================
// ЛОГИКА ПОДАРКОВ И ПОЛЬЗОВАТЕЛЕЙ КОМНАТЫ
// ==========================================
function listenToRoomData() {
    if (!currentRoomId) return;
    
    // Слушаем подарки
    onValue(ref(db, `rooms/${currentRoomId}/gifts`), (snapshot) => {
        giftsData = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(key => {
                giftsData.push({
                    id: key, title: data[key].title, price: Number(data[key].price) || 0,
                    imageUrl: data[key].imageUrl || '', createdBy: data[key].createdBy,
                    rating: data[key].rating || 3, buyers: data[key].buyers || {}
                });
            });
        }
        renderGifts();
    });

    // Слушаем количество участников
    onValue(ref(db, `rooms/${currentRoomId}/users_count`), (snapshot) => {
        const data = snapshot.val();
        document.getElementById('room-users-count').textContent = data ? Object.keys(data).length : 1;
    });
}

document.getElementById('add-gift-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('gift-title-input').value.trim();
    const price = document.getElementById('gift-price-input').value.trim();
    const imageUrl = document.getElementById('gift-image-input').value.trim();
    const ratingElement = document.querySelector('input[name="rating"]:checked');
    const rating = ratingElement ? parseInt(ratingElement.value) : 3;

    if (title && price) {
        push(ref(db, `rooms/${currentRoomId}/gifts`), {
            title, price: Number(price), imageUrl: imageUrl || null, createdBy: currentUser, rating, buyers: {}
        }).then(() => {
            document.getElementById('gift-title-input').value = '';
            document.getElementById('gift-price-input').value = '';
            document.getElementById('gift-image-input').value = '';
        });
    }
});

function toggleBuyGift(giftId, isCurrentlyChecked) {
    const safeUsername = getSafeUserKey(currentUser);
    const buyerRef = ref(db, `rooms/${currentRoomId}/gifts/${giftId}/buyers/${safeUsername}`);
    if (!isCurrentlyChecked) set(buyerRef, true).then(triggerConfetti);
    else remove(buyerRef);
}

document.getElementById('search-input').addEventListener('input', (e) => { searchQuery = e.target.value.toLowerCase(); renderGifts(); });
document.getElementById('sort-select').addEventListener('change', (e) => { currentSort = e.target.value; renderGifts(); });

function renderGifts() {
    const container = document.getElementById('gifts-container');
    container.innerHTML = '';
    let processedGifts = giftsData.filter(g => g.title.toLowerCase().includes(searchQuery));
    
    if (currentSort === 'price-asc') processedGifts.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-desc') processedGifts.sort((a, b) => b.price - a.price);
    else if (currentSort === 'rating-desc') processedGifts.sort((a, b) => b.rating - a.rating);
    else processedGifts.sort((a, b) => (a.buyers[currentUser] ? 1 : 0) - (b.buyers[currentUser] ? 1 : 0));

    document.getElementById('total-count').textContent = giftsData.length;

    if (processedGifts.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">Нет подарков</div>';
        return;
    }

    processedGifts.forEach(gift => {
        const isMeChecked = !!gift.buyers[getSafeUserKey(currentUser)];
        const card = document.createElement('div');
        card.className = 'gift-card';
        if (isMeChecked) card.style.borderColor = 'var(--success-color)';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'gift-header';
        headerDiv.innerHTML = `
            <div class="gift-creator">
                <img src="${getAvatarUrl(gift.createdBy)}" alt="av"> 
                <span style="color:${generateUserColor(gift.createdBy)}">${gift.createdBy}</span>
            </div>
            <div class="gift-rating">${renderStars(gift.rating)}</div>
        `;
        card.appendChild(headerDiv);

        if (gift.imageUrl) {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'gift-image-container';
            const img = document.createElement('img');
            img.src = gift.imageUrl; img.className = 'gift-image';
            img.onerror = () => imgContainer.style.display = 'none';
            imgContainer.appendChild(img); card.appendChild(imgContainer);
        }

        card.innerHTML += `<div class="gift-title">${gift.title}</div><div class="gift-price">${gift.price.toLocaleString('ru-RU')} ₽</div>`;

        const buyersDiv = document.createElement('div');
        buyersDiv.className = 'gift-buyers';
        Object.keys(gift.buyers).forEach(buyer => {
            const tag = document.createElement('span'); tag.className = 'buyer-tag';
            tag.textContent = buyer; tag.style.backgroundColor = generateUserColor(buyer);
            buyersDiv.appendChild(tag);
        });
        card.appendChild(buyersDiv);

        const buyBtn = document.createElement('button');
        buyBtn.className = isMeChecked ? 'btn-buy-action active' : 'btn-buy-action';
        buyBtn.innerHTML = isMeChecked ? '✅ Вы покупаете это' : '🛍️ Хочу подарить';
        buyBtn.onclick = () => toggleBuyGift(gift.id, isMeChecked);
        card.appendChild(buyBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete'; deleteBtn.innerHTML = '&#x2715;';
        deleteBtn.onclick = () => remove(ref(db, `rooms/${currentRoomId}/gifts/${gift.id}`));
        card.appendChild(deleteBtn);

        container.appendChild(card);
    });
}

// ==========================================
// ЛОГИКА ЧАТА
// ==========================================
const chatSidebar = document.getElementById('chat-panel');
document.getElementById('toggle-chat-btn').onclick = () => chatSidebar.classList.toggle('open');
document.getElementById('close-chat-btn').onclick = () => chatSidebar.classList.remove('open');

function listenToChat() {
    if (!currentRoomId) return;
    onValue(ref(db, `rooms/${currentRoomId}/messages`), (snapshot) => {
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';
        const data = snapshot.val();
        if (data) {
            Object.values(data).forEach(msg => {
                const isMine = msg.sender === currentUser;
                const div = document.createElement('div');
                div.className = `chat-msg ${isMine ? 'mine' : ''}`;
                
                let authorHtml = '';
                if (!isMine) {
                    authorHtml = `
                        <div class="chat-msg-author" style="color:${generateUserColor(msg.sender)}">
                            <img src="${getAvatarUrl(msg.sender)}" alt="av"> ${msg.sender}
                        </div>`;
                }
                
                div.innerHTML = `${authorHtml}<div>${msg.text}</div>`;
                container.appendChild(div);
            });
            // Прокрутка вниз
            container.scrollTop = container.scrollHeight;
        } else {
            container.innerHTML = '<div style="text-align:center; color:gray; font-size: 0.8rem;">Нет сообщений. Напишите первым!</div>';
        }
    });
}

document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text) {
        push(ref(db, `rooms/${currentRoomId}/messages`), {
            sender: currentUser, text: text, timestamp: Date.now()
        });
        input.value = '';
    }
});

window.onload = init;
