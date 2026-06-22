import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// КОНФИГУРАЦИЯ FIREBASE
// Вставьте сюда свои ключи из консоли Firebase
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
    listenToRooms();
}

function showAppScreen(roomId, roomName) {
    currentRoomId = roomId;
    currentRoomName = roomName;
    document.getElementById('current-room-name').textContent = roomName;
    
    roomsScreen.classList.remove('active');
    appScreen.classList.add('active');
    listenToGiftsChanges();
}

// Авторизация
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('username-input').value.trim();
    if (name) {
        currentUser = name;
        localStorage.setItem('wishlist_user', currentUser);
        showRoomsScreen();
    }
});

// Кнопки выхода и назад
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

function triggerConfetti() {
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
}

function renderStars(rating) {
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
        starsHtml += i <= rating ? '★' : '☆';
    }
    return starsHtml;
}

// ==========================================
// ЛОГИКА КОМНАТ
// ==========================================
function listenToRooms() {
    onValue(ref(db, 'rooms'), (snapshot) => {
        roomsData = [];
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(key => {
                roomsData.push({ id: key, name: data[key].name, createdBy: data[key].createdBy });
            });
        }
        renderRooms();
    });
}

document.getElementById('create-room-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('room-name-input');
    const name = nameInput.value.trim();
    if (name) {
        push(ref(db, 'rooms'), { name, createdBy: currentUser });
        nameInput.value = '';
    }
});

function deleteRoom(id, e) {
    e.stopPropagation(); // Чтобы не сработал переход в комнату
    if(confirm('Точно удалить комнату и все её подарки?')) {
        remove(ref(db, `rooms/${id}`));
    }
}

function renderRooms() {
    const container = document.getElementById('rooms-container');
    container.innerHTML = '';
    if (roomsData.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">Нет доступных комнат. Создайте первую!</div>';
        return;
    }

    roomsData.forEach(room => {
        const card = document.createElement('div');
        card.className = 'room-card';
        card.onclick = () => showAppScreen(room.id, room.name);

        card.innerHTML = `
            <div class="room-title">${room.name}</div>
            <div class="gift-creator">Создатель: ${room.createdBy}</div>
        `;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.innerHTML = '&#x2715;';
        deleteBtn.onclick = (e) => deleteRoom(room.id, e);
        card.appendChild(deleteBtn);

        container.appendChild(card);
    });
}

// ==========================================
// ЛОГИКА ПОДАРКОВ ВНУТРИ КОМНАТЫ
// ==========================================
function listenToGiftsChanges() {
    if (!currentRoomId) return;
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
                    createdBy: data[key].createdBy || 'Аноним',
                    rating: data[key].rating || 3, // Рейтинг по умолчанию
                    buyers: data[key].buyers || {}
                });
            });
        }
        renderGifts();
    });
}

document.getElementById('add-gift-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('gift-title-input').value.trim();
    const price = document.getElementById('gift-price-input').value.trim();
    const imageUrl = document.getElementById('gift-image-input').value.trim();
    
    // Получаем выбранный рейтинг
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

function deleteGift(id) {
    remove(ref(db, `rooms/${currentRoomId}/gifts/${id}`));
}

// Новая логика для Большой Кнопки
function toggleBuyGift(giftId, isCurrentlyChecked) {
    const safeUsername = currentUser.replace(/[\.\$\#\[\]\/]/g, "_");
    const buyerRef = ref(db, `rooms/${currentRoomId}/gifts/${giftId}/buyers/${safeUsername}`);
    
    if (!isCurrentlyChecked) {
        set(buyerRef, true).then(() => triggerConfetti());
    } else {
        remove(buyerRef);
    }
}

// Сортировка
document.getElementById('search-input').addEventListener('input', (e) => { searchQuery = e.target.value.toLowerCase(); renderGifts(); });
document.getElementById('sort-select').addEventListener('change', (e) => { currentSort = e.target.value; renderGifts(); });

function renderGifts() {
    const container = document.getElementById('gifts-container');
    container.innerHTML = '';
    
    let processedGifts = giftsData.filter(g => g.title.toLowerCase().includes(searchQuery));
    
    if (currentSort === 'price-asc') processedGifts.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-desc') processedGifts.sort((a, b) => b.price - a.price);
    else if (currentSort === 'rating-desc') processedGifts.sort((a, b) => b.rating - a.rating); // Сортировка по звездам
    else {
        processedGifts.sort((a, b) => (a.buyers[currentUser] ? 1 : 0) - (b.buyers[currentUser] ? 1 : 0));
    }

    document.getElementById('total-count').textContent = giftsData.length;
    document.getElementById('user-count').textContent = giftsData.filter(g => g.buyers[currentUser]).length;

    if (processedGifts.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">Ничего не найдено</div>';
        return;
    }

    processedGifts.forEach(gift => {
        const isMeChecked = !!gift.buyers[currentUser];
        const card = document.createElement('div');
        card.className = 'gift-card';
        if (isMeChecked) card.style.borderColor = 'var(--success-color)';

        // Шапка карточки (Автор и Звезды)
        const headerDiv = document.createElement('div');
        headerDiv.className = 'gift-header';
        headerDiv.innerHTML = `
            <div class="gift-creator">От: <span style="color:${generateUserColor(gift.createdBy)}">${gift.createdBy}</span></div>
            <div class="gift-rating" title="Приоритет: ${gift.rating}/5">${renderStars(gift.rating)}</div>
        `;
        card.appendChild(headerDiv);

        if (gift.imageUrl) {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'gift-image-container';
            const img = document.createElement('img');
            img.src = gift.imageUrl;
            img.className = 'gift-image';
            img.onerror = () => imgContainer.style.display = 'none';
            imgContainer.appendChild(img);
            card.appendChild(imgContainer);
        }

        const titleSpan = document.createElement('div');
        titleSpan.className = 'gift-title';
        titleSpan.textContent = gift.title;
        card.appendChild(titleSpan);

        const priceDiv = document.createElement('div');
        priceDiv.className = 'gift-price';
        priceDiv.textContent = `${gift.price.toLocaleString('ru-RU')} ₽`;
        card.appendChild(priceDiv);

        // Теги тех, кто уже вписался
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

        // НОВАЯ БОЛЬШАЯ КНОПКА ПОКУПКИ
        const buyBtn = document.createElement('button');
        buyBtn.className = isMeChecked ? 'btn-buy-action active' : 'btn-buy-action';
        buyBtn.innerHTML = isMeChecked ? '✅ Вы покупаете это' : '🛍️ Хочу подарить';
        buyBtn.onclick = () => toggleBuyGift(gift.id, isMeChecked);
        card.appendChild(buyBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.innerHTML = '&#x2715;';
        deleteBtn.onclick = () => deleteGift(gift.id);
        card.appendChild(deleteBtn);

        container.appendChild(card);
    });
}

window.onload = init;
