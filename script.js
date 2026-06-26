import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// КОНФИГУРАЦИЯ FIREBASE
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

// ==========================================
// ГЛОБАЛЬНЫЕ СОСТОЯНИЯ
// ==========================================
let currentUser = localStorage.getItem('wishlist_user') || '';
let currentTheme = localStorage.getItem('wishlist_theme') || 'light';
let roomsData = [];
let currentRoomId = null;
let currentRoomName = '';
let currentRoomCreator = '';
let giftsData = [];
let roomUsersList = []; 

let searchQuery = '';
let currentSort = 'default';
let currentUserFilter = 'all'; 

// ==========================================
// DOM ЭЛЕМЕНТЫ
// ==========================================
const DOM = {
    screens: {
        login: document.getElementById('login-screen'),
        rooms: document.getElementById('rooms-screen'),
        app: document.getElementById('app-screen')
    },
    rooms: {
        container: document.getElementById('rooms-container'),
        userDisplay: document.getElementById('rooms-user-display'),
        avatar: document.getElementById('user-avatar')
    },
    app: {
        roomName: document.getElementById('current-room-name'),
        roomIdDisplay: document.getElementById('current-room-id'),
        startSantaBtn: document.getElementById('start-santa-btn'),
        usersCount: document.getElementById('room-users-count'),
        santaBanner: document.getElementById('secret-santa-banner'),
        santaTarget: document.getElementById('santa-target')
    },
    inputs: {
        username: document.getElementById('username-input'),
        password: document.getElementById('password-input')
    },
    gifts: {
        container: document.getElementById('gifts-container'),
        totalCount: document.getElementById('total-count'),
        filterSelect: document.getElementById('user-filter-select')
    },
    chat: {
        panel: document.getElementById('chat-panel'),
        messages: document.getElementById('chat-messages'),
        input: document.getElementById('chat-input')
    }
};

// ==========================================
// УТИЛИТЫ И БЕЗОПАСНОСТЬ
// ==========================================
const getSafeUserKey = (username) => username.replace(/[\.\$\#\[\]\/]/g, "_");
const getAvatarUrl = (username) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}&backgroundColor=b6e3f4`;
const escapeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

function generateUserColor(username) {
    if (!username) return '#000';
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

// ==========================================
// ИНИЦИАЛИЗАЦИЯ И НАВИГАЦИЯ
// ==========================================
function init() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentUser) { showRoomsScreen(); } else { showLoginScreen(); }
}

function showLoginScreen() {
    DOM.screens.app.classList.remove('active');
    DOM.screens.rooms.classList.remove('active');
    DOM.screens.login.classList.add('active');
}

function showRoomsScreen() {
    DOM.screens.login.classList.remove('active');
    DOM.screens.app.classList.remove('active');
    DOM.screens.rooms.classList.add('active');
    DOM.rooms.userDisplay.textContent = currentUser;
    DOM.rooms.avatar.src = getAvatarUrl(currentUser);
    listenToRooms();
}

async function showAppScreen(roomId, roomName, roomCreator) {
    currentRoomId = roomId;
    currentRoomName = roomName;
    currentRoomCreator = roomCreator;
    
    DOM.app.roomName.textContent = roomName;
    DOM.app.startSantaBtn.style.display = (currentUser === roomCreator) ? 'inline-block' : 'none';
    
    DOM.app.roomIdDisplay.textContent = roomId;
    DOM.app.roomIdDisplay.onclick = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            DOM.app.roomIdDisplay.textContent = 'Скопировано!';
            setTimeout(() => DOM.app.roomIdDisplay.textContent = roomId, 1500);
        } catch (err) {
            console.error('Ошибка копирования', err);
        }
    };
    
    const safeUser = getSafeUserKey(currentUser);
    await set(ref(db, `rooms/${roomId}/users_count/${safeUser}`), currentUser);
    
    DOM.screens.rooms.classList.remove('active');
    DOM.screens.app.classList.add('active');
    
    currentUserFilter = 'all'; 
    DOM.gifts.filterSelect.value = 'all';
    
    listenToRoomData();
    listenToChat();
}

// ==========================================
// АВТОРИЗАЦИЯ И НАСТРОЙКИ
// ==========================================
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = DOM.inputs.username.value.trim();
    const pass = DOM.inputs.password.value.trim();
    if (!login || !pass) return;

    const safeLogin = getSafeUserKey(login);
    try {
        const snapshot = await get(ref(db, `users/${safeLogin}`));
        if (snapshot.exists()) {
            if (snapshot.val().password === pass) {
                loginSuccess(login);
            } else {
                alert('Неверный пароль для этого логина!');
            }
        } else {
            await set(ref(db, `users/${safeLogin}`), { password: pass });
            alert('Новый аккаунт создан!');
            loginSuccess(login);
        }
    } catch (error) {
        console.error("Ошибка авторизации:", error);
        alert('Произошла ошибка при входе.');
    }
});

function loginSuccess(login) {
    currentUser = login;
    localStorage.setItem('wishlist_user', currentUser);
    DOM.inputs.username.value = '';
    DOM.inputs.password.value = '';
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

const toggleTheme = () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('wishlist_theme', currentTheme);
};
document.getElementById('theme-toggle-rooms').onclick = toggleTheme;
document.getElementById('theme-toggle-app').onclick = toggleTheme;

// ==========================================
// ЛОГИКА КОМНАТ
// ==========================================
function listenToRooms() {
    const safeUser = getSafeUserKey(currentUser);
    onValue(ref(db, `user_rooms/${safeUser}`), async (userRoomsSnap) => {
        const userRooms = userRoomsSnap.val() || {};
        const roomIds = Object.keys(userRooms);
        
        if (roomIds.length === 0) {
            roomsData = []; 
            renderRooms(); 
            return;
        }

        try {
            const allRoomsSnap = await get(ref(db, 'rooms'));
            const allRooms = allRoomsSnap.val() || {};
            roomsData = [];
            
            for (const id of roomIds) {
                if (allRooms[id]) {
                    roomsData.push({ id, name: allRooms[id].name, createdBy: allRooms[id].createdBy });
                } else {
                    remove(ref(db, `user_rooms/${safeUser}/${id}`)); // Очистка удаленных комнат
                }
            }
            renderRooms();
        } catch (error) {
            console.error("Ошибка загрузки комнат:", error);
        }
    });
}

document.getElementById('create-room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('room-name-input');
    const name = nameInput.value.trim();
    
    if (name) {
        try {
            const newRoomRef = push(ref(db, 'rooms'));
            const roomId = newRoomRef.key;
            await set(newRoomRef, { name, createdBy: currentUser });
            await set(ref(db, `user_rooms/${getSafeUserKey(currentUser)}/${roomId}`), true);
            nameInput.value = '';
        } catch (error) {
            console.error("Ошибка создания комнаты:", error);
        }
    }
});

document.getElementById('join-room-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idInput = document.getElementById('room-id-input');
    const roomId = idInput.value.trim();
    
    if (roomId) {
        try {
            const snapshot = await get(ref(db, `rooms/${roomId}`));
            if (snapshot.exists()) {
                await set(ref(db, `user_rooms/${getSafeUserKey(currentUser)}/${roomId}`), true);
                idInput.value = ''; 
                alert('Успешно присоединились!');
            } else {
                alert('Комната не найдена.');
            }
        } catch (error) {
            console.error("Ошибка присоединения:", error);
        }
    }
});

function renderRooms() {
    DOM.rooms.container.innerHTML = '';
    if (roomsData.length === 0) {
        DOM.rooms.container.innerHTML = '<div class="loading-placeholder">У вас нет комнат. Создайте или введите код!</div>';
        return;
    }
    
    roomsData.forEach(room => {
        const card = document.createElement('div');
        card.className = 'room-card';
        card.onclick = () => showAppScreen(room.id, room.name, room.createdBy);
        card.innerHTML = `<div class="room-title">${escapeHTML(room.name)}</div><div class="gift-creator">Создатель: ${escapeHTML(room.createdBy)}</div>`;
        
        if (room.createdBy === currentUser) {
            const btn = document.createElement('button');
            btn.className = 'btn-delete'; 
            btn.innerHTML = '&#x2715;';
            btn.onclick = async (e) => { 
                e.stopPropagation(); 
                if (confirm('Удалить комнату?')) {
                    await remove(ref(db, `rooms/${room.id}`));
                }
            };
            card.appendChild(btn);
        }
        DOM.rooms.container.appendChild(card);
    });
}

// ==========================================
// ПОДАРКИ И ТАЙНЫЙ САНТА
// ==========================================
function listenToRoomData() {
    if (!currentRoomId) return;
    
    // Слушатель подарков
    onValue(ref(db, `rooms/${currentRoomId}/gifts`), (snapshot) => {
        giftsData = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(key => {
                giftsData.push({
                    id: key, 
                    title: data[key].title, 
                    price: Number(data[key].price) || 0,
                    imageUrl: data[key].imageUrl || '', 
                    createdBy: data[key].createdBy,
                    rating: data[key].rating || 3, 
                    buyers: data[key].buyers || {}
                });
            });
        }
        updateUserFilterDropdown();
        renderGifts();
    });

    // Слушатель участников
    onValue(ref(db, `rooms/${currentRoomId}/users_count`), (snapshot) => {
        const data = snapshot.val();
        roomUsersList = data ? Object.values(data) : [];
        if (DOM.app.usersCount) DOM.app.usersCount.textContent = roomUsersList.length;
        updateUserFilterDropdown();
    });

    // Слушатель Тайного Санты
    onValue(ref(db, `rooms/${currentRoomId}/secret_santa`), (snapshot) => {
        const data = snapshot.val();
        const safeMe = getSafeUserKey(currentUser);

        if (data && data[safeMe]) {
            DOM.app.santaBanner.style.display = 'block';
            DOM.app.santaTarget.textContent = data[safeMe];
        } else {
            DOM.app.santaBanner.style.display = 'none';
        }
    });
}

function updateUserFilterDropdown() {
    if (!DOM.gifts.filterSelect) return;
    
    const currentVal = DOM.gifts.filterSelect.value;
    DOM.gifts.filterSelect.innerHTML = '<option value="all">👥 Все участники</option>';
    
    const uniqueUsers = new Set();
    if (currentUser) uniqueUsers.add(currentUser);
    
    if (Array.isArray(roomUsersList)) {
        roomUsersList.forEach(u => { if (u) uniqueUsers.add(u); });
    }
    
    if (Array.isArray(giftsData)) {
        giftsData.forEach(g => { if (g && g.createdBy) uniqueUsers.add(g.createdBy); });
    }
    
    const sortedUsers = Array.from(uniqueUsers)
        .filter(u => typeof u === 'string' && u.trim() !== '')
        .sort((a, b) => a.localeCompare(b));
    
    sortedUsers.forEach(user => {
        const opt = document.createElement('option');
        opt.value = user;
        opt.textContent = `👤 ${user}`;
        DOM.gifts.filterSelect.appendChild(opt);
    });
    
    if (uniqueUsers.has(currentVal)) {
        DOM.gifts.filterSelect.value = currentVal;
        currentUserFilter = currentVal;
    } else {
        DOM.gifts.filterSelect.value = 'all';
        currentUserFilter = 'all';
    }
}

DOM.app.startSantaBtn.onclick = async () => {
    if (!confirm('Распределить Тайного Санту среди участников?')) return;
    
    try {
        const snap = await get(ref(db, `rooms/${currentRoomId}/users_count`));
        const usersObj = snap.val() || {};
        const safeKeys = Object.keys(usersObj);
        
        if (safeKeys.length < 3) return alert("Для Тайного Санты нужно минимум 3 участника!");

        let shuffled = [...safeKeys].sort(() => 0.5 - Math.random());
        let assignments = {};
        
        for (let i = 0; i < shuffled.length; i++) {
            let giverSafe = shuffled[i];
            let receiverSafe = shuffled[(i + 1) % shuffled.length];
            assignments[giverSafe] = usersObj[receiverSafe];
        }
        
        await set(ref(db, `rooms/${currentRoomId}/secret_santa`), assignments);
        alert("Санта успешно распределен! Обновите страницу, если баннер не появился.");
    } catch (error) {
        console.error("Ошибка распределения Санты:", error);
    }
};

document.getElementById('add-gift-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('gift-title-input');
    const priceInput = document.getElementById('gift-price-input');
    const imageInput = document.getElementById('gift-image-input');
    
    const title = titleInput.value.trim();
    const price = priceInput.value.trim();
    const imageUrl = imageInput.value.trim();
    const ratingElement = document.querySelector('input[name="rating"]:checked');
    const rating = ratingElement ? parseInt(ratingElement.value) : 3;

    if (title && price) {
        try {
            await push(ref(db, `rooms/${currentRoomId}/gifts`), {
                title, price: Number(price), imageUrl: imageUrl || null, createdBy: currentUser, rating, buyers: {}
            });
            titleInput.value = '';
            priceInput.value = '';
            imageInput.value = '';
        } catch (error) {
            console.error("Ошибка добавления подарка:", error);
        }
    }
});

async function toggleBuyGift(giftId, isCurrentlyChecked) {
    const safeUsername = getSafeUserKey(currentUser);
    const buyerRef = ref(db, `rooms/${currentRoomId}/gifts/${giftId}/buyers/${safeUsername}`);
    
    try {
        if (!isCurrentlyChecked) {
            await set(buyerRef, true);
            if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
        } else {
            await remove(buyerRef);
        }
    } catch (error) {
        console.error("Ошибка резервирования подарка:", error);
    }
}

document.getElementById('search-input').addEventListener('input', (e) => { searchQuery = e.target.value.toLowerCase(); renderGifts(); });
document.getElementById('sort-select').addEventListener('change', (e) => { currentSort = e.target.value; renderGifts(); });
DOM.gifts.filterSelect.addEventListener('change', (e) => { currentUserFilter = e.target.value; renderGifts(); });

function renderGifts() {
    DOM.gifts.container.innerHTML = '';
    
    let processedGifts = giftsData.filter(g => g.title.toLowerCase().includes(searchQuery));
    if (currentUserFilter !== 'all') processedGifts = processedGifts.filter(g => g.createdBy === currentUserFilter);
    
    if (currentSort === 'price-asc') processedGifts.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-desc') processedGifts.sort((a, b) => b.price - a.price);
    else if (currentSort === 'rating-desc') processedGifts.sort((a, b) => b.rating - a.rating);

    DOM.gifts.totalCount.textContent = processedGifts.length;

    if (processedGifts.length === 0) {
        DOM.gifts.container.innerHTML = '<div class="loading-placeholder">Нет подарков</div>'; 
        return;
    }

    processedGifts.forEach(gift => {
        const isMeChecked = !!gift.buyers[getSafeUserKey(currentUser)];
        const card = document.createElement('div');
        card.className = 'gift-card';
        if (isMeChecked) card.style.borderColor = 'var(--success-color)';

        let stars = ''; 
        for(let i=1; i<=5; i++) stars += i <= gift.rating ? '★' : '☆';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'gift-header';
        headerDiv.innerHTML = `
            <div class="gift-creator">
                <img src="${getAvatarUrl(gift.createdBy)}" style="width:20px; height:20px; border-radius:50%; object-fit:cover; flex-shrink:0;" alt="av"> 
                <b>${escapeHTML(gift.createdBy)}</b>
            </div>
            <div style="color:var(--star-color)">${stars}</div>
        `;
        card.appendChild(headerDiv);

        if (gift.imageUrl) {
            const imgContainer = document.createElement('div'); 
            imgContainer.className = 'gift-image-container';
            
            const img = document.createElement('img'); 
            img.src = gift.imageUrl; 
            img.className = 'gift-image';
            img.onerror = () => imgContainer.style.display = 'none'; // Скрываем, если картинка битая
            
            imgContainer.appendChild(img); 
            card.appendChild(imgContainer);
        }

        const titleDiv = document.createElement('div');
        titleDiv.className = 'gift-title';
        titleDiv.textContent = gift.title; // Безопасная вставка текста
        
        const priceDiv = document.createElement('div');
        priceDiv.className = 'gift-price';
        priceDiv.textContent = `${gift.price.toLocaleString('ru-RU')} ₽`;

        card.appendChild(titleDiv);
        card.appendChild(priceDiv);

        const buyersDiv = document.createElement('div');
        buyersDiv.className = 'gift-buyers';
        Object.keys(gift.buyers).forEach(buyer => {
            const tag = document.createElement('span'); 
            tag.className = 'buyer-tag';
            tag.textContent = buyer; 
            tag.style.backgroundColor = generateUserColor(buyer);
            buyersDiv.appendChild(tag);
        });
        card.appendChild(buyersDiv);

        const buyBtn = document.createElement('button');
        buyBtn.className = isMeChecked ? 'btn-buy-action active' : 'btn-buy-action';
        buyBtn.innerHTML = isMeChecked ? '✅ Вы покупаете это' : '🛍️ Хочу подарить';
        buyBtn.onclick = () => toggleBuyGift(gift.id, isMeChecked);
        card.appendChild(buyBtn);

        if (gift.createdBy === currentUser || currentRoomCreator === currentUser) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete'; 
            deleteBtn.innerHTML = '&#x2715;';
            deleteBtn.title = 'Удалить подарок';
            deleteBtn.onclick = async () => {
                if (confirm('Точно удалить этот подарок?')) {
                    await remove(ref(db, `rooms/${currentRoomId}/gifts/${gift.id}`));
                }
            };
            card.appendChild(deleteBtn);
        }

        DOM.gifts.container.appendChild(card);
    });
}

// ==========================================
// ЛОГИКА ЧАТА
// ==========================================
document.getElementById('toggle-chat-btn').onclick = () => {
    DOM.chat.panel.classList.toggle('open');
    DOM.chat.panel.style.display = DOM.chat.panel.classList.contains('open') ? 'flex' : 'none';
};
document.getElementById('close-chat-btn').onclick = () => {
    DOM.chat.panel.classList.remove('open');
    DOM.chat.panel.style.display = 'none';
};

function listenToChat() {
    if (!currentRoomId) return;
    onValue(ref(db, `rooms/${currentRoomId}/messages`), (snapshot) => {
        DOM.chat.messages.innerHTML = '';
        const data = snapshot.val();
        
        if (data) {
            Object.values(data).forEach(msg => {
                const isMine = msg.sender === currentUser;
                const div = document.createElement('div');
                div.className = `chat-msg ${isMine ? 'mine' : ''}`;
                
                let authorHtml = '';
                if (!isMine) {
                    authorHtml = `
                        <div class="chat-msg-author" style="color:${generateUserColor(msg.sender)}; display:flex; align-items:center; gap:6px; margin-bottom:4px; font-weight:600; font-size:0.8rem;">
                            <img src="${getAvatarUrl(msg.sender)}" style="width:24px; height:24px; border-radius:50%; flex-shrink:0; object-fit:cover;" alt="av"> 
                            <span>${escapeHTML(msg.sender)}</span>
                        </div>`;
                }
                
                // Используем безопасную сборку HTML
                div.innerHTML = authorHtml;
                const textDiv = document.createElement('div');
                textDiv.textContent = msg.text; // <- Защита от XSS (ввод как текст, а не HTML)
                div.appendChild(textDiv);
                
                DOM.chat.messages.appendChild(div);
            });
            DOM.chat.messages.scrollTop = DOM.chat.messages.scrollHeight;
        } else {
            DOM.chat.messages.innerHTML = '<div style="text-align:center; color:gray; font-size: 0.8rem;">Нет сообщений. Напишите первым!</div>';
        }
    });
}

document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = DOM.chat.input.value.trim();
    if (text) {
        try {
            await push(ref(db, `rooms/${currentRoomId}/messages`), { 
                sender: currentUser, 
                text: text, 
                timestamp: Date.now() 
            });
            DOM.chat.input.value = '';
        } catch (error) {
            console.error("Ошибка отправки сообщения:", error);
        }
    }
});

// Запуск
window.onload = init;
