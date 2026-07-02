import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

let currentUser = localStorage.getItem('wishlist_user') || '';
let currentTheme = localStorage.getItem('wishlist_theme') || 'light';
let userAvatarEmoji = '🦊';
let userTitle = '👶 Новичок';
let userKarma = 0;
let roomsData = [];
let currentRoomId = null;
let currentRoomName = '';
let currentRoomCreator = '';
let giftsData = [];
let roomUsersList = []; 
let roomUsersAvatars = {}; 
let roomUsersTitles = {}; 
let displayNames = {}; 
let currentTab = 'wish'; 
let editGiftId = null; 
let customSections = {};
let isHubViewActive = true; 
let currentQuest = null;

let searchQuery = '';
let currentSort = 'default';
let currentUserFilter = 'all'; 

const PRESET_EMOJIS = ['🦊','🐱','🐻','🐼','🦁','🐸','🐵','🦄','🤖','🧙','🥷','🧑‍🚀','🐙','🐹','🐰','🐯'];
const PRESET_SECTIONS = ['wish', 'date', 'movie', 'completed'];

const SHOP_ITEMS = [
    { id: 'bg1', name: 'Обои: Темный Лес', type: 'bg', price: 200, val: '#1a2622' },
    { id: 'bg2', name: 'Обои: Закат', type: 'bg', price: 200, val: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
    { id: 'bg3', name: 'Обои: Космос', type: 'bg', price: 300, val: '#0f172a' },
    { id: 'bg_reset', name: 'Обои: По умолчанию', type: 'bg', price: 0, val: '' },
    { id: 'title1', name: 'Титул: 👑 Легенда', type: 'title', price: 500, val: '👑 Легенда' },
    { id: 'title2', name: 'Титул: 👻 Друг Духа', type: 'title', price: 300, val: '👻 Лучший друг Духа' }
];

const DOM = {
    screens: { login: document.getElementById('login-screen'), rooms: document.getElementById('rooms-screen'), app: document.getElementById('app-screen') },
    rooms: { container: document.getElementById('rooms-container'), userDisplay: document.getElementById('rooms-user-display'), avatar: document.getElementById('user-avatar') },
    app: { roomName: document.getElementById('current-room-name'), roomIdDisplay: document.getElementById('current-room-id'), startSantaBtn: document.getElementById('start-santa-btn'), usersCount: document.getElementById('room-users-count') },
    inputs: { username: document.getElementById('username-input'), password: document.getElementById('password-input') },
    gifts: { container: document.getElementById('gifts-container'), totalCount: document.getElementById('total-count'), filterSelect: document.getElementById('user-filter-select') },
    chat: { panel: document.getElementById('chat-panel'), messages: document.getElementById('chat-messages'), input: document.getElementById('chat-input') },
    todo: { panel: document.getElementById('todo-panel') }
};

const getSafeUserKey = (username) => username.replace(/[\.\$\#\[\]\/]/g, "_");
const escapeHTML = (str) => { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; };

window.getDisplayName = (login) => {
    if (!login) return 'Аноним';
    const safe = getSafeUserKey(login);
    return displayNames[safe] || login;
};

window.changeMyName = async () => {
    const currentName = getDisplayName(currentUser);
    const newName = prompt("Введите новое имя (оно будет отображаться везде вместо логина):", currentName);
    if (newName && newName.trim() !== "" && newName !== currentName) {
        const safeMe = getSafeUserKey(currentUser);
        await update(ref(db, `users/${safeMe}`), { displayName: newName.trim() });
        alert("Имя успешно изменено!");
    }
};

function generateUserColor(username) {
    if (!username) return '#000';
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

function init() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    buildEmojiPicker();
    if (currentUser) { loadUserProfile(); showRoomsScreen(); } else { showLoginScreen(); }
}

async function addKarma(amount) {
    const safeUser = getSafeUserKey(currentUser);
    const snap = await get(ref(db, `users/${safeUser}/karma`));
    let currentKarma = snap.val() || 0;
    currentKarma += amount;
    
    await update(ref(db, `users/${safeUser}`), { karma: currentKarma });
    
    // Моментально обновляем интерфейс для баланса
    userKarma = currentKarma;
    document.getElementById('user-karma-display').textContent = userKarma;
    document.getElementById('shop-karma-display').textContent = userKarma;
}

function loadUserProfile() {
    const safeUser = getSafeUserKey(currentUser);
    onValue(ref(db, `users/${safeUser}`), (snap) => {
        if(snap.exists()) {
            const data = snap.val();
            userAvatarEmoji = data.avatar || '🦊';
            userTitle = data.selectedTitle || '👶 Новичок';
            userKarma = data.karma || 0;
            
            DOM.rooms.avatar.textContent = userAvatarEmoji;
            document.getElementById('profile-current-avatar').textContent = userAvatarEmoji;
            document.getElementById('global-title').textContent = userTitle;
            DOM.rooms.userDisplay.textContent = data.displayName || currentUser;
            document.getElementById('user-karma-display').textContent = userKarma;
            document.getElementById('shop-karma-display').textContent = userKarma;
        }
    });
}

function buildEmojiPicker() {
    const box = document.getElementById('emoji-selector');
    if (!box) return;
    box.innerHTML = '';
    PRESET_EMOJIS.forEach(emoji => {
        const item = document.createElement('div');
        item.className = 'emoji-picker-item';
        item.textContent = emoji;
        item.onclick = async () => {
            if(currentUser) {
                await update(ref(db, `users/${getSafeUserKey(currentUser)}`), { avatar: emoji });
                document.getElementById('profile-current-avatar').textContent = emoji;
            }
        };
        box.appendChild(item);
    });
}

document.getElementById('open-profile-btn').onclick = () => {
    calculateAchievements();
    document.getElementById('profile-modal').classList.add('active');
};
document.querySelector('.close-profile-modal').onclick = () => document.getElementById('profile-modal').classList.remove('active');
document.querySelector('.close-other-profile-modal').onclick = () => document.getElementById('other-profile-modal').classList.remove('active');

function showLoginScreen() {
    DOM.screens.app.classList.remove('active'); DOM.screens.rooms.classList.remove('active'); DOM.screens.login.classList.add('active');
}
function showRoomsScreen() {
    document.body.style.background = '';
    DOM.screens.login.classList.remove('active'); DOM.screens.app.classList.remove('active'); DOM.screens.rooms.classList.add('active');
    loadUserProfile(); listenToRooms();
}

async function showAppScreen(roomId, roomName, roomCreator) {
    currentRoomId = roomId; currentRoomName = roomName; currentRoomCreator = roomCreator;
    DOM.app.roomName.textContent = roomName;
    DOM.app.startSantaBtn.style.display = (currentUser === roomCreator) ? 'inline-block' : 'none';
    DOM.app.roomIdDisplay.textContent = roomId;
    
    DOM.app.roomIdDisplay.onclick = async () => {
        try { await navigator.clipboard.writeText(roomId); DOM.app.roomIdDisplay.textContent = 'Скопировано!'; setTimeout(() => DOM.app.roomIdDisplay.textContent = roomId, 1500); } catch (err) { }
    };
    
    await set(ref(db, `rooms/${roomId}/users_count/${getSafeUserKey(currentUser)}`), currentUser);
    
    DOM.screens.rooms.classList.remove('active'); DOM.screens.app.classList.add('active');
    currentUserFilter = 'all'; DOM.gifts.filterSelect.value = 'all';
    isHubViewActive = true; 
    
    listenToRoomData(); listenToChat(); listenToSchedule(); checkDailyQuest();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = DOM.inputs.username.value.trim(); const pass = DOM.inputs.password.value.trim();
    if (!login || !pass) return;
    const safeLogin = getSafeUserKey(login);
    try {
        const snapshot = await get(ref(db, `users/${safeLogin}`));
        if (snapshot.exists()) {
            if (snapshot.val().password === pass) loginSuccess(login);
            else alert('Неверный пароль!');
        } else {
            await set(ref(db, `users/${safeLogin}`), { password: pass, avatar: '🦊', selectedTitle: '👶 Новичок', displayName: login, karma: 0 });
            alert('Аккаунт создан!'); loginSuccess(login);
        }
    } catch (error) { alert('Ошибка входа.'); }
});

function loginSuccess(login) { currentUser = login; localStorage.setItem('wishlist_user', currentUser); DOM.inputs.username.value = ''; DOM.inputs.password.value = ''; showRoomsScreen(); }
document.getElementById('logout-btn').onclick = () => { localStorage.removeItem('wishlist_user'); currentUser = ''; showLoginScreen(); };
document.getElementById('back-to-rooms-btn').onclick = () => { currentRoomId = null; showRoomsScreen(); };

const toggleTheme = () => { currentTheme = currentTheme === 'light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', currentTheme); localStorage.setItem('wishlist_theme', currentTheme); };
document.getElementById('theme-toggle-rooms').onclick = toggleTheme; document.getElementById('theme-toggle-app').onclick = toggleTheme;

function listenToRooms() {
    const safeUser = getSafeUserKey(currentUser);
    onValue(ref(db, `user_rooms/${safeUser}`), async (userRoomsSnap) => {
        const userRooms = userRoomsSnap.val() || {}; const roomIds = Object.keys(userRooms);
        if (roomIds.length === 0) { roomsData = []; renderRooms(); return; }
        try {
            const allRoomsSnap = await get(ref(db, 'rooms')); const allRooms = allRoomsSnap.val() || {};
            roomsData = [];
            for (const id of roomIds) { if (allRooms[id]) roomsData.push({ id, name: allRooms[id].name, createdBy: allRooms[id].createdBy }); else remove(ref(db, `user_rooms/${safeUser}/${id}`)); }
            renderRooms();
        } catch (e) { }
    });
}

document.getElementById('create-room-form').addEventListener('submit', async (e) => {
    e.preventDefault(); const nameInput = document.getElementById('room-name-input'); const name = nameInput.value.trim();
    if (name) {
        const newRoomRef = push(ref(db, 'rooms')); const roomId = newRoomRef.key;
        await set(newRoomRef, { 
            name, createdBy: currentUser,
            sections: {
                wish: { name: 'Хотелки', emoji: '🎁', reqPrice: true, reqLink: true, reqDur: false },
                date: { name: 'Свидания', emoji: '🥂', reqPrice: true, reqLink: false, reqDur: true },
                movie: { name: 'Фильмы', emoji: '🎬', reqPrice: false, reqLink: true, reqDur: true },
                completed: { name: 'Исполненное', emoji: '✅', reqPrice: true, reqLink: true, reqDur: false }
            },
            tamagochi: { health: 50, luck: 50, kindness: 50, anger: 10, name: 'Святой Дух' }
        });
        await set(ref(db, `user_rooms/${getSafeUserKey(currentUser)}/${roomId}`), true); nameInput.value = '';
    }
});

document.getElementById('join-room-form').addEventListener('submit', async (e) => {
    e.preventDefault(); const idInput = document.getElementById('room-id-input'); const roomId = idInput.value.trim();
    if (roomId) {
        const snapshot = await get(ref(db, `rooms/${roomId}`));
        if (snapshot.exists()) { await set(ref(db, `user_rooms/${getSafeUserKey(currentUser)}/${roomId}`), true); idInput.value = ''; alert('Вы в комнате!'); } else alert('Комната не найдена.');
    }
});

function renderRooms() {
    DOM.rooms.container.innerHTML = '';
    if (roomsData.length === 0) { DOM.rooms.container.innerHTML = '<div class="loading-placeholder">У вас нет комнат.</div>'; return; }
    roomsData.forEach(room => {
        const card = document.createElement('div'); card.className = 'room-card'; card.onclick = () => showAppScreen(room.id, room.name, room.createdBy);
        const infoDiv = document.createElement('div'); infoDiv.innerHTML = `<div class="room-title">${escapeHTML(room.name)}</div><div class="gift-creator">Создатель: ${escapeHTML(getDisplayName(room.createdBy))}</div>`;
        card.appendChild(infoDiv);
        if (room.createdBy === currentUser) {
            const btn = document.createElement('button'); btn.className = 'btn-delete'; btn.innerHTML = '&#x2715;';
            btn.onclick = async (e) => { e.stopPropagation(); if (confirm('Удалить комнату?')) await remove(ref(db, `rooms/${room.id}`)); };
            card.appendChild(btn);
        }
        DOM.rooms.container.appendChild(card);
    });
}

// СОЗДАНИЕ РАЗДЕЛОВ
document.getElementById('btn-show-add-section').onclick = () => {
    const panel = document.getElementById('add-section-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

document.getElementById('btn-add-custom-field').onclick = () => {
    const container = document.getElementById('custom-fields-container');
    const fieldDiv = document.createElement('div');
    fieldDiv.style.cssText = 'display:flex; gap:10px; align-items:center; background: var(--bg-main); padding: 8px; border-radius: 8px;';
    fieldDiv.innerHTML = `
        <input type="text" class="custom-field-name" placeholder="Название поля" required style="flex:1; margin-bottom:0; padding:0.5rem;">
        <select class="custom-field-type" style="width:110px; margin-bottom:0; padding:0.5rem;">
            <option value="text">Текст</option>
            <option value="number">Число</option>
            <option value="url">Ссылка</option>
        </select>
        <label style="font-size: 0.8rem; display:flex; align-items:center; gap:4px; margin:0;">
            <input type="checkbox" class="custom-field-req"> Важно
        </label>
        <button type="button" class="btn-delete" onclick="this.parentElement.remove()" style="width:28px;height:28px;padding:0;margin:0;">✖</button>
    `;
    container.appendChild(fieldDiv);
};

document.getElementById('create-custom-section-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-section-name').value.trim();
    const emoji = document.getElementById('new-section-emoji').value.trim();
    
    if(name && emoji) {
        const cleanKey = 'custom_' + Date.now();
        await set(ref(db, `rooms/${currentRoomId}/sections/${cleanKey}`), { 
            name, emoji, reqPrice: false, reqLink: false, reqDur: false, fields: [] 
        });
        
        document.getElementById('new-section-name').value = ''; 
        document.getElementById('new-section-emoji').value = '';
        document.getElementById('custom-fields-container').innerHTML = '';
        document.getElementById('add-section-panel').style.display = 'none';
        
        alert("Раздел успешно создан!");
    }
});

// КВЕСТЫ: Более частая генерация
async function checkDailyQuest() {
    const questRef = ref(db, `rooms/${currentRoomId}/quest`);
    const snap = await get(questRef);
    let q = snap.val();

    if (!q || q.done) {
        const types = [
            { id: 'add_gifts', text: 'Добавить 2 карточки в раздел', goal: 2 },
            { id: 'add_schedule', text: 'Записать 1 дело в Расписание', goal: 1 },
            { id: 'buy_gift', text: 'Взяться или скинуться на 1 желание', goal: 1 }
        ];
        const randomQ = types[Math.floor(Math.random() * types.length)];
        q = { type: randomQ.id, text: randomQ.text, goal: randomQ.goal, progress: 0, done: false };
        await set(questRef, q);
    }

    onValue(questRef, (snapshot) => {
        currentQuest = snapshot.val();
        if (currentQuest && !currentQuest.done) {
            document.getElementById('quest-banner').style.display = 'flex';
            document.getElementById('quest-banner').style.opacity = '1';
            document.getElementById('quest-text').textContent = currentQuest.text;
            document.getElementById('quest-count').textContent = `${currentQuest.progress}/${currentQuest.goal}`;
            const perc = Math.min(100, (currentQuest.progress / currentQuest.goal) * 100);
            document.getElementById('quest-progress-bar').style.width = `${perc}%`;
            
            document.getElementById('quest-banner').style.borderColor = '#fcc419';
            document.getElementById('quest-progress-bar').style.background = '#fcc419';
        } else if (currentQuest && currentQuest.done) {
             document.getElementById('quest-text').textContent = "✅ Квест выполнен! +100 🪙 зачислено!";
             document.getElementById('quest-banner').style.borderColor = 'var(--success-color)';
             document.getElementById('quest-progress-bar').style.background = 'var(--success-color)';
             document.getElementById('quest-progress-bar').style.width = '100%';
             
             // Исчезает и регенерирует новый квест
             setTimeout(async () => {
                 document.getElementById('quest-banner').style.opacity = '0';
                 setTimeout(async () => {
                     document.getElementById('quest-banner').style.display = 'none';
                     await remove(ref(db, `rooms/${currentRoomId}/quest`));
                     checkDailyQuest(); // Генерируем сразу новый
                 }, 500);
             }, 2500);
        } else {
             document.getElementById('quest-banner').style.display = 'none';
        }
    });
}

async function updateQuestProgress(actionType) {
    if (!currentQuest || currentQuest.done || currentQuest.type !== actionType) return;
    const newProg = currentQuest.progress + 1;
    let isDone = newProg >= currentQuest.goal;
    
    await update(ref(db, `rooms/${currentRoomId}/quest`), { progress: newProg, done: isDone });
    
    if (isDone) {
        triggerTamagochiChange('luck', 15);
        triggerTamagochiChange('kindness', 15);
        await addKarma(100); // Баланс пополняется моментально!
        pushSpiritMessage("🎉 Кто-то выполнил квест! Я чувствую прилив сил и дарю 100 🪙!");
    }
}

// ТАМАГОЧИ И СООБЩЕНИЯ
async function triggerTamagochiChange(stat, value) {
    if(!currentRoomId) return;
    const petRef = ref(db, `rooms/${currentRoomId}/tamagochi`);
    const snap = await get(petRef);
    let pet = snap.val() || { health: 50, luck: 50, kindness: 50, anger: 10, name: 'Дух' };
    
    if(stat === 'anger') pet.anger = Math.min(100, Math.max(0, pet.anger + value));
    if(stat === 'kindness') pet.kindness = Math.min(100, Math.max(0, pet.kindness + value));
    if(stat === 'luck') pet.luck = Math.min(100, Math.max(0, pet.luck + value));
    if(stat === 'health') pet.health = Math.min(100, Math.max(0, pet.health + value));

    await set(petRef, pet);
}

async function pushSpiritMessage(text) {
    if(!currentRoomId) return;
    await push(ref(db, `rooms/${currentRoomId}/messages`), { 
        sender: 'spirit', text: text, timestamp: Date.now(), isSpirit: true 
    });
}

document.getElementById('edit-spirit-btn').onclick = async () => {
    const newName = prompt('Придумайте имя для Духа Комнаты:');
    if (newName && newName.trim().length > 0) {
        await update(ref(db, `rooms/${currentRoomId}/tamagochi`), { name: newName.trim() });
    }
};

function updateTamagochiWidget(pet) {
    document.getElementById('bar-health').style.width = `${pet.health}%`;
    document.getElementById('bar-luck').style.width = `${pet.luck}%`;
    document.getElementById('bar-kind').style.width = `${pet.kindness}%`;
    document.getElementById('bar-anger').style.width = `${pet.anger}%`;

    const petEmoji = document.getElementById('pet-emoji');
    const petStatus = document.getElementById('pet-status');
    const petCustomName = document.getElementById('spirit-custom-name');

    if (pet.anger > 70) { petEmoji.textContent = '🤬'; petStatus.textContent = 'В ярости'; }
    else if (pet.health < 30) { petEmoji.textContent = '🤢'; petStatus.textContent = 'Болеет'; }
    else if (pet.kindness > 70) { petEmoji.textContent = '😇'; petStatus.textContent = 'Святой'; }
    else if (pet.luck > 70) { petEmoji.textContent = '👑'; petStatus.textContent = 'Богач'; }
    else { petEmoji.textContent = '🦊'; petStatus.textContent = 'Доволен'; }

    petCustomName.textContent = pet.name || 'Дух Комнаты';
}

// МАГАЗИН ДУХА
document.getElementById('btn-open-shop').onclick = () => {
    const container = document.getElementById('shop-items-container');
    container.innerHTML = '';
    SHOP_ITEMS.forEach(item => {
        const div = document.createElement('div'); div.className = 'shop-item';
        div.innerHTML = `
            <div class="shop-item-info"><strong>${item.name}</strong><span>${item.type === 'bg' ? 'Обои комнаты' : 'Титул в профиль'}</span></div>
            <button class="btn-primary" style="padding: 0.4rem 1rem; font-size:0.85rem;" ${userKarma < item.price ? 'disabled' : ''}>${item.price} 🪙</button>
        `;
        div.querySelector('button').onclick = async () => {
            if (userKarma >= item.price) {
                if (confirm(`Купить "${item.name}" за ${item.price} монет?`)) {
                    await addKarma(-item.price);
                    if (item.type === 'bg') { await update(ref(db, `rooms/${currentRoomId}/settings`), { background: item.val }); }
                    if (item.type === 'title') { await update(ref(db, `users/${getSafeUserKey(currentUser)}`), { selectedTitle: item.val }); }
                    alert('Успешная покупка!'); document.getElementById('shop-modal').classList.remove('active');
                }
            }
        };
        container.appendChild(div);
    });
    document.getElementById('shop-modal').classList.add('active');
};

function calculateRoomCoinsTotal(usersData) {
    if (!roomUsersList || !usersData) return;
    let sum = 0;
    roomUsersList.forEach(username => {
        const safe = getSafeUserKey(username);
        if (usersData[safe]) sum += (usersData[safe].karma || 0);
    });
    const totalCoinsEl = document.getElementById('room-coins-total');
    if (totalCoinsEl) totalCoinsEl.textContent = sum;
}

function listenToRoomData() {
    if (!currentRoomId) return;

    onValue(ref(db, `rooms/${currentRoomId}/settings/background`), (snap) => {
        const bg = snap.val();
        if (bg) document.body.style.background = bg;
        else document.body.style.background = '';
    });

    onValue(ref(db, `rooms/${currentRoomId}/sectionOrder`), (snap) => {
        window.currentSectionOrder = snap.val() || [];
        if (!isHubViewActive) buildTabsSystem(); 
    });

    onValue(ref(db, `users`), (snap) => {
        const users = snap.val() || {};
        roomUsersAvatars = {}; roomUsersTitles = {}; displayNames = {};
        Object.keys(users).forEach(k => { 
            roomUsersAvatars[k] = users[k].avatar || '🦊'; 
            roomUsersTitles[k] = users[k].selectedTitle || '👶 Новичок';
            displayNames[k] = users[k].displayName || k;
        });
        calculateRoomCoinsTotal(users);
        if (!isHubViewActive) renderGifts();
    });

    onValue(ref(db, `rooms/${currentRoomId}/sections`), (snapshot) => {
        const defaultSections = {
            wish: { name: 'Хотелки', emoji: '🎁', reqPrice: true, reqLink: true, reqDur: false },
            date: { name: 'Свидания', emoji: '🥂', reqPrice: true, reqLink: false, reqDur: true },
            movie: { name: 'Фильмы', emoji: '🎬', reqPrice: false, reqLink: true, reqDur: true },
            completed: { name: 'Исполненное', emoji: '✅', reqPrice: true, reqLink: true, reqDur: false }
        };
        const dbSections = snapshot.val() || {};
        customSections = { ...defaultSections, ...dbSections };
        buildTabsSystem();
    });

    onValue(ref(db, `rooms/${currentRoomId}/tamagochi`), (snapshot) => {
        const pet = snapshot.val() || { health: 50, luck: 50, kindness: 50, anger: 10, name: 'Святой Дух' };
        updateTamagochiWidget(pet);
    });

    onValue(ref(db, `rooms/${currentRoomId}/gifts`), (snapshot) => {
        giftsData = []; const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(key => {
                giftsData.push({
                    id: key, type: data[key].type || 'wish', title: data[key].title, 
                    price: Number(data[key].price) || 0, imageUrl: data[key].imageUrl || '', 
                    linkUrl: data[key].linkUrl || '', duration: data[key].duration || '',
                    note: data[key].note || '', createdBy: data[key].createdBy,
                    rating: data[key].rating || 3, buyers: data[key].buyers || {},
                    contributors: data[key].contributors || {}
                });
            });
        }
        updateUserFilterDropdown(); 
        if (isHubViewActive) buildTabsSystem(); else renderGifts();
    });

    onValue(ref(db, `rooms/${currentRoomId}/users_count`), (snapshot) => {
        roomUsersList = snapshot.val() ? Object.values(snapshot.val()) : [];
        if (DOM.app.usersCount) DOM.app.usersCount.textContent = roomUsersList.length;
        updateUserFilterDropdown();
    });
}

// Построение вкладок (Разделы) с Drag & Drop
function buildTabsSystem() {
    const wrapper = document.getElementById('tabs-wrapper');
    wrapper.innerHTML = '';
    
    let keys = Object.keys(customSections);
    const sortOrder = window.currentSectionOrder || [];
    
    // Сортировка на основе сохраненного порядка (D&D)
    keys.sort((a, b) => {
        let indexA = sortOrder.indexOf(a);
        let indexB = sortOrder.indexOf(b);
        if(indexA === -1) indexA = 999;
        if(indexB === -1) indexB = 999;
        return indexA - indexB;
    });

    const addCardPanel = document.getElementById('add-card-panel');

    if (isHubViewActive) {
        if (addCardPanel) addCardPanel.style.display = 'none';
        renderSectionsHub();
    } else {
        if (addCardPanel) addCardPanel.style.display = 'block';
        document.getElementById('sections-hub-grid').style.display = 'none';
        document.getElementById('active-tab-content-area').style.display = 'block';

        const hubBtn = document.createElement('button');
        hubBtn.className = 'tab-btn';
        hubBtn.innerHTML = '🗂️ Все разделы';
        hubBtn.onclick = () => { isHubViewActive = true; buildTabsSystem(); };
        wrapper.appendChild(hubBtn);

        keys.forEach(key => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${currentTab === key ? 'active' : ''}`;
            btn.innerHTML = `<span>${customSections[key].emoji} ${customSections[key].name}</span>`;
            
            // Настройка Drag & Drop
            btn.draggable = true;
            btn.dataset.key = key;

            btn.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', key);
                setTimeout(() => btn.classList.add('dragging'), 0);
            });
            btn.addEventListener('dragend', () => btn.classList.remove('dragging'));
            btn.addEventListener('dragover', (e) => {
                e.preventDefault();
                btn.classList.add('drag-over');
            });
            btn.addEventListener('dragleave', () => btn.classList.remove('drag-over'));
            btn.addEventListener('drop', async (e) => {
                e.preventDefault();
                btn.classList.remove('drag-over');
                const draggedKey = e.dataTransfer.getData('text/plain');
                const targetKey = key;
                if (draggedKey && draggedKey !== targetKey) {
                    let newOrder = keys.filter(k => k !== draggedKey);
                    const targetIndex = newOrder.indexOf(targetKey);
                    newOrder.splice(targetIndex, 0, draggedKey);
                    await set(ref(db, `rooms/${currentRoomId}/sectionOrder`), newOrder);
                    buildTabsSystem();
                }
            });

            if (!PRESET_SECTIONS.includes(key)) {
                const delIcon = document.createElement('span');
                delIcon.innerHTML = '❌';
                delIcon.className = 'btn-delete-section';
                delIcon.onclick = async (e) => {
                    e.stopPropagation();
                    if (confirm('Удалить этот раздел?')) {
                        await remove(ref(db, `rooms/${currentRoomId}/sections/${key}`));
                        isHubViewActive = true;
                        buildTabsSystem();
                    }
                };
                btn.appendChild(delIcon);
            }

            btn.onclick = () => { currentTab = key; isHubViewActive = false; buildTabsSystem(); applySectionConfig(); renderGifts(); };
            wrapper.appendChild(btn);
        });
        applySectionConfig(); renderGifts();
    }
}

function applySectionConfig() {
    const activeSec = customSections[currentTab];
    if (!activeSec) return;
    
    document.getElementById('gift-price-input').style.display = activeSec.reqPrice !== false ? 'block' : 'none';
    if(activeSec.reqPrice === false) document.getElementById('gift-price-input').removeAttribute('required');
    else document.getElementById('gift-price-input').setAttribute('required', 'true');

    document.getElementById('gift-link-input').style.display = activeSec.reqLink !== false ? 'block' : 'none';
    document.getElementById('gift-duration-input').style.display = activeSec.reqDur === true ? 'block' : 'none';
}

function renderSectionsHub() {
    const hubGrid = document.getElementById('sections-hub-grid');
    hubGrid.innerHTML = ''; hubGrid.style.display = 'grid';
    document.getElementById('active-tab-content-area').style.display = 'none';

    let keys = Object.keys(customSections);
    const sortOrder = window.currentSectionOrder || [];
    keys.sort((a, b) => {
        let indexA = sortOrder.indexOf(a); let indexB = sortOrder.indexOf(b);
        if(indexA === -1) indexA = 999; if(indexB === -1) indexB = 999;
        return indexA - indexB;
    });

    keys.forEach(key => {
        const count = giftsData.filter(g => {
            const hasBuyers = g.buyers && Object.keys(g.buyers).length > 0;
            return key === 'completed' ? hasBuyers : (g.type === key && !hasBuyers);
        }).length;
        const block = document.createElement('div'); block.className = 'section-hub-block';
        block.innerHTML = `<div class="hub-emoji">${customSections[key].emoji}</div><div class="hub-name">${customSections[key].name}</div><div class="hub-count">Карточек: ${count}</div>`;
        block.onclick = () => { currentTab = key; isHubViewActive = false; buildTabsSystem(); };
        hubGrid.appendChild(block);
    });
}

function updateUserFilterDropdown() {
    if (!DOM.gifts.filterSelect) return; const currentVal = DOM.gifts.filterSelect.value;
    DOM.gifts.filterSelect.innerHTML = '<option value="all">👥 Все участники</option>';
    const uniqueUsers = new Set(); if (currentUser) uniqueUsers.add(currentUser);
    if (Array.isArray(roomUsersList)) roomUsersList.forEach(u => { if (u) uniqueUsers.add(u); });
    if (Array.isArray(giftsData)) giftsData.forEach(g => { if (g && g.createdBy) uniqueUsers.add(g.createdBy); });
    const sortedUsers = Array.from(uniqueUsers).filter(u => typeof u === 'string').sort((a, b) => a.localeCompare(b));
    sortedUsers.forEach(user => { const opt = document.createElement('option'); opt.value = user; opt.textContent = `👤 ${getDisplayName(user)}`; DOM.gifts.filterSelect.appendChild(opt); });
    if (uniqueUsers.has(currentVal)) { DOM.gifts.filterSelect.value = currentVal; currentUserFilter = currentVal; }
    else { DOM.gifts.filterSelect.value = 'all'; currentUserFilter = 'all'; }
}

// ДОБАВЛЕНИЕ КАРТОЧЕК
document.getElementById('add-gift-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(isHubViewActive && currentTab === 'completed') { alert('Нельзя добавлять карточки в архив "Исполненное" напрямую!'); return; }
    const title = document.getElementById('gift-title-input').value.trim();
    let price = document.getElementById('gift-price-input').value.trim();
    const imageUrl = document.getElementById('gift-image-input').value.trim();
    const linkUrl = document.getElementById('gift-link-input').value.trim();
    const duration = document.getElementById('gift-duration-input').value.trim();
    const note = document.getElementById('gift-note-input').value.trim();
    
    if (note.split(/\s+/).length > 50) return alert("Примечание должно быть не длиннее 50 слов!");
    const rating = parseInt(document.querySelector('input[name="rating"]:checked')?.value || 3);
    
    const activeSec = customSections[currentTab];
    if (activeSec && activeSec.reqPrice === false) price = 0;

    if (title) {
        await push(ref(db, `rooms/${currentRoomId}/gifts`), {
            type: currentTab, title, price: Number(price), imageUrl: imageUrl || null, 
            linkUrl: linkUrl || null, duration: duration || null, note, createdBy: currentUser, rating, buyers: {}, contributors: {}
        });
        await triggerTamagochiChange('luck', 4); 
        await updateQuestProgress('add_gifts'); // Проверка квеста
        document.getElementById('add-gift-form').reset();
    }
});

// АНИМАЦИЯ РАНДОМАЙЗЕРА
document.getElementById('btn-random-card').onclick = async () => {
    const cards = document.querySelectorAll('.gift-card');
    if (cards.length === 0) { alert('Нет карточек для выбора!'); return; }

    let times = 0;
    const maxTimes = 20; 
    let currentInterval = 100;

    const runRandomizer = () => {
        cards.forEach(c => c.classList.remove('highlight'));
        const randomIndex = Math.floor(Math.random() * cards.length);
        const randomCard = cards[randomIndex];
        randomCard.classList.add('highlight');
        
        // Скроллим так, чтобы карточка была видна
        randomCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

        times++;
        if (times < maxTimes) {
            currentInterval += (times * 5); // Эффект замедления рулетки
            setTimeout(runRandomizer, currentInterval);
        } else {
            // Остановка
            if (typeof confetti === 'function') confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
            setTimeout(() => { randomCard.classList.remove('highlight'); }, 3000);
        }
    };
    runRandomizer();
};

async function toggleBuyGift(giftId, isCurrentlyChecked) {
    const safeUsername = getSafeUserKey(currentUser);
    const buyerRef = ref(db, `rooms/${currentRoomId}/gifts/${giftId}/buyers/${safeUsername}`);
    if (!isCurrentlyChecked) {
        await set(buyerRef, true); 
        await triggerTamagochiChange('kindness', 10); 
        await triggerTamagochiChange('anger', -12);
        await updateQuestProgress('buy_gift'); // Проверка квеста
        if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 60, origin: { y: 0.8 } });
    } else {
        await remove(buyerRef); await triggerTamagochiChange('anger', 8);
    }
}

// СКИНУТЬСЯ (Chip In)
async function toggleChipIn(giftId, isCurrentlyContributor) {
    const safeUsername = getSafeUserKey(currentUser);
    const contribRef = ref(db, `rooms/${currentRoomId}/gifts/${giftId}/contributors/${safeUsername}`);
    if (!isCurrentlyContributor) {
        await set(contribRef, true);
        await triggerTamagochiChange('kindness', 5);
        await updateQuestProgress('buy_gift'); // Тоже засчитываем квест
        if (typeof confetti === 'function') confetti({ particleCount: 50, spread: 40 });
    } else {
        await remove(contribRef);
    }
}

document.getElementById('search-input').addEventListener('input', (e) => { searchQuery = e.target.value.toLowerCase(); renderGifts(); });
document.getElementById('sort-select').addEventListener('change', (e) => { currentSort = e.target.value; renderGifts(); });
DOM.gifts.filterSelect.addEventListener('change', (e) => { currentUserFilter = e.target.value; renderGifts(); });

function renderGifts() {
    DOM.gifts.container.innerHTML = '';
    if (isHubViewActive) return;

    let processedGifts = giftsData.filter(g => g.title.toLowerCase().includes(searchQuery));
    if (currentUserFilter !== 'all') processedGifts = processedGifts.filter(g => g.createdBy === currentUserFilter);
    
    processedGifts = processedGifts.filter(g => {
        const hasBuyers = g.buyers && Object.keys(g.buyers).length > 0;
        return currentTab === 'completed' ? hasBuyers : (g.type === currentTab && !hasBuyers);
    });
    
    if (currentSort === 'price-asc') processedGifts.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-desc') processedGifts.sort((a, b) => b.price - a.price);
    else if (currentSort === 'rating-desc') processedGifts.sort((a, b) => b.rating - a.rating);

    DOM.gifts.totalCount.textContent = processedGifts.length;

    const totalCost = processedGifts.reduce((acc, curr) => acc + curr.price, 0);
    const usersCount = roomUsersList.length || 1;
    document.querySelector('#section-cost-summary').innerHTML = `💰 Общая стоимость: <span>${totalCost.toLocaleString('ru-RU')} ₽</span> | На человека: <span>${Math.round(totalCost / usersCount).toLocaleString('ru-RU')} ₽</span>`;

    if (processedGifts.length === 0) { DOM.gifts.container.innerHTML = '<div class="loading-placeholder">В этом разделе пока пусто</div>'; return; }

    processedGifts.forEach(gift => {
        const safeUsername = getSafeUserKey(currentUser);
        const isMeChecked = !!(gift.buyers && gift.buyers[safeUsername]);
        const contributors = gift.contributors || {};
        const isMeContributor = !!contributors[safeUsername];

        const card = document.createElement('div'); 
        card.className = 'gift-card';
        if (isMeChecked) card.style.borderColor = 'var(--success-color)';

        let stars = ''; for(let i=1; i<=5; i++) stars += i <= gift.rating ? '★' : '☆';
        const creatorSafeKey = getSafeUserKey(gift.createdBy);
        const creatorAvatar = roomUsersAvatars[creatorSafeKey] || '🦊';

        let imageHtml = '';
        if (gift.imageUrl) {
            imageHtml = `
                <div class="gift-image-container">
                    <img src="${escapeHTML(gift.imageUrl)}" class="gift-image" alt="Фото" id="img-${gift.id}">
                </div>`;
        }

        let priceHtml = gift.price > 0 ? `<div class="gift-price">${gift.price.toLocaleString('ru-RU')} ₽</div>` : '';
        let durationHtml = gift.duration ? `<div class="gift-meta-field">⏱️ Длительность: <b>${escapeHTML(gift.duration)}</b></div>` : '';
        let linkHtml = gift.linkUrl ? `<div class="gift-meta-field">🛒 Ссылка: <a href="${escapeHTML(gift.linkUrl)}" target="_blank" rel="noopener noreferrer">Перейти в магазин →</a></div>` : '';
        let noteHtml = gift.note ? `<div class="gift-note">📝 ${escapeHTML(gift.note)}</div>` : '';

        card.innerHTML = `
            <div class="gift-header">
                <div class="gift-creator"><span class="avatar-mini">${creatorAvatar}</span> <b>${escapeHTML(getDisplayName(gift.createdBy))}</b></div>
                <div style="color:var(--star-color); margin-right: 60px;">${stars}</div>
            </div>
            ${imageHtml}
            <div class="gift-title">${escapeHTML(gift.title)}</div>
            ${priceHtml}
            ${durationHtml}
            ${linkHtml}
            ${noteHtml}
        `;

        // Отрисовка списка тех, кто "скидывается"
        const contribDiv = document.createElement('div');
        contribDiv.className = 'gift-contributors';
        if (Object.keys(contributors).length > 0) {
            const names = Object.keys(contributors).map(c => `<span class="contributor-tag">${getDisplayName(c)}</span>`).join('');
            contribDiv.innerHTML = `<div style="font-size:0.8rem; margin-bottom: 5px;">💸 Скидываются: ${names}</div>`;
        }
        card.appendChild(contribDiv);

        if (gift.imageUrl) {
            const imgEl = card.querySelector(`#img-${gift.id}`);
            if (imgEl) {
                imgEl.onclick = (e) => {
                    e.stopPropagation();
                    document.getElementById('lightbox-img').src = gift.imageUrl; 
                    document.getElementById('lightbox-modal').classList.add('active'); 
                };
                imgEl.onerror = () => {
                    const container = imgEl.closest('.gift-image-container');
                    if (container) container.style.display = 'none';
                };
            }
        }

        if (gift.createdBy === currentUser || currentRoomCreator === currentUser) {
            const actionsDiv = document.createElement('div'); 
            actionsDiv.className = 'action-buttons';
            
            const editBtn = document.createElement('button'); 
            editBtn.className = 'btn-edit-card'; editBtn.innerHTML = '✏️';
            editBtn.onclick = (e) => { e.stopPropagation(); openEditModal(gift); };
            actionsDiv.appendChild(editBtn);
            
            const deleteBtn = document.createElement('button'); 
            deleteBtn.className = 'btn-delete'; deleteBtn.innerHTML = '&#x2715;';
            deleteBtn.onclick = async (e) => { e.stopPropagation(); if (confirm('Удалить карточку?')) await remove(ref(db, `rooms/${currentRoomId}/gifts/${gift.id}`)); };
            actionsDiv.appendChild(deleteBtn); 
            card.appendChild(actionsDiv);
        }

        // Блок кнопок (Взяться / Скинуться)
        const actionsRow = document.createElement('div');
        actionsRow.style.display = 'flex';
        actionsRow.style.gap = '10px';
        actionsRow.style.marginTop = '10px';

        const buyBtn = document.createElement('button'); 
        buyBtn.className = isMeChecked ? 'btn-buy-action active' : 'btn-buy-action';
        buyBtn.style.flex = '1';
        buyBtn.innerHTML = isMeChecked ? '✅ Взял(а)' : '🛍️ Взяться';
        buyBtn.onclick = (e) => { e.stopPropagation(); toggleBuyGift(gift.id, isMeChecked); };

        const chipInBtn = document.createElement('button');
        chipInBtn.className = isMeContributor ? 'btn-buy-action active' : 'btn-buy-action';
        chipInBtn.style.flex = '1';
        chipInBtn.style.borderColor = '#fcc419';
        chipInBtn.style.color = isMeContributor ? '#fff' : '#f59f00';
        if (isMeContributor) chipInBtn.style.backgroundColor = '#fcc419';
        chipInBtn.innerHTML = isMeContributor ? '💸 Я в доле' : '🤝 Скинуться';
        chipInBtn.onclick = (e) => { e.stopPropagation(); toggleChipIn(gift.id, isMeContributor); };

        actionsRow.appendChild(buyBtn);
        actionsRow.appendChild(chipInBtn);
        card.appendChild(actionsRow);

        DOM.gifts.container.appendChild(card);
    });
}

function openEditModal(gift) {
    editGiftId = gift.id;
    document.getElementById('edit-title').value = gift.title; document.getElementById('edit-price').value = gift.price;
    document.getElementById('edit-image').value = gift.imageUrl || ''; document.getElementById('edit-link').value = gift.linkUrl || '';
    document.getElementById('edit-duration').value = gift.duration || ''; document.getElementById('edit-note').value = gift.note || '';
    document.getElementById('edit-modal').classList.add('active');
}
document.querySelector('.close-modal').onclick = () => { document.getElementById('edit-modal').classList.remove('active'); editGiftId = null; };

document.getElementById('edit-gift-form').addEventListener('submit', async (e) => {
    e.preventDefault(); if (!editGiftId) return;
    const title = document.getElementById('edit-title').value.trim(); const price = Number(document.getElementById('edit-price').value.trim());
    const imageUrl = document.getElementById('edit-image').value.trim(); const linkUrl = document.getElementById('edit-link').value.trim();
    const duration = document.getElementById('edit-duration').value.trim(); const note = document.getElementById('edit-note').value.trim();

    if (note.split(/\s+/).length > 50) return alert('Примечание не более 50 слов!');
    try { 
        await update(ref(db, `rooms/${currentRoomId}/gifts/${editGiftId}`), { title, price, imageUrl, linkUrl, duration, note }); 
        document.getElementById('edit-modal').classList.remove('active'); editGiftId = null; 
    } catch (error) { console.error("Ошибка:", error); }
});

// ДОСТИЖЕНИЯ И ПРОФИЛЬ
function calculateAchievements() {
    const list = document.getElementById('profile-achievements-list');
    const titlesList = document.getElementById('profile-titles-list');
    list.innerHTML = ''; titlesList.innerHTML = '';
    
    const myCreatedCount = giftsData.filter(g => g.createdBy === currentUser).length;
    let myGivenCount = 0;
    giftsData.forEach(g => { if(g.buyers && g.buyers[getSafeUserKey(currentUser)]) myGivenCount++; });

    const achievements = [];
    const availableTitles = ['👶 Новичок'];

    if(myCreatedCount >= 1) achievements.push({ text: '💡 Искорка', desc: 'Добавил свою первую хотелку' });
    if(myCreatedCount >= 5) availableTitles.push('📝 Архивариус Желаний');
    if(myCreatedCount >= 10) achievements.push({ text: '👑 Генератор Идей', desc: 'Добавил более 10 хотелок' });
    if(myCreatedCount >= 25) { achievements.push({ text: '🐉 Дракон Желаний', desc: 'Собрал гору сокровищ в вишлисте (25+)' }); availableTitles.push('🌌 Властелин Вселенной'); }
    if(myCreatedCount >= 50) { achievements.push({ text: '🏆 Абсолют', desc: 'Добавил 50+ карточек.' }); availableTitles.push('♾️ Бесконечность'); }
    
    if(myGivenCount >= 1) achievements.push({ text: '❤️ Добряк', desc: 'Взялся исполнить чье-то желание' });
    if(myGivenCount >= 2) availableTitles.push('✨ Волшебник');
    if(myGivenCount >= 5) { achievements.push({ text: '🎅 Настоящий Санта', desc: 'Исполнил 5 желаний!' }); availableTitles.push('🔱 Главный Благодетель'); }
    if(myGivenCount >= 15) { achievements.push({ text: '👼 Архангел', desc: 'Подарил кусочек рая 15 раз' }); availableTitles.push('🧞‍♂️ Джинн из лампы'); }

    const safeUser = getSafeUserKey(currentUser);
    get(ref(db, `users/${safeUser}`)).then(snap => {
        const udata = snap.val();
        if (udata) {
            SHOP_ITEMS.forEach(it => {
                if (it.type === 'title' && udata.selectedTitle === it.val) {
                    if(!availableTitles.includes(it.val)) availableTitles.push(it.val);
                }
            });
        }
        
        availableTitles.forEach(titleText => {
            const lbl = document.createElement('label');
            lbl.innerHTML = `<input type="radio" name="profileTitle" value="${titleText}" ${userTitle === titleText ? 'checked' : ''}> <span>${titleText}</span>`;
            lbl.onchange = async (e) => {
                if(e.target.checked) {
                    userTitle = titleText;
                    await update(ref(db, `users/${getSafeUserKey(currentUser)}`), { selectedTitle: titleText });
                    document.getElementById('global-title').textContent = titleText;
                }
            };
            titlesList.appendChild(lbl);
        });
    });

    if(achievements.length === 0) { list.innerHTML = '<div style="color:var(--text-muted); font-size: 0.85rem;">Нет достижений. Дарите подарки и создавайте карточки!</div>'; return; }
    achievements.forEach(ach => {
        const div = document.createElement('div'); div.className = 'achievement-item';
        div.innerHTML = `<strong>${ach.text}</strong><div style="font-size:0.75rem; color:var(--text-muted);">${ach.desc}</div>`; list.appendChild(div);
    });
}

function showOtherProfile(username) {
    if (username === currentUser) return;
    const safeName = getSafeUserKey(username);
    document.getElementById('other-profile-name').textContent = getDisplayName(username);
    document.getElementById('other-profile-avatar').textContent = roomUsersAvatars[safeName] || '🦊';
    document.getElementById('other-profile-title').textContent = roomUsersTitles[safeName] || '👶 Новичок';

    const theirCreatedCount = giftsData.filter(g => g.createdBy === username).length;
    let theirGivenCount = 0;
    giftsData.forEach(g => { if(g.buyers && g.buyers[safeName]) theirGivenCount++; });

    const achievementsList = document.getElementById('other-profile-achievements');
    achievementsList.innerHTML = '';
    const achievements = [];
    if(theirCreatedCount >= 1) achievements.push({ text: '💡 Мечтатель' });
    if(theirCreatedCount >= 10) achievements.push({ text: '👑 Генератор Идей' });
    if(theirGivenCount >= 1) achievements.push({ text: '❤️ Добряк' });
    if(theirGivenCount >= 5) achievements.push({ text: '🎅 Настоящий Санта' });

    if(achievements.length === 0) achievementsList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">Пока нет достижений.</div>';
    achievements.forEach(ach => {
        const div = document.createElement('div'); div.className = 'achievement-item';
        div.innerHTML = `<strong>${ach.text}</strong>`; achievementsList.appendChild(div);
    });

    document.getElementById('other-profile-modal').classList.add('active');
}

// СПИСОК ДЕЛ
document.getElementById('toggle-todo-btn').onclick = () => { DOM.todo.panel.classList.toggle('open'); };
document.getElementById('close-todo-btn').onclick = () => { DOM.todo.panel.classList.remove('open'); };

function listenToSchedule() {
    if(!currentRoomId) return;
    onValue(ref(db, `rooms/${currentRoomId}/schedule`), (snapshot) => {
        const timeline = document.getElementById('schedule-timeline'); timeline.innerHTML = '';
        const data = snapshot.val();
        if(data) {
            Object.keys(data).forEach(key => {
                const item = data[key]; const block = document.createElement('div'); block.className = 'timeline-item'; block.style.borderLeftColor = generateUserColor(item.user);
                const userSafe = getSafeUserKey(item.user); const userAv = roomUsersAvatars[userSafe] || '🦊';
                block.innerHTML = `
                    <div class="time-tag">${escapeHTML(item.start)} - ${escapeHTML(item.end)}</div>
                    <div class="task-body"><span><b>${userAv} ${escapeHTML(getDisplayName(item.user))}:</b> ${escapeHTML(item.text)}</span></div>
                `;
                if(item.user === currentUser) {
                    const del = document.createElement('span'); del.className = 'del-task'; del.innerHTML = '✖';
                    del.onclick = async () => { await remove(ref(db, `rooms/${currentRoomId}/schedule/${key}`)); };
                    block.querySelector('.task-body').appendChild(del);
                }
                timeline.appendChild(block);
            });
        } else { timeline.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">Таймлайн пуст. Запишите свои дела!</div>'; }
    });
}
document.getElementById('add-schedule-form').addEventListener('submit', async (e) => {
    e.preventDefault(); const text = document.getElementById('task-text').value.trim(); const start = document.getElementById('task-start').value; const end = document.getElementById('task-end').value;
    if(text && start && end) { 
        await push(ref(db, `rooms/${currentRoomId}/schedule`), { user: currentUser, text, start, end }); 
        document.getElementById('task-text').value = ''; 
        await updateQuestProgress('add_schedule'); // Проверка квеста
    }
});

// ЧАТ И ОПРОСЫ
document.getElementById('toggle-chat-btn').onclick = () => { DOM.chat.panel.classList.toggle('open'); };
document.getElementById('close-chat-btn').onclick = () => { DOM.chat.panel.classList.remove('open'); };

document.getElementById('chat-poll-btn').onclick = () => { document.getElementById('poll-modal').classList.add('active'); };

window.addPollOption = () => {
    const cont = document.getElementById('poll-options-container');
    const input = document.createElement('input');
    input.type = 'text'; input.className = 'poll-option-input'; input.placeholder = `Вариант ${cont.children.length + 1}`; input.required = true;
    cont.appendChild(input);
};

document.getElementById('create-poll-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentRoomId) return;
    const question = document.getElementById('poll-question').value.trim();
    const inputs = document.querySelectorAll('.poll-option-input');
    const options = [];
    inputs.forEach((inp, i) => { if(inp.value.trim()) options.push({ id: i, text: inp.value.trim() }); });
    
    if(question && options.length > 0) {
        await push(ref(db, `rooms/${currentRoomId}/messages`), {
            type: 'poll', sender: currentUser, text: question, options: options, timestamp: Date.now()
        });
        document.getElementById('poll-modal').classList.remove('active');
        document.getElementById('create-poll-form').reset();
    }
});

window.castPollVote = async (msgId, optionIndex) => {
    const safeUser = getSafeUserKey(currentUser);
    const voteRef = ref(db, `rooms/${currentRoomId}/messages/${msgId}/options/${optionIndex}/votes/${safeUser}`);
    const snap = await get(voteRef);
    
    const msgRef = ref(db, `rooms/${currentRoomId}/messages/${msgId}/options`);
    const optionsSnap = await get(msgRef);
    if(optionsSnap.exists()) {
        const opts = optionsSnap.val();
        for(let i=0; i<opts.length; i++) {
            if(opts[i].votes && opts[i].votes[safeUser]) {
                await remove(ref(db, `rooms/${currentRoomId}/messages/${msgId}/options/${i}/votes/${safeUser}`));
            }
        }
    }
    
    if (!snap.exists()) {
        await set(voteRef, true);
    }
};

function listenToChat() {
    if (!currentRoomId) return;
    onValue(ref(db, `rooms/${currentRoomId}/messages`), (snapshot) => {
        DOM.chat.messages.innerHTML = ''; const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(msgId => {
                const msg = data[msgId];
                const isMine = msg.sender === currentUser; 
                const isSpirit = msg.isSpirit === true;
                
                const div = document.createElement('div'); 
                // Добавляем класс poll-msg если это опрос
                div.className = `chat-msg ${isMine ? 'mine' : ''} ${isSpirit ? 'spirit' : ''} ${msg.type === 'poll' ? 'poll-msg' : ''}`;
                
                if (!isMine && !isSpirit) {
                    const senderAv = roomUsersAvatars[getSafeUserKey(msg.sender)] || '🦊';
                    const authorDiv = document.createElement('div');
                    authorDiv.className = 'chat-msg-author';
                    authorDiv.style.color = generateUserColor(msg.sender);
                    authorDiv.style.cssText += 'display:flex; align-items:center; gap:6px; margin-bottom:4px; font-weight:600; font-size:0.8rem;';
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = `${senderAv} ${getDisplayName(msg.sender)}`;
                    nameSpan.onclick = () => showOtherProfile(msg.sender);
                    authorDiv.appendChild(nameSpan);
                    div.appendChild(authorDiv);
                }

                if (msg.type === 'poll') {
                    let totalVotes = 0;
                    if(msg.options) msg.options.forEach(opt => { if(opt.votes) totalVotes += Object.keys(opt.votes).length; });

                    // Кнопка удаления опроса
                    let closeBtnHtml = isMine || currentRoomCreator === currentUser
                        ? `<button class="btn-icon delete-poll-btn" title="Удалить опрос" style="position:absolute; top:5px; right:5px; font-size:1rem; cursor:pointer; background:none; border:none; color:var(--text-muted);">✖</button>`
                        : '';

                    const pollDiv = document.createElement('div');
                    pollDiv.className = 'poll-container';
                    pollDiv.innerHTML = `
                        ${closeBtnHtml}
                        <div class="poll-question">📊 ${escapeHTML(msg.text)}</div>
                        <div class="poll-options"></div>
                        <div class="poll-meta">Всего голосов: ${totalVotes}</div>
                    `;
                    
                    if (isMine || currentRoomCreator === currentUser) {
                        const delBtn = pollDiv.querySelector('.delete-poll-btn');
                        delBtn.onclick = async () => {
                            if(confirm('Удалить этот опрос?')) {
                                await remove(ref(db, `rooms/${currentRoomId}/messages/${msgId}`));
                            }
                        };
                    }

                    const optionsCont = pollDiv.querySelector('.poll-options');
                    
                    if(msg.options) {
                        msg.options.forEach((opt, idx) => {
                            const optVotes = opt.votes ? Object.keys(opt.votes).length : 0;
                            const perc = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                            const hasMyVote = opt.votes && opt.votes[getSafeUserKey(currentUser)];
                            
                            const optRow = document.createElement('div');
                            optRow.className = 'poll-option-row';
                            if (hasMyVote) optRow.style.borderColor = 'var(--primary-color)';
                            
                            optRow.innerHTML = `
                                <div class="poll-option-fill" style="width: ${perc}%"></div>
                                <div class="poll-option-text">
                                    <span>${hasMyVote ? '✅ ' : ''}${escapeHTML(opt.text)}</span>
                                    <span>${perc}%</span>
                                </div>
                            `;
                            optRow.onclick = () => castPollVote(msgId, idx);
                            optionsCont.appendChild(optRow);
                        });
                    }
                    div.appendChild(pollDiv);
                } else {
                    const textDiv = document.createElement('div'); textDiv.textContent = msg.text; div.appendChild(textDiv); 
                }

                DOM.chat.messages.appendChild(div);
            });
            DOM.chat.messages.scrollTop = DOM.chat.messages.scrollHeight;
        } else { DOM.chat.messages.innerHTML = '<div style="text-align:center; color:gray; font-size: 0.8rem;">Нет сообщений.</div>'; }
    });
}

document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault(); const text = DOM.chat.input.value.trim();
    if (text) { 
        try { 
            await push(ref(db, `rooms/${currentRoomId}/messages`), { sender: currentUser, text: text, timestamp: Date.now() }); 
            DOM.chat.input.value = ''; 
        } catch (error) { console.error("Ошибка:", error); } 
    }
});

window.onload = init;
