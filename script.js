const SUPABASE_URL = 'https://bgrwqqgoomemgggqhdyf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJncndxcWdvb21lbWdnZ3FoZHlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTY5MTAsImV4cCI6MjA4MTQzMjkxMH0.MTo1zd4XwA_lYDoCKb0GKGqmOpOSvtxZWt-Hn-U8WAU';

let sbClient; 
try {
    if(window.supabase) {
        sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error("Supabase library not loaded");
    }
} catch (err) {
    console.error("Supabase init error:", err);
}

let activeLiveId = null;
let activeLiveType = 'news'; 
let currentFilter = 'Tutti';
let tempCoverImage = '';
let tempBodyImages = []; 
let currentViewImages = [];
let currentLightboxIndex = 0;
let currentActiveNewsId = null;
let dragSrcEl = null;
let allCategories = new Set(['Star Wars', 'Harry Potter', 'City', 'Altro', 'Marvel', 'DC', 'Technic', 'Ideas']);
let cachedNews = []; 
let allLives = []; 

// PERSISTENZA BOOM
let explodedState = JSON.parse(localStorage.getItem('explodedState')) || {};

let allVotedNews = [];
let currentHoFType = 'news';
let currentSearchTerm = ''; 

// STATO ADMIN
let isAdmin = false;
let userRole = null; 

// Vista default
let currentViewMode = 'blog'; 

const ICON_MOON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
const ICON_SUN = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const ICON_LOCKED = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
const ICON_UNLOCKED = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;

// HELPER DOM - Sicurezza XSS & Performance
function createElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
}

function getStaticBombs(level) { 
    const n = parseInt(level) || 1; 
    let html = ''; 
    for(let i=0; i<n; i++) html += `<img src="brick.png" class="static-brick-img" alt="brick">`; 
    return html; 
}

function createInteractiveBombs(newsId) {
    const container = document.createElement('div');
    container.className = 'card-bombs';
    
    if (!explodedState[newsId]) explodedState[newsId] = [false, false, false];
    
    for(let i=0; i<3; i++) {
        const bombWrap = document.createElement('div');
        bombWrap.className = 'bomb-container';
        if (explodedState[newsId][i]) bombWrap.classList.add('exploded');
        
        bombWrap.addEventListener('click', (e) => toggleBomb(e, bombWrap, newsId, i));
        
        const imgBrick = document.createElement('img');
        imgBrick.src = 'brick.png';
        imgBrick.className = 'bomb-icon-img';
        imgBrick.alt = 'Boom Brick';
        
        const imgBoom = document.createElement('img');
        imgBoom.src = 'boom.png';
        imgBoom.className = 'boom-img';
        imgBoom.alt = 'Explosion';
        
        bombWrap.appendChild(imgBrick);
        bombWrap.appendChild(imgBoom);
        container.appendChild(bombWrap);
    }
    return container;
}

function showLoader() { document.getElementById('loader').style.display = 'block'; }
function hideLoader() { document.getElementById('loader').style.display = 'none'; }

// TOAST NOTIFICATIONS
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconHTML = '';
    if (type === 'success') {
        iconHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'boom') {
        iconHTML = `<img src="boom.png" alt="boom" style="width: 24px; height: 24px; object-fit: contain;">`;
    }
    
    toast.innerHTML = `${iconHTML}<span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.4s forwards';
        setTimeout(() => { if(container.contains(toast)) container.removeChild(toast); }, 400);
    }, 3000);
}

// SKELETON LOADING
function renderSkeletons() {
    const container = document.getElementById('newsGrid');
    container.innerHTML = '';
    const skeletonCount = window.innerWidth > 1024 ? 8 : 4;
    for(let i=0; i<skeletonCount; i++) {
        const div = createElement('div', 'skeleton-card');
        div.innerHTML = `<div class="skeleton skeleton-image"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text short"></div>`;
        container.appendChild(div);
    }
}

function toggleBomb(e, el, newsId, index) { 
    e.stopPropagation(); 
    explodedState[newsId][index] = !explodedState[newsId][index]; 
    localStorage.setItem('explodedState', JSON.stringify(explodedState));

    if(explodedState[newsId][index]) {
        el.classList.add('exploded'); 
        showToast("BOOM!", "boom");
    } else {
        el.classList.remove('exploded'); 
    }
    
    // Sincronizza modale se aperto
    if (currentActiveNewsId === newsId) { 
        const modalBombs = document.getElementById('viewInteractiveBombs'); 
        if(modalBombs) {
            modalBombs.innerHTML = '';
            modalBombs.appendChild(createInteractiveBombs(newsId));
        }
    } 
}

async function checkSession() { if(!sbClient) return; try { const { data, error } = await sbClient.auth.getSession(); if (error) updateAuthUI(null); else updateAuthUI(data.session); sbClient.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || event === 'USER_DELETED') updateAuthUI(null); else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') updateAuthUI(session); }); } catch (err) { updateAuthUI(null); } }

function updateAuthUI(session) { 
    isAdmin = !!session;
    userRole = null;
    if (isAdmin && session.user) {
        userRole = session.user.email === 'dreamnbricks@gmail.com' ? 'ideas_editor' : 'superadmin';
    }
    
    const authIcon = document.getElementById('authIcon'); 
    const userModeList = document.getElementById('userModeList');
    const userModeSection = document.getElementById('userModeSection');

    if (isAdmin) { 
        document.body.classList.add('is-admin'); 
        authIcon.innerHTML = ICON_UNLOCKED; 
        setAdminMode('management'); 
        userModeList.style.display = 'none';
        userModeSection.style.display = 'none';
        document.getElementById('btnAddNewsLive').style.display = userRole === 'ideas_editor' ? 'none' : 'block';
    } else { 
        document.body.classList.remove('is-admin'); 
        authIcon.innerHTML = ICON_LOCKED; 
        currentViewMode = 'blog'; 
        userModeList.style.display = 'block';
        userModeSection.style.display = 'flex';
        document.getElementById('btnAddNewsLive').style.display = 'none';
    } 
    
    if(allLives.length > 0) loadLives();
    if(activeLiveId) refreshUI(); 
}

function setAdminMode(mode) {
    if(!isAdmin) return;
    currentViewMode = (mode === 'management') ? 'grid' : 'blog';
    document.querySelectorAll('.live-list.admin-only .live-item').forEach(el => el.classList.remove('active'));
    if(mode === 'management') {
        document.getElementById('btnAdminMode').classList.add('active');
        document.getElementById('sidebar').classList.remove('locked');
    } else {
        document.getElementById('btnUserMode').classList.add('active');
        document.getElementById('sidebar').classList.add('locked');
    }
    refreshUI();
}

function toggleLogin() { if (isAdmin) { if(confirm("Logout?")) if(sbClient) sbClient.auth.signOut(); } else { document.getElementById('loginError').classList.add('hidden'); document.getElementById('loginModal').classList.add('active'); } }
async function handleLogin(e) { e.preventDefault(); if(!sbClient) return alert("Database Disconnesso"); const email = document.getElementById('loginEmail').value; const pass = document.getElementById('loginPass').value; const { data, error } = await sbClient.auth.signInWithPassword({ email, password: pass }); if (error) { const errorDiv = document.getElementById('loginError'); errorDiv.innerText = "Errore: " + error.message; errorDiv.classList.remove('hidden'); } else { closeLoginModal(); } }
function closeLoginModal() { document.getElementById('loginModal').classList.remove('active'); }
function initTheme() { const savedTheme = localStorage.getItem('theme'); const iconContainer = document.getElementById('darkModeIcon'); if (savedTheme === 'dark') { document.body.classList.add('dark-mode'); iconContainer.innerHTML = ICON_SUN; } else { iconContainer.innerHTML = ICON_MOON; } updateDynamicImages(); }
function toggleDarkMode() { document.body.classList.toggle('dark-mode'); const isDark = document.body.classList.contains('dark-mode'); localStorage.setItem('theme', isDark ? 'dark' : 'light'); document.getElementById('darkModeIcon').innerHTML = isDark ? ICON_SUN : ICON_MOON; updateDynamicImages(); }
function updateDynamicImages() { const isDark = document.body.classList.contains('dark-mode'); const emptyImg = document.getElementById('emptyStateLogo'); const landingImg = document.getElementById('landingLogo'); const src = isDark ? 'LOGO-fondo NERO-2026.png' : 'LOGO-fondo BIANCO-2026.png'; if(emptyImg) emptyImg.src = src; if(landingImg) landingImg.src = src; }
function enterApp() { document.getElementById('landingPage').classList.add('hidden'); const app = document.getElementById('appContainer'); app.style.display = 'flex'; setTimeout(() => app.classList.add('visible'), 50); activeLiveId = null; document.getElementById('sidebar').classList.add('collapsed'); document.getElementById('emptyState').style.display = 'flex'; document.getElementById('mainHeader').style.display = 'none'; document.getElementById('newsGrid').innerHTML = ''; }
function enterLatestLive() { 
    const latestNewsLive = allLives.find(l => l.type === 'news' || !l.type);
    if (latestNewsLive) { 
        document.getElementById('landingPage').classList.add('hidden'); 
        const app = document.getElementById('appContainer'); 
        app.style.display = 'flex'; 
        setTimeout(() => app.classList.add('visible'), 50); 
        selectLive(latestNewsLive); 
        if(window.innerWidth >= 1024) document.getElementById('sidebar').classList.remove('collapsed'); 
    } else { 
        enterApp(); 
    } 
}
async function initApp() { initTheme(); if(sbClient) { checkSession(); loadLives(); } else { console.warn("Offline Mode"); } }
function getYoutubeId(url) { if(!url) return null; const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/; const match = url.match(regExp); return (match && match[2].length === 11) ? match[2] : null; }
function openYoutube(e, url) { e.stopPropagation(); if(url) window.open(url, '_blank'); }

async function loadLives() { 
    if(!sbClient) return; 
    const { data: lives, error } = await sbClient.from('lives').select('*').order('live_date', { ascending: false }); 
    if (error) { console.error(error); return; } 
    allLives = lives || []; 
    
    const listNews = document.getElementById('liveListNews'); 
    const listIdeas = document.getElementById('liveListIdeas');
    listNews.innerHTML = '';
    listIdeas.innerHTML = '';

    lives.forEach(live => { 
        const type = live.type || 'news';
        const li = document.createElement('li'); 
        li.className = `live-item ${live.id === activeLiveId ? 'active' : ''}`; 
        
        let thumbHTML = ''; 
        const ytId = getYoutubeId(live.youtube_link); 
        if(ytId) { 
            const thumbUrl = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`; 
            thumbHTML = `<div class="live-yt-thumb" onclick="openYoutube(event, '${live.youtube_link}')"><img src="${thumbUrl}"></div>`; 
        } 

        let canEditLive = isAdmin;
        if (userRole === 'ideas_editor' && type !== 'ideas') canEditLive = false;
        
        let actionButtons = '';
        if (canEditLive) {
            actionButtons = `<div class="live-actions"><button class="action-btn admin-only" title="Modifica" onclick="renameLive(event, ${live.id}, '${live.name.replace(/'/g, "\\'")}', '${live.live_date}', '${live.youtube_link || ''}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button class="action-btn delete-btn admin-only" title="Elimina" onclick="deleteLive(event, ${live.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div>`;
        }
        
        li.innerHTML = `<div class="live-item-content" onclick="selectLive({id: ${live.id}, name: '${live.name.replace(/'/g, "\\'")}', type: '${type}'})">${thumbHTML}<div class="live-info"><span class="live-name">${live.name}</span><span class="live-date">${live.live_date || ''}</span></div></div>${actionButtons}`; 
        
        if (type === 'ideas') listIdeas.appendChild(li); else listNews.appendChild(li);
    }); 
    
    if(allLives.length > 0 && !activeLiveId) loadLatestLivePreview(allLives[0].id); 
}

async function loadLatestLivePreview(liveId) { if(!sbClient || !liveId) return; const { data, error } = await sbClient.from('news').select('cover_image').eq('live_id', liveId).not('cover_image', 'is', null).limit(12); const container = document.getElementById('latestLiveBg'); if (container && !error && data && data.length > 0) { container.innerHTML = ''; data.forEach(item => { const img = document.createElement('img'); img.src = item.cover_image; container.appendChild(img); }); container.style.opacity = '1'; } }

async function createNewLive(type) { 
    if(!isAdmin) return;
    if (userRole === 'ideas_editor' && type !== 'ideas') return alert("Permesso negato: Puoi creare solo live Ideas.");
    const name = prompt(`Nome Nuova ${type === 'ideas' ? 'Ideas' : 'News'} Live:`); if(!name) return; 
    const dateStr = prompt("Data Live (YYYY-MM-DD):", new Date().toISOString().split('T')[0]); 
    const ytLink = prompt("Link YouTube (Opzionale):"); 
    showLoader(); 
    const { error } = await sbClient.from('lives').insert([{ name: name, live_date: dateStr, youtube_link: ytLink, type: type }]); 
    if(!error) loadLives(); else { alert(error.message); hideLoader(); } 
}

async function renameLive(e, id, oldName, oldDate, oldLink) { e.stopPropagation(); if(!isAdmin) return; const newName = prompt("Nuovo nome Live:", oldName); const newDate = prompt("Nuova data Live (YYYY-MM-DD):", oldDate); const newLink = prompt("Nuovo Link YouTube:", oldLink); if(newName && newDate) { showLoader(); const { error } = await sbClient.from('lives').update({ name: newName, live_date: newDate, youtube_link: newLink }).eq('id', id); if(!error) loadLives(); else { alert(error.message); hideLoader(); } } }
async function deleteLive(e, id) { e.stopPropagation(); if(!isAdmin) return; if(confirm("Eliminare live e tutti i contenuti?")) { showLoader(); await sbClient.from('news').delete().eq('live_id', id); await sbClient.from('lives').delete().eq('id', id); if(activeLiveId === id) { activeLiveId = null; document.getElementById('emptyState').style.display = 'flex'; document.getElementById('mainHeader').style.display = 'none'; document.getElementById('newsGrid').innerHTML = ''; } loadLives(); hideLoader(); } }

function selectLive(live) {
    if(window.innerWidth < 1024) document.getElementById('sidebar').classList.add('collapsed');
    activeLiveId = live.id;
    activeLiveType = live.type || 'news';
    
    document.querySelectorAll('.live-list .live-item').forEach(el => el.classList.remove('active'));
    const items = document.querySelectorAll('.live-list .live-item');
    items.forEach(i => { if(i.innerText.includes(live.name)) i.classList.add('active'); });
    if(currentViewMode === 'grid') document.getElementById('sidebar').classList.remove('locked');
    
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('mainHeader').style.display = 'flex';
    document.getElementById('headerTitle').innerText = live.name;
    document.getElementById('stickyFilterContainer').style.display = 'block';

    const secondaryLogo = document.getElementById('secondaryLogo');
    if (secondaryLogo) {
        secondaryLogo.style.display = 'block';
        secondaryLogo.src = activeLiveType === 'ideas' ? 'logo_dream.jpg' : 'logo_itavix.png';
    }

    const addBtn = document.getElementById('btnMainAddNews');
    if (isAdmin) {
        addBtn.style.display = (userRole === 'ideas_editor' && activeLiveType !== 'ideas') ? 'none' : 'flex';
    } else {
        addBtn.style.display = 'none';
    }
    loadNews(live.id);
}

function switchToUserMode() {
    if(window.innerWidth < 1024) document.getElementById('sidebar').classList.add('collapsed');
    currentViewMode = 'blog';
    document.getElementById('sidebar').classList.add('locked');
    document.querySelectorAll('.live-item').forEach(el => el.classList.remove('active'));
    document.getElementById('btnUserLive').classList.add('active');
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('mainHeader').style.display = 'flex';
    document.getElementById('headerTitle').innerText = "Live Utenti";
    document.getElementById('stickyFilterContainer').style.display = 'block';
    document.getElementById('btnMainAddNews').style.display = 'none'; 
    const secondaryLogo = document.getElementById('secondaryLogo');
    if(secondaryLogo) secondaryLogo.style.display = 'none';
    if(allLives.length > 0) { activeLiveId = allLives[0].id; loadNews(activeLiveId); }
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }

async function loadNews(liveId) {
    // SKELETON LOADING
    renderSkeletons();
    
    // OPTIMIZATION: Removed 'description' and 'body_images' from initial fetch
    const { data: news, error } = await sbClient
        .from('news')
        .select('id, live_id, title, category, likelihood, cover_image, order, is_online, votes')
        .eq('live_id', liveId)
        .order('order', { ascending: true });
    if (error) { alert(error.message); return; }
    cachedNews = news; 
    news.forEach(n => { if(n.category) allCategories.add(n.category); });
    refreshUI();
}

async function toggleNewsStatus(id, newStatus, checkbox) {
    if (userRole === 'ideas_editor' && activeLiveType !== 'ideas') return;

    // BLOCCA INPUT
    checkbox.disabled = true;

    // OPTIMISTIC UPDATE
    const newsItem = cachedNews.find(n => n.id === id);
    if (newsItem) newsItem.is_online = newStatus;
    
    // NOTA: Non chiamiamo refreshUI() qui per evitare di distruggere il checkbox mentre è in loading.
    // L'utente vede lo switch muoversi (nativo), ma la card cambierà stile (offline/online opacity) solo dopo la conferma server.

    const { error } = await sbClient.from('news').update({ is_online: newStatus }).eq('id', id);
    
    if (error) { 
        // REVERT ON ERROR
        alert("Errore aggiornamento: " + error.message); 
        if (newsItem) newsItem.is_online = !newStatus; 
        checkbox.checked = !newStatus;
    } else {
        showToast(`Stato news aggiornato: ${newStatus ? 'ONLINE' : 'OFFLINE'}`, 'success');
    }
    
    // SBLOCCA E AGGIORNA UI
    checkbox.disabled = false;
    refreshUI(); 
}

function handleSearch(term) { currentSearchTerm = term.toLowerCase(); refreshUI(); }

function refreshUI() {
    const liveCategories = new Set();
    cachedNews.forEach(n => { if(n.category) liveCategories.add(n.category); });
    renderNavPills(liveCategories);
    if (currentFilter !== 'Tutti' && !liveCategories.has(currentFilter)) currentFilter = 'Tutti';
    updatePillsState();
    if(currentViewMode === 'blog') renderBlogFromCache(); else renderGridFromCache();
}

function renderNavPills(liveCats) {
    const container = document.getElementById('navPillsContainer');
    container.innerHTML = '';
    const allBtn = createElement('div', 'nav-item', 'Tutti');
    allBtn.onclick = () => filterNews('Tutti');
    container.appendChild(allBtn);
    liveCats.forEach(cat => {
        const btn = createElement('div', 'nav-item', cat);
        btn.onclick = () => filterNews(cat);
        container.appendChild(btn);
    });
}
function updatePillsState() {
    document.querySelectorAll('.nav-item').forEach(p => {
        if(p.innerText === currentFilter) p.classList.add('active'); else p.classList.remove('active');
    });
}

// RENDERING DOM OTTIMIZZATO (DocumentFragment + createElement)
function renderGridFromCache() {
    const grid = document.getElementById('newsGrid');
    grid.className = 'grid-container';
    grid.innerHTML = '';
    
    let filtered = filterData();
    let canEditContent = checkEditPermissions();

    const fragment = document.createDocumentFragment();
    filtered.forEach(item => {
        const card = createElement('div', 'card');
        card.dataset.id = item.id; 
        if (isAdmin && !item.is_online) card.classList.add('offline-mode');
        
        setupDragDrop(card);
        card.addEventListener('click', (e) => { 
            if(e.target.closest('.admin-toggle-container') || e.target.closest('.bomb-container') || e.target.closest('.trophy-container') || card.classList.contains('dragging')) return;
            openViewModal(item); 
        });

        const imgWrapper = createElement('div', 'card-image-wrapper');
        
        const bgBlur = createElement('img', 'card-bg-blur');
        bgBlur.src = item.cover_image || '';
        
        const fade = createElement('div', 'fade-overlay');
        
        const mainImg = createElement('img', 'card-image-small');
        mainImg.src = item.cover_image || '';
        mainImg.loading = "lazy";
        mainImg.alt = item.title;

        imgWrapper.append(bgBlur, fade, mainImg);

        if (isAdmin && canEditContent) {
            const toggleContainer = createElement('div', 'admin-toggle-container');
            toggleContainer.onclick = (e) => e.stopPropagation();
            
            const label = createElement('span', 'toggle-status-label', item.is_online ? 'ON' : 'OFF');
            const switchLabel = createElement('label', 'apple-switch');
            const input = createElement('input');
            input.type = 'checkbox';
            input.checked = item.is_online;
            input.onchange = function() { toggleNewsStatus(item.id, this.checked, this); };
            
            const slider = createElement('span', 'slider');
            switchLabel.append(input, slider);
            toggleContainer.append(label, switchLabel);
            imgWrapper.appendChild(toggleContainer);
        }

        const content = createElement('div', 'card-content');
        
        const metaRow = createElement('div', 'card-meta-row');
        const leftMeta = createElement('div');
        leftMeta.style.display = 'flex';
        leftMeta.style.alignItems = 'center';
        
        const catSpan = createElement('span', 'card-category', item.category);
        const staticBombs = createElement('span');
        staticBombs.innerHTML = getStaticBombs(item.likelihood);
        leftMeta.append(catSpan, staticBombs);

        const trophyContainer = createElement('div', 'trophy-container');
        if(localStorage.getItem(`vote_${item.id}`) === 'true') trophyContainer.classList.add('voted');
        trophyContainer.innerHTML = `<svg class="trophy-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`;
        trophyContainer.addEventListener('click', (e) => toggleBestNews(e, item.id, trophyContainer));

        metaRow.append(leftMeta, trophyContainer);

        const bombRow = createElement('div', 'card-meta-row');
        bombRow.style.marginTop = '-5px';
        bombRow.appendChild(createInteractiveBombs(item.id));

        // SECURITY: Sanitizing Title
        const safeTitle = DOMPurify.sanitize(item.title);
        const titleHtml = `<span style="color: var(--text-main); font-weight: 800;">${safeTitle.split(' ')[0] || ''}</span> <span style="color: var(--text-sec); font-weight: 500;">${safeTitle.split(' ').slice(1).join(' ')}</span>`;
        const title = createElement('h3', 'card-title');
        title.innerHTML = titleHtml;

        content.append(metaRow, bombRow, title);
        card.append(imgWrapper, content);
        fragment.appendChild(card);
    });
    grid.appendChild(fragment);
}

function renderBlogFromCache() {
    const container = document.getElementById('newsGrid');
    container.className = 'blog-container';
    container.innerHTML = '';
    
    let filtered = filterData();
    let canEditContent = checkEditPermissions();

    const fragment = document.createDocumentFragment();
    filtered.forEach(item => {
        const card = createElement('div', 'blog-card');
        card.dataset.id = item.id;
        setupDragDrop(card);
        
        card.addEventListener('click', (e) => { 
            if(e.target.closest('.admin-toggle-container') || e.target.closest('.bomb-container') || e.target.closest('.trophy-container')) return;
            openViewModal(item); 
        });

        const imgWrapper = createElement('div', 'blog-image-wrapper');
        const bgBlur = createElement('img', 'card-bg-blur'); bgBlur.src = item.cover_image || '';
        const mainImg = createElement('img', 'blog-image'); mainImg.src = item.cover_image || ''; mainImg.loading = "lazy";
        imgWrapper.append(bgBlur, mainImg);

        if (isAdmin && canEditContent) {
            const toggleContainer = createElement('div', 'admin-toggle-container');
            toggleContainer.style.top = '10px'; toggleContainer.style.right = '10px';
            toggleContainer.onclick = (e) => e.stopPropagation();
            const switchLabel = createElement('label', 'apple-switch');
            const input = createElement('input'); input.type = 'checkbox'; input.checked = item.is_online;
            input.onchange = function() { toggleNewsStatus(item.id, this.checked, this); };
            switchLabel.append(input, createElement('span', 'slider'));
            toggleContainer.appendChild(switchLabel);
            imgWrapper.appendChild(toggleContainer);
        }

        const content = createElement('div', 'blog-content');
        
        const metaRow = createElement('div', 'blog-meta-row');
        const catSpan = createElement('span', 'blog-category', item.category);
        const trophyContainer = createElement('div', 'trophy-container');
        if(localStorage.getItem(`vote_${item.id}`) === 'true') trophyContainer.classList.add('voted');
        trophyContainer.innerHTML = `<svg class="trophy-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>`;
        trophyContainer.addEventListener('click', (e) => toggleBestNews(e, item.id, trophyContainer));
        metaRow.append(catSpan, trophyContainer);

        const title = createElement('h3', 'blog-title');
        title.textContent = item.title;

        const bombsDiv = createElement('div');
        bombsDiv.style.marginBottom = '15px';
        bombsDiv.innerHTML = getStaticBombs(item.likelihood);

        // OPTIMIZATION: Description is not fetched in list. Show placeholder.
        const descPlaceholder = createElement('p', 'blog-desc', 'Clicca per leggere i dettagli...');
        
        const interactiveBombs = createElement('div', 'card-bombs');
        interactiveBombs.style.marginTop = 'auto';
        interactiveBombs.style.paddingTop = '10px';
        interactiveBombs.appendChild(createInteractiveBombs(item.id));

        content.append(metaRow, title, bombsDiv, descPlaceholder, interactiveBombs);
        card.append(imgWrapper, content);
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

function filterData() {
    let filtered = cachedNews;
    if(currentFilter !== 'Tutti') filtered = filtered.filter(n => n.category === currentFilter);
    if(currentSearchTerm) filtered = filtered.filter(n => n.title.toLowerCase().includes(currentSearchTerm));
    if (!isAdmin) filtered = filtered.filter(n => n.is_online === true);
    return filtered;
}

function checkEditPermissions() {
    if(!isAdmin) return false;
    if (userRole === 'ideas_editor' && activeLiveType !== 'ideas') return false;
    return true;
}

function filterNews(cat) { currentFilter = cat; refreshUI(); }

// --- VOTING SYSTEM ---
async function toggleBestNews(e, newsId, el) {
    e.stopPropagation();
    const newsItem = cachedNews.find(n => n.id === newsId);
    const liveId = newsItem ? newsItem.live_id : activeLiveId;
    if (!liveId) return; 

    const storageKeyVote = `vote_${newsId}`;
    const storageKeyLive = `vote_live_${liveId}`;
    const isAlreadyVoted = localStorage.getItem(storageKeyVote) === 'true';

    if (isAlreadyVoted) {
        el.classList.remove('voted');
        localStorage.removeItem(storageKeyVote);
        if (String(localStorage.getItem(storageKeyLive)) === String(newsId)) localStorage.removeItem(storageKeyLive);
        showToast("Voto rimosso", "success");
        if(sbClient) {
            const { data } = await sbClient.from('news').select('votes').eq('id', newsId).single();
            if(data) await sbClient.from('news').update({ votes: Math.max(0, data.votes - 1) }).eq('id', newsId);
        }
        return;
    } 
    
    const previousNewsId = localStorage.getItem(storageKeyLive);
    if (previousNewsId && String(previousNewsId) !== String(newsId)) {
        localStorage.removeItem(`vote_${previousNewsId}`);
        const oldCard = document.querySelector(`.card[data-id="${previousNewsId}"]`) || document.querySelector(`.blog-card[data-id="${previousNewsId}"]`);
        if (oldCard) {
            const oldTrophy = oldCard.querySelector('.trophy-container');
            if (oldTrophy) oldTrophy.classList.remove('voted');
        }
        if(sbClient) {
            const { data } = await sbClient.from('news').select('votes').eq('id', previousNewsId).single();
            if(data) await sbClient.from('news').update({ votes: Math.max(0, data.votes - 1) }).eq('id', previousNewsId);
        }
    }

    el.classList.add('voted');
    localStorage.setItem(storageKeyVote, 'true');
    localStorage.setItem(storageKeyLive, String(newsId));
    showToast("Voto registrato!", "success");

    if(sbClient) {
        const { data } = await sbClient.from('news').select('votes').eq('id', newsId).single();
        if(data) await sbClient.from('news').update({ votes: data.votes + 1 }).eq('id', newsId);
    }
}

async function openBestNewsModal() {
    if(!sbClient) return;
    showLoader();
    const { data: bestNews, error } = await sbClient.from('news').select('id, title, cover_image, votes, live_id').gt('votes', 0).order('votes', { ascending: false }).limit(100);
    hideLoader();
    if(error) return alert("Errore caricamento classifica");
    allVotedNews = bestNews || [];
    currentHoFType = activeLiveType || 'news';
    
    const container = document.getElementById('bestNewsListContainer');
    let resetButtonHTML = isAdmin ? `<div style="margin-top: 30px; border-top: 1px solid rgba(0,0,0,0.1); padding-top: 20px; text-align: center;"><button class="btn btn-danger" style="width: auto; padding: 10px 20px; font-size: 14px;" onclick="resetVotesForCurrentLive()">🗑️ AZZERA VOTI LIVE</button><p style="font-size: 11px; color: var(--text-sec); margin-top: 8px;">Attenzione: azzera i voti della live corrente.</p></div>` : '';

    container.innerHTML = `<div style="display: flex; justify-content: center; margin-bottom: 20px;"><div class="nav-pills" style="width: auto;"><div class="nav-item ${currentHoFType === 'news' ? 'active' : ''}" onclick="switchHoF('news')">News</div><div class="nav-item ${currentHoFType === 'ideas' ? 'active' : ''}" onclick="switchHoF('ideas')">Ideas</div></div></div><div id="hofListContent"></div>${resetButtonHTML}`;
    switchHoF(currentHoFType);
    document.getElementById('bestNewsModal').classList.add('active');
}

async function resetVotesForCurrentLive() {
    if(!isAdmin || !activeLiveId) return;
    if(!confirm("SEI SICURO? Azzerare tutti i voti per questa LIVE?")) return;
    showLoader();
    const { error } = await sbClient.from('news').update({ votes: 0 }).eq('live_id', activeLiveId);
    if(error) { alert("Errore reset: " + error.message); } 
    else {
        cachedNews.forEach(n => localStorage.removeItem(`vote_${n.id}`));
        localStorage.removeItem(`vote_live_${activeLiveId}`);
        showToast("Voti azzerati", "success");
        loadNews(activeLiveId);
        closeBestNewsModal();
    }
    hideLoader();
}

function switchHoF(type) {
    currentHoFType = type;
    
    // Aggiorna lo stato dei tab (News/Ideas)
    document.querySelectorAll('#bestNewsListContainer .nav-item').forEach(t => {
        if(t.innerText.toLowerCase() === type) t.classList.add('active'); else t.classList.remove('active');
    });

    const listContainer = document.getElementById('hofListContent');
    
    // Mappa per recuperare i tipi di live
    const liveTypeMap = {}; 
    allLives.forEach(l => liveTypeMap[l.id] = (l.type || 'news')); 
    
    // Filtra le news votate in base al tipo selezionato (news o ideas)
    const filtered = allVotedNews.filter(n => (liveTypeMap[n.live_id] || 'news') === type);

    // Gestione stato vuoto
    if(filtered.length === 0) { 
        listContainer.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-sec); font-size:15px;">Nessuna classifica per questa categoria.</div>'; 
        return; 
    }

    // Mappa per recuperare i nomi delle live
    const liveNameMap = {}; 
    allLives.forEach(l => liveNameMap[l.id] = l.name);
    
    let html = '<ul style="list-style: none; padding: 0; margin: 0;">';
    
    filtered.forEach((news, index) => {
        // --- STILE IOS ---
        html += `
        <li style="display: flex; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(0,0,0,0.05); width: 100%;">
            
            <div style="font-size: 18px; font-weight: 700; color: var(--text-sec); width: 30px; text-align: center; flex-shrink: 0; margin-right: 8px;">
                ${index + 1}
            </div>

            <div style="width: 54px; height: 54px; flex-shrink: 0; border-radius: 12px; overflow: hidden; background-color: var(--bg-input); position: relative; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05);">
                <img src="${news.cover_image || 'brick.png'}" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy">
            </div>

            <div style="flex: 1; min-width: 0; padding: 0 14px; display: flex; flex-direction: column; justify-content: center;">
                <div style="font-size: 17px; font-weight: 600; color: var(--text-main); line-height: 1.2; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: var(--font);">
                    ${news.title}
                </div>
                <div style="font-size: 13px; color: var(--text-sec); font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${liveNameMap[news.live_id] || 'Archivio'}
                </div>
            </div>

            <div style="background-color: var(--bg-input); border-radius: 10px; padding: 6px 10px; min-width: 48px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;">
                <span style="font-size: 16px; font-weight: 700; color: var(--text-main); line-height: 1;">${news.votes}</span>
                <span style="font-size: 9px; text-transform: uppercase; color: var(--text-sec); font-weight: 600; margin-top: 2px;">Voti</span>
            </div>

        </li>`;
    });
    
    html += '</ul>';
    listContainer.innerHTML = html;
}

function closeBestNewsModal() { document.getElementById('bestNewsModal').classList.remove('active'); }

// FETCH ON DEMAND: Scarica descrizione e immagini solo quando serve
async function openViewModal(partialItem) {
    currentActiveNewsId = partialItem.id;
    document.getElementById('viewTitle').textContent = partialItem.title; 
    document.getElementById('viewCategory').textContent = partialItem.category;
    document.getElementById('viewStaticBombs').innerHTML = getStaticBombs(partialItem.likelihood);
    
    const modalBombs = document.getElementById('viewInteractiveBombs');
    modalBombs.innerHTML = '';
    modalBombs.appendChild(createInteractiveBombs(partialItem.id));

    const viewImg = document.getElementById('viewImage');
    viewImg.style.backgroundImage = partialItem.cover_image ? `url('${partialItem.cover_image}')` : 'none';
    if(!partialItem.cover_image) viewImg.style.backgroundColor = '#eee';
    
    // SECURITY & OPTIMIZATION: Loading state + Security
    const viewDesc = document.getElementById('viewDesc');
    viewDesc.innerHTML = '<div style="color:var(--text-sec); font-style:italic; padding:20px 0;">Caricamento dettagli...</div>';
    document.getElementById('viewImagesContainer').innerHTML = '';

    document.getElementById('viewMode').classList.remove('hidden');
    document.getElementById('editMode').classList.add('hidden');
    document.getElementById('modalOverlay').classList.add('active');
    
    // UI Mods
    const modalMainCard = document.querySelector('#modalOverlay .modal-card'); 
    if(currentViewMode === 'blog') {
        document.getElementById('modalOverlay').classList.add('fullscreen-mode');
        modalMainCard.classList.add('fullscreen');
    } else {
        document.getElementById('modalOverlay').classList.remove('fullscreen-mode');
        modalMainCard.classList.remove('fullscreen');
    }

    const btnEditContainer = document.getElementById('btnEditNewsContainer');
    if (isAdmin) btnEditContainer.style.display = (userRole === 'ideas_editor' && activeLiveType !== 'ideas') ? 'none' : 'flex';
    else btnEditContainer.style.display = 'none';

    // FETCH FULL DETAILS (Description & Body Images)
    const { data: fullItem, error } = await sbClient.from('news').select('description, body_images').eq('id', partialItem.id).single();
    
    if (!error && fullItem) {
        // SECURITY: Sanitizing Description using DOMPurify
        const safeDescription = DOMPurify.sanitize(cleanText(fullItem.description || ''));
        viewDesc.innerHTML = safeDescription;
        
        currentViewImages = fullItem.body_images || [];
        if (currentViewImages.length > 0) {
            document.getElementById('viewImagesContainer').innerHTML = createGalleryButton(currentViewImages.length);
        }
    } else {
        viewDesc.textContent = "Errore nel caricamento della descrizione.";
    }
}

function cleanText(text) {
    // Rimuove tag immagini custom per la visualizzazione testuale
    return text.replace(/\[\[IMMAGINE \d+\]\]/g, '').trim();
}

function createGalleryButton(count) {
    return `<div class="image-attachment-pill" onclick="openLightbox(0)"><div class="icon-box"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div><span>Visualizza Galleria (${count} foto)</span></div>`;
}

// EDITOR LOGIC
async function openEditModal(id = null) {
    if(!isAdmin) return;
    if (userRole === 'ideas_editor' && activeLiveType !== 'ideas') return alert("Permesso negato.");

    tempCoverImage = ''; tempBodyImages = [];
    document.getElementById('fileInputCover').value = '';
    document.getElementById('fileInputBody').value = '';
    document.getElementById('previewImg').style.display = 'none';
    document.getElementById('uploadPlaceholder').style.display = 'block';
    const dl = document.getElementById('categoryOptions');
    dl.innerHTML = '';
    allCategories.forEach(cat => { const opt = createElement('option'); opt.value = cat; dl.appendChild(opt); });

    if(id) {
        showLoader();
        // Fetch full data for edit if not already fetched
        const { data: item, error } = await sbClient.from('news').select('*').eq('id', id).single();
        if(error) { alert(error.message); hideLoader(); return; }
        
        document.getElementById('editId').value = item.id;
        document.getElementById('editTitle').value = item.title;
        document.getElementById('editCategory').value = item.category; 
        document.getElementById('editLikelihood').value = item.likelihood || "1";
        document.getElementById('editDesc').value = item.description || ""; 
        document.getElementById('btnDelete').style.display = 'block';
        if(item.cover_image) {
            tempCoverImage = item.cover_image;
            document.getElementById('previewImg').src = item.cover_image;
            document.getElementById('previewImg').style.display = 'block';
            document.getElementById('uploadPlaceholder').style.display = 'none';
        }
        if(item.body_images) tempBodyImages = [...item.body_images];
        hideLoader();
        showEditView();
    } else {
        document.getElementById('editId').value = '';
        document.getElementById('editTitle').value = '';
        document.getElementById('editCategory').value = '';
        document.getElementById('editDesc').value = '';
        document.getElementById('editLikelihood').value = "1";
        document.getElementById('btnDelete').style.display = 'none';
        showEditView();
    }
}
function showEditView() { document.getElementById('viewMode').classList.add('hidden'); document.getElementById('editMode').classList.remove('hidden'); document.getElementById('modalOverlay').classList.add('active'); }
function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); }
function switchToEdit() { openEditModal(currentActiveNewsId); }

async function saveNews() {
    if(!activeLiveId || !isAdmin) return;
    const idInput = document.getElementById('editId').value;
    const title = document.getElementById('editTitle').value;
    const category = document.getElementById('editCategory').value;
    const likelihood = document.getElementById('editLikelihood').value;
    const rawDescription = document.getElementById('editDesc').value;
    
    if(!title) return alert("Titolo mancante");
    showLoader();
    
    const { text: cleanDescription, images: cleanImages } = optimizeContent(rawDescription, tempBodyImages);
    const payload = { title, category, description: cleanDescription, likelihood, cover_image: tempCoverImage, body_images: cleanImages };
    
    if(idInput) {
        await sbClient.from('news').update(payload).eq('id', idInput);
        showToast("News aggiornata", "success");
    } else {
        const maxOrder = cachedNews.length > 0 ? Math.max(...cachedNews.map(n=>n.order||0)) : -1;
        payload.live_id = activeLiveId; payload.order = maxOrder + 1; payload.is_online = false;
        await sbClient.from('news').insert([payload]);
        showToast("News creata", "success");
    }
    if(category) allCategories.add(category);
    loadNews(activeLiveId);
    closeModal();
}

function optimizeContent(text, images) {
    // Gestione tag immagini placeholder
    const regex = /\[\[IMMAGINE (\d+)\]\]/g;
    let newImages = [];
    let count = 1;
    let newText = text.replace(regex, (match, number) => {
        const originalIndex = parseInt(number) - 1;
        if (images[originalIndex]) {
            newImages.push(images[originalIndex]);
            return `[[TEMP_IMG_${count++}]]`;
        }
        return ''; 
    });
    newText = newText.replace(/\[\[TEMP_IMG_(\d+)\]\]/g, '[[IMMAGINE $1]]');
    return { text: newText, images: newImages };
}

async function deleteCurrentNews() {
    if(!isAdmin) return;
    if(confirm("Eliminare?")) {
        showLoader();
        await sbClient.from('news').delete().eq('id', currentActiveNewsId);
        loadNews(activeLiveId);
        showToast("News eliminata", "success");
        closeModal();
    }
}

// DRAG & DROP
function setupDragDrop(el) {
    el.draggable = true;
    el.addEventListener('dragstart', handleDragStart);
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('drop', handleDrop);
    el.addEventListener('dragend', handleDragEnd);
}
function handleDragStart(e) { dragSrcEl=this; e.dataTransfer.effectAllowed='move'; this.classList.add('dragging'); }
function handleDragOver(e) { e.preventDefault(); return false; }
function handleDrop(e) { e.stopPropagation(); if(dragSrcEl!==this) { swapOrder(parseInt(dragSrcEl.dataset.id), parseInt(this.dataset.id)); } return false; }
function handleDragEnd() { this.classList.remove('dragging'); }
async function swapOrder(sId, tId) {
    const sIdx = cachedNews.findIndex(n=>n.id===sId);
    const tIdx = cachedNews.findIndex(n=>n.id===tId);
    if(sIdx>-1 && tIdx>-1) {
        const [m] = cachedNews.splice(sIdx,1);
        cachedNews.splice(tIdx,0,m);
        cachedNews.forEach((n,i)=>n.order=i);
        refreshUI(); 
        for(let n of cachedNews) await sbClient.from('news').update({ order: n.order }).eq('id', n.id);
    }
}

// IMAGE HANDLING & LIGHTBOX
function handleCoverUpload(input) { resizeImage(input.files[0], 500, 0.6, (base64) => { tempCoverImage = base64; document.getElementById('previewImg').src = tempCoverImage; document.getElementById('previewImg').style.display='block'; document.getElementById('uploadPlaceholder').style.display='none'; }); }
function handleBodyImageUpload(input) {
    Array.from(input.files).forEach((file, index) => {
        resizeImage(file, 2048, 0.85, (base64) => {
            tempBodyImages.push(base64);
            const ta = document.getElementById('editDesc');
            ta.value = ta.value.substring(0, ta.selectionStart) + `\n[[IMMAGINE ${tempBodyImages.length}]]\n` + ta.value.substring(ta.selectionEnd);
            if(index===input.files.length-1) input.value = '';
        });
    });
}
function resizeImage(file, maxWidth, quality, callback) {
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let w = img.width, h = img.height;
            if(w > maxWidth) { h *= maxWidth/w; w=maxWidth; }
            canvas.width = w; canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', quality));
        }; img.src = e.target.result;
    }; reader.readAsDataURL(file);
}
function openLightbox(i) { currentLightboxIndex = i; updateLightbox(); document.getElementById('lightbox').classList.add('active'); }
function closeLightbox() { document.getElementById('lightbox').classList.remove('active'); }
function changeSlide(dir) { currentLightboxIndex += dir; if(currentLightboxIndex < 0) currentLightboxIndex = currentViewImages.length - 1; if(currentLightboxIndex >= currentViewImages.length) currentLightboxIndex = 0; updateLightbox(); }
function updateLightbox() { if(currentViewImages[currentLightboxIndex]) { const img = document.getElementById('lightboxImg'); img.style.opacity = 0; setTimeout(() => { img.src = currentViewImages[currentLightboxIndex]; img.style.opacity = 1; }, 100); } }
document.addEventListener('keydown', (e) => { if(document.getElementById('lightbox').classList.contains('active')) { if(e.key==='ArrowLeft') changeSlide(-1); if(e.key==='ArrowRight') changeSlide(1); if(e.key==='Escape') closeLightbox(); } });
document.getElementById('modalOverlay').addEventListener('click', (e) => { if(e.target.id === 'modalOverlay') closeModal(); });

initApp();