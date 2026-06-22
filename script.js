// Импорт Firebase SDK модулей из CDN
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

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Состояние приложения
let currentUser = localStorage.getItem('wishlist_user') || '';
let giftsData = []; 
let currentTheme = localStorage.getItem('wishlist_theme') || 'light';
let searchQuery = '';
let currentSort = 'default';

// DOM элементы
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const currentUserDisplay = document.getElementById('current-user-display');
const logoutBtn = document.getElementById('logout-btn');
const themeToggle = document.getElementById('theme-toggle');
const addGiftForm = document.getElementById('add-gift-form');
const giftTitleInput = document.getElementById('gift-title-input');
const giftPriceInput = document.getElementById('gift-price-input');
const giftImageInput = document.getElementById('gift-image-input');
const giftsContainer = document.getElementById('gifts-container');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const totalCountEl = document.getElementById('total-count');
const userCountEl = document.getElementById('user-count');

// Инициализация темы и экрана при старте
function init() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentUser) { showAppScreen(); } else { showLoginScreen(); }
}

function showLoginScreen() {
    appScreen.classList.remove('active');
    loginScreen.classList.add('active');
}

function showAppScreen() {
    loginScreen.classList.remove('active');
    appScreen.classList.add('active');
    currentUserDisplay.textContent = currentUser;
    listenToGiftsChanges();
}

// Авторизация
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = usernameInput.value.trim();
    if (name) {
        currentUser = name;
        localStorage.setItem('wishlist_user', currentUser);
        usernameInput.value = '';
        showAppScreen();
    }
});

// Выход
logoutBtn.onclick = () => {
    localStorage.removeItem('wishlist_user');
    currentUser = '';
    showLoginScreen();
};

// Смена темы
themeToggle.onclick = () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('wishlist_theme', currentTheme);
};

// Генерация цвета из строки (для уникальных аватарок/тегов)
function generateUserColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 60%, 45%)`;
}

// Конфетти
function triggerConfetti() {
    confetti({ particleCount: 60, spread: 50, origin: { y: 0.8 } });
}

// ==========================================
// БАЗА ДАННЫХ И СИНХРОНИЗАЦИЯ
// ==========================================

function listenToGiftsChanges() {
    const giftsRef = ref(db, 'gifts');
    onValue(giftsRef, (snapshot) => {
        const data = snapshot.val();
        giftsData = [];
        if (data) {
            Object.keys(data).forEach(key => {
                giftsData.push({
                    id: key,
                    title: data[key].title,
                    price: Number(data[key].price) || 0,
                    imageUrl: data[key].imageUrl || '',
                    createdBy: data[key].createdBy || 'Аноним',
                    buyers: data[key].buyers || {}
                });
            });
        }
        renderGifts();
    });
}

// Добавление подарка
addGiftForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = giftTitleInput.value.trim();
    const price = giftPriceInput.value.trim();
    const imageUrl = giftImageInput.value.trim();

    if (title && price) {
        const giftsRef = ref(db, 'gifts');
        const newGiftRef = push(giftsRef);
        set(newGiftRef, {
            title: title,
            price: Number(price),
            imageUrl: imageUrl || null,
            createdBy: currentUser, // Запись автора
            buyers: {}
        }).then(() => {
            giftTitleInput.value = '';
            giftPriceInput.value = '';
            giftImageInput.value = '';
        }).catch(err => console.error(err));
    }
});

// Удаление
function deleteGift(id, cardElement) {
    cardElement.classList.add('fade-out');
    setTimeout(() => {
        remove(ref(db, `gifts/${id}`));
    }, 250);
}

// Переключение галочки покупки
function toggleBuyGift(id, isChecked) {
    const safeUsername = currentUser.replace(/[\.\$\#\[\]\/]/g, "_");
    const buyerRef = ref(db, `gifts/${id}/buyers/${safeUsername}`);
    if (isChecked) {
        set(buyerRef, true).then(() => triggerConfetti());
    } else {
        remove(buyerRef);
    }
}

// Сортировка и фильтрация (Excel-подобная логика)
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderGifts();
});

sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderGifts();
});

// ==========================================
// РЕНДЕРИНГ ЭЛЕМЕНТОВ
// ==========================================
function renderGifts() {
    giftsContainer.innerHTML = '';
    
    // 1. Поиск/Фильтрация
    let processedGifts = giftsData.filter(gift => gift.title.toLowerCase().includes(searchQuery));
    
    // 2. Умная Сортировка
    if (currentSort === 'price-asc') {
        processedGifts.sort((a, b) => a.price - b.price);
    } else if (currentSort === 'price-desc') {
        processedGifts.sort((a, b) => b.price - a.price);
    } else if (currentSort === 'title-asc') {
        processedGifts.sort((a, b) => a.title.localeCompare(b.title));
    } else if (currentSort === 'author-asc') {
        processedGifts.sort((a, b) => a.createdBy.localeCompare(b.createdBy));
    } else {
        // Дефолтная: Сначала не купленные мной, потом купленные мной
        processedGifts.sort((a, b) => {
            const aChecked = a.buyers[currentUser] ? 1 : 0;
            const bChecked = b.buyers[currentUser] ? 1 : 0;
            return aChecked - bChecked;
        });
    }

    // Обновление счетчиков
    let myMarked = giftsData.filter(gift => gift.buyers[currentUser]).length;
    totalCountEl.textContent = giftsData.length;
    userCountEl.textContent = myMarked;

    if (processedGifts.length === 0) {
        giftsContainer.innerHTML = '<div class="loading-placeholder">Ничего не найдено</div>';
        return;
    }

    // Отрисовка структуры карточки
    processedGifts.forEach(gift => {
        const isMeChecked = !!gift.buyers[currentUser];
        const card = document.createElement('div');
        card.className = 'gift-card';
        
        if (isMeChecked) {
            const userColor = generateUserColor(currentUser);
            card.style.borderColor = userColor;
            card.style.backgroundColor = `${userColor}05`;
        }

        // КОЛОНКА 1: Информация об авторе
        const creatorDiv = document.createElement('div');
        creatorDiv.className = 'gift-creator';
        creatorDiv.innerHTML = `Добавил(а): <span class="creator-name" style="color:${generateUserColor(gift.createdBy)}">${gift.createdBy}</span>`;
        card.appendChild(creatorDiv);

        // КОЛОНКА 2: Изображение
        if (gift.imageUrl) {
            const imgContainer = document.createElement('div');
            imgContainer.className = 'gift-image-container';
            const img = document.createElement('img');
            img.src = gift.imageUrl;
            img.className = 'gift-image';
            img.alt = gift.title;
            img.onerror = () => imgContainer.style.display = 'none'; // Скрыть, если ссылка сломалась
            imgContainer.appendChild(img);
            card.appendChild(imgContainer);
        }

        // КОЛОНКА 3: Название и Чекбокс
        const cardContent = document.createElement('div');
        cardContent.className = 'gift-card-content';
        
        const label = document.createElement('label');
        label.className = 'checkbox-container';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isMeChecked;
        checkbox.onclick = () => toggleBuyGift(gift.id, checkbox.checked);
        const checkmark = document.createElement('span');
        checkmark.className = 'checkmark';
        
        label.appendChild(checkbox);
        label.appendChild(checkmark);
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'gift-title';
        titleSpan.textContent = gift.title;
        
        cardContent.appendChild(label);
        cardContent.appendChild(titleSpan);
        card.appendChild(cardContent);

        // КОЛОНКА 4: Цена
        const priceDiv = document.createElement('div');
        priceDiv.className = 'gift-price';
        priceDiv.textContent = `${gift.price.toLocaleString('ru-RU')} ₽`;
        card.appendChild(priceDiv);

        // Кнопка удаления (доступна всем)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete';
        deleteBtn.innerHTML = '&#x2715;';
        deleteBtn.onclick = () => deleteGift(gift.id, card);
        card.appendChild(deleteBtn);

        // Теги покупателей
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

        giftsContainer.appendChild(card);
    });
}

window.onload = init;
