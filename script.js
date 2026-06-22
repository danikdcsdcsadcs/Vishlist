// Импорт необходимых модулей Firebase SDK из CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ==========================================
// КОНФИГУРАЦИЯ FIREBASE
// Замените плейсхолдеры ниже вашими данными из консоли Firebase
// ==========================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Константа роли администратора
const ADMIN_NAME = 'admin';

// Состояние приложения
let currentUser = localStorage.getItem('wishlist_user') || '';
let giftsData = []; // Локальный кэш данных из БД
let currentTheme = localStorage.getItem('wishlist_theme') || 'light';
let searchQuery = '';

// DOM Элементы
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username-input');
const currentUserDisplay = document.getElementById('current-user-display');
const logoutBtn = document.getElementById('logout-btn');
const themeToggle = document.getElementById('theme-toggle');
const adminPanel = document.getElementById('admin-panel');
const addGiftForm = document.getElementById('add-gift-form');
const giftTitleInput = document.getElementById('gift-title-input');
const giftsContainer = document.getElementById('gifts-container');
const searchInput = document.getElementById('search-input');
const totalCountEl = document.getElementById('total-count');
const userCountEl = document.getElementById('user-count');

// ==========================================
// ИНИЦИАЛИЗАЦИЯ И УПРАВЛЕНИЕ СЕССИЕЙ
// ==========================================

function init() {
    // Настройка темы
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    if (currentUser) {
        showAppScreen();
    } else {
        showLoginScreen();
    }
}

// Переключение на экран авторизации
function showLoginScreen() {
    appScreen.classList.remove('active');
    loginScreen.classList.add('active');
}

// Переключение на главный экран
function showAppScreen() {
    loginScreen.classList.remove('active');
    appScreen.classList.add('active');
    currentUserDisplay.textContent = currentUser;
    
    // Показ панели администратора, если имя совпадает
    if (currentUser.toLowerCase() === ADMIN_NAME.toLowerCase()) {
        adminPanel.classList.remove('hidden');
    } else {
        adminPanel.classList.add('hidden');
    }
    
    // Запуск real-time прослушивания базы данных
    listenToGiftsChanges();
}

// Хэндлер формы логина
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

// Выход из аккаунта
logoutBtn.addEventListener('logout-btn', () => {}); // Резерв
logoutBtn.onclick = () => {
    localStorage.removeItem('wishlist_user');
    currentUser = '';
    showLoginScreen();
};

// Переключение цветовой темы
themeToggle.onclick = () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('wishlist_theme', currentTheme);
};

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ UI
// ==========================================

// Генерация уникального HSL цвета на базе строки (имени пользователя)
function generateUserColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Используем фиксированную насыщенность и яркость для пастельного/приятного вида
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 65%, 50%)`;
}

// Генерация эффекта конфетти
function triggerConfetti() {
    confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.85 }
    });
}

// ==========================================
// РАБОТА С БАЗОЙ ДАННЫХ FIREBASE
// ==========================================

// Подписка на изменения данных в реальном времени
function listenToGiftsChanges() {
    const giftsRef = ref(db, 'gifts');
    onValue(giftsRef, (snapshot) => {
        const data = snapshot.val();
        giftsData = [];
        
        if (data) {
            // Превращаем объект Firebase в массив
            Object.keys(data).forEach(key => {
                giftsData.push({
                    id: key,
                    title: data[key].title,
                    buyers: data[key].buyers || {} // Объект вида { username: true }
                });
            });
        }
        renderGifts();
    });
}

// Добавление нового подарка (Только admin)
addGiftForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (currentUser.toLowerCase() !== ADMIN_NAME.toLowerCase()) return;
    
    const title = giftTitleInput.value.trim();
    if (title) {
        const giftsRef = ref(db, 'gifts');
        const newGiftRef = push(giftsRef);
        set(newGiftRef, {
            title: title,
            buyers: {}
        }).then(() => {
            giftTitleInput.value = '';
        }).catch(err => console.error("Ошибка добавления:", err));
    }
});

// Удаление подарка (Только admin)
function deleteGift(id, cardElement) {
    if (currentUser.toLowerCase() !== ADMIN_NAME.toLowerCase()) return;
    
    // Добавляем плавную анимацию исчезновения перед удалением из БД
    cardElement.classList.add('fade-out');
    setTimeout(() => {
        const giftRef = ref(db, `gifts/${id}`);
        remove(giftRef);
    }, 300);
}

// Переключение чекбокса "Купил"
function toggleBuyGift(id, isChecked) {
    // Заменяем недопустимые для ключей Firebase символы в имени пользователя
    const safeUsername = currentUser.replace(/[\.\$\#\[\]\/]/g, "_");
    const buyerRef = ref(db, `gifts/${id}/buyers/${safeUsername}`);
    
    if (isChecked) {
        set(buyerRef, true).then(() => {
            triggerConfetti();
        });
    } else {
        remove(buyerRef);
    }
}

// Изменение названия по двойному клику (Только admin)
function updateGiftTitle(id, newTitle) {
    if (!newTitle.trim()) return;
    const titleRef = ref(db, `gifts/${id}`);
    update(titleRef, { title: newTitle.trim() });
}

// ==========================================
// ОТРЕНДЕРИТЬ СПИСОК (ЛОГИКА И СОРТИРОВКА)
// ==========================================

// Поиск по списку
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderGifts();
});

function renderGifts() {
    giftsContainer.innerHTML = '';
    
    // Сортировка и фильтрация
    // 1. Фильтр по поисковому запросу
    let filteredGifts = giftsData.filter(gift => gift.title.toLowerCase().includes(searchQuery));
    
    // 2. Сортировка: Сначала неотмеченные текущим пользователем, потом отмеченные
    filteredGifts.sort((a, b) => {
        const aChecked = a.buyers[currentUser] ? 1 : 0;
        const bChecked = b.buyers[currentUser] ? 1 : 0;
        return aChecked - bChecked; 
    });
    
    // Обновление счетчиков в шапке
    let userCheckedCount = giftsData.filter(gift => gift.buyers[currentUser]).length;
    totalCountEl.textContent = giftsData.length;
    userCountEl.textContent = userCheckedCount;

    if (filteredGifts.length === 0) {
        giftsContainer.innerHTML = '<div class="loading-placeholder">Список пуст или ничего не найдено</div>';
        return;
    }

    // Создание элементов интерфейса
    filteredGifts.forEach(gift => {
        const isMeChecked = gift.buyers[currentUser] ? true : false;
        
        const card = document.createElement('div');
        card.className = 'gift-card';
        
        // Визуальная кастомизация карточки, если она куплена текущим пользователем
        if (isMeChecked) {
            const userColor = generateUserColor(currentUser);
            card.style.borderColor = userColor;
            card.style.backgroundColor = `${userColor}08`; // Легкий оттенок цвета пользователя на фон
        }
        
        // Контент карточки
        const cardContent = document.createElement('div');
        cardContent.className = 'gift-card-content';
        
        // Чекбокс
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
        
        // Текст (Название)
        const titleSpan = document.createElement('span');
        titleSpan.className = 'gift-title';
        titleSpan.textContent = gift.title;
        
        // Логика двойного клика для редактирования текста (для admin)
        if (currentUser.toLowerCase() === ADMIN_NAME.toLowerCase()) {
            titleSpan.title = "Двойной клик для редактирования";
            titleSpan.ondblclick = () => {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'edit-gift-input';
                input.value = titleSpan.textContent;
                
                const saveEdit = () => {
                    if (input.value.trim() && input.value.trim() !== gift.title) {
                        updateGiftTitle(gift.id, input.value);
                    } else {
                        titleSpan.textContent = gift.title;
                        input.replaceWith(titleSpan);
                    }
                };
                
                input.onkeydown = (e) => {
                    if (e.key === 'Enter') saveEdit();
                    if (e.key === 'Escape') {
                        titleSpan.textContent = gift.title;
                        input.replaceWith(titleSpan);
                    }
                };
                input.onblur = saveEdit;
                
                titleSpan.replaceWith(input);
                input.focus();
            };
        }
        
        cardContent.appendChild(label);
        cardContent.appendChild(titleSpan);
        card.appendChild(cardContent);
        
        // Кнопка удаления (для admin)
        if (currentUser.toLowerCase() === ADMIN_NAME.toLowerCase()) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete';
            deleteBtn.innerHTML = '&#x2715;';
            deleteBtn.onclick = () => deleteGift(gift.id, card);
            card.appendChild(deleteBtn);
        }
        
        // Список тех, кто отметили подарок
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

// Запуск приложения при загрузке страницы
window.onload = init;
