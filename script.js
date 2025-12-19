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
let explodedState = {};
let allVotedNews = [];
let currentHoFType = 'news';

// STATO ADMIN
let isAdmin = false;
let userRole = null; 

// Vista default: 'blog' per utenti, 'grid' per admin. Inizializzato dopo login check.
let currentViewMode = 'blog'; 

const ICON_MOON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
const ICON_SUN = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
const ICON_LOCKED = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
const ICON_UNLOCKED = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;

function getStaticBombs(level) { const n = parseInt(level) || 1; let html = ''; for(let i=0; i<n; i++) { html += `<img src="brick.png" class="static-brick-img" alt="brick">`; } return html; }
function getInteractiveBombs(newsId) { let html = ''; if (!explodedState[newsId]) explodedState[newsId] = [false, false, false]; for(let i=0; i<3; i++) { const isExploded = explodedState[newsId][i]; const explodedClass = isExploded ? 'exploded' : ''; html += `<div class="bomb-container ${explodedClass}" onclick="toggleBomb(event, this, ${newsId}, ${i})"><img src="brick.png" class="bomb-icon-img" alt="Boom Brick"><img src="boom.png" class="boom-img" alt="Explosion"></div>`; } return html; }
function showLoader() { document.getElementById('loader').style.display = 'block'; }
function hideLoader() { document.getElementById('loader').style.display = 'none'; }
function toggleBomb(e, el, newsId, index) { e.stopPropagation(); explodedState[newsId][index] = !explodedState[newsId][index]; const isExploded = explodedState[newsId][index]; if(isExploded) el.classList.add('exploded'); else el.classList.remove('exploded'); if (currentActiveNewsId === newsId) { const modalBombs = document.getElementById('viewInteractiveBombs'); if(modalBombs) modalBombs.innerHTML = getInteractiveBombs(newsId); } const card = document.querySelector(`.card[data-id="${newsId}"]`) || document.querySelector(`.blog-card[data-id="${newsId}"]`); if (card) { const bombContainer = card.querySelector('.card-bombs'); if (bombContainer) bombContainer.innerHTML = getInteractiveBombs(newsId); } }
async function checkSession() { if(!sbClient) return; try { const { data, error } = await sbClient.auth.getSession(); if (error) updateAuthUI(null); else updateAuthUI(data.session); sbClient.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || event === 'USER_DELETED') updateAuthUI(null); else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') updateAuthUI(session); }); } catch (err) { updateAuthUI(null); } }

function updateAuthUI(session) { 
    isAdmin = !!session;
    userRole = null;

    if (isAdmin && session.user) {
        if (session.user.email === 'dreamnbricks@gmail.com') {
            userRole = 'ideas_editor';
        } else {
            userRole = 'superadmin'; 
        }
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

        if (userRole === 'ideas_editor') {
            document.getElementById('btnAddNewsLive').style.display = 'none';
        } else {
            document.getElementById('btnAddNewsLive').style.display = 'block';
        }

    } else { 
        document.body.classList.remove('is-admin'); 
        authIcon.innerHTML = ICON_LOCKED; 
        
        // FORZA VISTA BLOG PER UTENTI
        currentViewMode = 'blog'; 
        
        userModeList.style.display = 'block';
        userModeSection.style.display = 'flex';
        document.getElementById('btnAddNewsLive').style.display = 'none';
    } 
    
    if(allLives.length > 0) loadLives();
    if(activeLiveId) refreshUI(); 
}

function setAdminMode(mode) {
    if(!isAdmin) return; // Solo admin può cambiare modalità

    // Admin vede Grid in management, Blog in user view
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
        if (userRole === 'ideas_editor' && type !== 'ideas') {
            canEditLive = false;
        }
        
        let actionButtons = '';
        if (canEditLive) {
            actionButtons = `<div class="live-actions"><button class="action-btn admin-only" title="Modifica" onclick="renameLive(event, ${live.id}, '${live.name.replace(/'/g, "\\'")}', '${live.live_date}', '${live.youtube_link || ''}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button class="action-btn delete-btn admin-only" title="Elimina" onclick="deleteLive(event, ${live.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button></div>`;
        }
        
        li.innerHTML = `<div class="live-item-content" onclick="selectLive({id: ${live.id}, name: '${live.name.replace(/'/g, "\\'")}', type: '${type}'})">${thumbHTML}<div class="live-info"><span class="live-name">${live.name}</span><span class="live-date">${live.live_date || ''}</span></div></div>${actionButtons}`; 
        
        if (type === 'ideas') {
            listIdeas.appendChild(li);
        } else {
            listNews.appendChild(li);
        }
    }); 
    
    if(allLives.length > 0 && !activeLiveId) loadLatestLivePreview(allLives[0].id); 
}

async function loadLatestLivePreview(liveId) { if(!sbClient || !liveId) return; const { data, error } = await sbClient.from('news').select('cover_image').eq('live_id', liveId).not('cover_image', 'is', null).limit(12); const container = document.getElementById('latestLiveBg'); if (container && !error && data && data.length > 0) { container.innerHTML = ''; data.forEach(item => { const img = document.createElement('img'); img.src = item.cover_image; container.appendChild(img); }); container.style.opacity = '1'; } }

async function createNewLive(type) { 
    if(!isAdmin) return;
    if (userRole === 'ideas_editor' && type !== 'ideas') {
        return alert("Permesso negato: Puoi creare solo live Ideas.");
    }

    const name = prompt(`Nome Nuova ${type === 'ideas' ? 'Ideas' : 'News'} Live:`); 
    if(!name) return; 
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
    items.forEach(i => {
        if(i.innerText.includes(live.name)) i.classList.add('active');
    });
    
    // Se è grid (admin), sblocca.
    if(currentViewMode === 'grid') {
        document.getElementById('sidebar').classList.remove('locked');
    }
    
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('mainHeader').style.display = 'flex';
    document.getElementById('headerTitle').innerText = live.name;
    document.getElementById('stickyFilterContainer').style.display = 'block';

    // MODIFICA: Gestione loghi header
    const secondaryLogo = document.getElementById('secondaryLogo');
    if (secondaryLogo) {
        secondaryLogo.style.display = 'block';
        if (activeLiveType === 'ideas') {
            secondaryLogo.src = 'logo_dream.jpg';
        } else {
            secondaryLogo.src = 'logo_itavix.png';
        }
    }

    const addBtn = document.getElementById('btnMainAddNews');
    if (isAdmin) {
        if (userRole === 'ideas_editor' && activeLiveType !== 'ideas') {
            addBtn.style.display = 'none';
        } else {
            addBtn.style.display = 'flex';
        }
    } else {
        addBtn.style.display = 'none';
    }
    
    loadNews(live.id);
}

function switchToUserMode() {
    if(window.innerWidth < 1024) document.getElementById('sidebar').classList.add('collapsed');
    
    // FORZA BLOG
    currentViewMode = 'blog';
    
    document.getElementById('sidebar').classList.add('locked');
    document.querySelectorAll('.live-item').forEach(el => el.classList.remove('active'));
    document.getElementById('btnUserLive').classList.add('active');
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('mainHeader').style.display = 'flex';
    document.getElementById('headerTitle').innerText = "Live Utenti";
    document.getElementById('stickyFilterContainer').style.display = 'block';
    document.getElementById('btnMainAddNews').style.display = 'none'; 

    // Nascondi logo secondario in modalità utente/generica se necessario, 
    // oppure mantieni l'ultimo impostato. Per sicurezza lo nascondiamo o lasciamo default.
    const secondaryLogo = document.getElementById('secondaryLogo');
    if(secondaryLogo) secondaryLogo.style.display = 'none';

    if(allLives.length > 0) {
        activeLiveId = allLives[0].id;
        loadNews(activeLiveId);
    }
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }

async function loadNews(liveId) {
    showLoader();
    const { data: news, error } = await sbClient
        .from('news')
        .select('id, live_id, title, category, likelihood, cover_image, description, order, is_online, votes')
        .eq('live_id', liveId)
        .order('order', { ascending: true });
    if (error) { alert(error.message); hideLoader(); return; }
    cachedNews = news; 
    news.forEach(n => { if(n.category) allCategories.add(n.category); });
    refreshUI();
    hideLoader();
}

async function toggleNewsStatus(id, newStatus) {
    if (userRole === 'ideas_editor' && activeLiveType !== 'ideas') return;

    const newsItem = cachedNews.find(n => n.id === id);
    if (newsItem) newsItem.is_online = newStatus;
    refreshUI(); 
    const { error } = await sbClient.from('news').update({ is_online: newStatus }).eq('id', id);
    if (error) { alert("Errore aggiornamento"); if (newsItem) newsItem.is_online = !newStatus; refreshUI(); }
}

function refreshUI() {
    const liveCategories = new Set();
    cachedNews.forEach(n => { if(n.category) liveCategories.add(n.category); });
    renderNavPills(liveCategories);
    if (currentFilter !== 'Tutti' && !liveCategories.has(currentFilter)) currentFilter = 'Tutti';
    updatePillsState();
    
    if(currentViewMode === 'blog') {
        renderBlogFromCache();
    } else {
        renderGridFromCache();
    }
}

function renderNavPills(liveCats) {
    const container = document.getElementById('navPillsContainer');
    container.innerHTML = '';
    const allBtn = document.createElement('div');
    allBtn.className = 'nav-item';
    allBtn.innerText = 'Tutti';
    allBtn.onclick = () => filterNews('Tutti');
    container.appendChild(allBtn);
    liveCats.forEach(cat => {
        const btn = document.createElement('div');
        btn.className = 'nav-item';
        btn.innerText = cat;
        btn.onclick = () => filterNews(cat);
        container.appendChild(btn);
    });
}
function updatePillsState() {
    document.querySelectorAll('.nav-item').forEach(p => {
        if(p.innerText === currentFilter) p.classList.add('active'); else p.classList.remove('active');
    });
}

function renderGridFromCache() {
    const grid = document.getElementById('newsGrid');
    grid.className = 'grid-container';
    grid.innerHTML = '';
    let filtered = cachedNews;
    if(currentFilter !== 'Tutti') filtered = cachedNews.filter(n => n.category === currentFilter);
    if (!isAdmin) filtered = filtered.filter(n => n.is_online === true);

    let canEditContent = isAdmin;
    if (userRole === 'ideas_editor' && activeLiveType !== 'ideas') canEditContent = false;

    const fragment = document.createDocumentFragment();
    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.id = item.id; 
        if (isAdmin && !item.is_online) card.classList.add('offline-mode');
        
        // DRAG & DROP ATTIVO PER TUTTI
        card.draggable = true; 
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);
        
        card.onclick = (e) => { 
            if(e.target.closest('.admin-toggle-container') || e.target.closest('.bomb-container') || e.target.closest('.trophy-container') || card.classList.contains('dragging')) return;
            openViewModal(item); 
        }; 
        
        let toggleHTML = '';
        if (isAdmin && canEditContent) {
            toggleHTML = `<div class="admin-toggle-container" onclick="event.stopPropagation()">
                    <span class="toggle-status-label">${item.is_online ? 'ON' : 'OFF'}</span>
                    <label class="apple-switch"><input type="checkbox" ${item.is_online ? 'checked' : ''} onchange="toggleNewsStatus(${item.id}, this.checked)"><span class="slider"></span></label>
                </div>`;
        }

        const hasVoted = localStorage.getItem(`vote_${item.id}`) === 'true';
        const voteClass = hasVoted ? 'voted' : '';

        const titleParts = item.title.split(' ');
        const firstWord = titleParts[0] || '';
        const restOfTitle = titleParts.slice(1).join(' ');
        const titleHtml = `<span style="color: var(--text-main); font-weight: 800;">${firstWord}</span> <span style="color: var(--text-sec); font-weight: 500;">${restOfTitle}</span>`;
        const bg = item.cover_image ? item.cover_image : '';
        
        card.innerHTML = `
            <div class="card-image-wrapper">
                <div class="fade-overlay"></div>
                <img src="${bg}" class="card-image-small" loading="lazy" alt="${item.title}">
                ${toggleHTML}
            </div>
            <div class="card-content">
                <div class="card-meta-row">
                    <div style="display:flex; align-items:center;">
                        <span class="card-category">${item.category}</span>
                        ${getStaticBombs(item.likelihood)}
                    </div>
                    <div class="trophy-container ${voteClass}" onclick="toggleBestNews(event, ${item.id}, this)">
                        <svg class="trophy-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                        </svg>
                    </div>
                </div>
                <div class="card-meta-row" style="margin-top: -5px; margin-bottom: 8px;">
                     <div class="card-bombs">${getInteractiveBombs(item.id)}</div>
                </div>
                <h3 class="card-title">${titleHtml}</h3>
            </div>
        `;
        fragment.appendChild(card);
    });
    grid.appendChild(fragment);
}

function renderBlogFromCache() {
    const container = document.getElementById('newsGrid');
    container.className = 'blog-container';
    container.innerHTML = '';
    
    let filtered = cachedNews;
    if(currentFilter !== 'Tutti') filtered = cachedNews.filter(n => n.category === currentFilter);
    if (!isAdmin) filtered = filtered.filter(n => n.is_online === true);

    let canEditContent = isAdmin;
    if (userRole === 'ideas_editor' && activeLiveType !== 'ideas') canEditContent = false;

    const fragment = document.createDocumentFragment();
    filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'blog-card';
        card.dataset.id = item.id;
        
        // DRAG & DROP ATTIVO PER TUTTI
        card.draggable = true; 
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragover', handleDragOver);
        card.addEventListener('drop', handleDrop);
        card.addEventListener('dragend', handleDragEnd);
        
        card.onclick = (e) => { 
            if(e.target.closest('.admin-toggle-container') || e.target.closest('.bomb-container') || e.target.closest('.trophy-container')) return;
            openViewModal(item); 
        };

        let toggleHTML = '';
        if (isAdmin && canEditContent) {
            toggleHTML = `<div class="admin-toggle-container" onclick="event.stopPropagation()" style="top:10px; right:10px;">
                    <label class="apple-switch"><input type="checkbox" ${item.is_online ? 'checked' : ''} onchange="toggleNewsStatus(${item.id}, this.checked)"><span class="slider"></span></label>
                </div>`;
        }

        const hasVoted = localStorage.getItem(`vote_${item.id}`) === 'true';
        const voteClass = hasVoted ? 'voted' : '';
        const bg = item.cover_image ? item.cover_image : '';
        
        let plainText = item.description.replace(/\[\[IMMAGINE \d+\]\]/g, '').replace(/<[^>]*>?/gm, '').trim();
        if(plainText.length > 120) plainText = plainText.substring(0, 120) + "...";

        card.innerHTML = `
            <div class="blog-image-wrapper">
                <img src="${bg}" class="blog-image" loading="lazy" alt="${item.title}">
                ${toggleHTML}
            </div>
            <div class="blog-content">
                <div class="blog-meta-row">
                    <span class="blog-category">${item.category}</span>
                    <div class="trophy-container ${voteClass}" onclick="toggleBestNews(event, ${item.id}, this)">
                        <svg class="trophy-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
                        </svg>
                    </div>
                </div>
                <h3 class="blog-title">${item.title}</h3>
                <div style="margin-bottom: 15px;">${getStaticBombs(item.likelihood)}</div>
                <p class="blog-desc">${plainText}</p>
                <div class="card-bombs" style="margin-top: auto; padding-top: 10px;">${getInteractiveBombs(item.id)}</div>
            </div>
        `;
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

function filterNews(cat) { currentFilter = cat; refreshUI(); }

// --- BEST NEWS LOGIC ---
async function toggleBestNews(e, newsId, el) {
    e.stopPropagation();
    const storageKey = `vote_${newsId}`;
    const isVoted = localStorage.getItem(storageKey) === 'true';
    
    if (!isVoted) {
        el.classList.add('voted');
        localStorage.setItem(storageKey, 'true');
    } else {
        el.classList.remove('voted');
        localStorage.removeItem(storageKey);
    }

    if(!sbClient) return;
    const { data, error } = await sbClient.from('news').select('votes').eq('id', newsId).single();
    if(!error) {
        const current = data.votes || 0;
        const next = isVoted ? Math.max(0, current - 1) : current + 1;
        await sbClient.from('news').update({ votes: next }).eq('id', newsId);
    }
}

async function openBestNewsModal() {
    if(!sbClient) return;
    showLoader();
    const { data: bestNews, error } = await sbClient
        .from('news')
        .select('id, title, cover_image, votes, live_id')
        .gt('votes', 0)
        .order('votes', { ascending: false })
        .limit(100);
    
    hideLoader();
    if(error) return alert("Errore caricamento classifica");
    
    allVotedNews = bestNews || [];
    currentHoFType = activeLiveType || 'news';

    const container = document.getElementById('bestNewsListContainer');
    // Init Structure
    container.innerHTML = `
        <div style="display: flex; justify-content: center; margin-bottom: 20px;">
            <div class="nav-pills" style="width: auto;">
                <div class="nav-item ${currentHoFType === 'news' ? 'active' : ''}" onclick="switchHoF('news')">News</div>
                <div class="nav-item ${currentHoFType === 'ideas' ? 'active' : ''}" onclick="switchHoF('ideas')">Ideas</div>
            </div>
        </div>
        <div id="hofListContent"></div>
    `;
    
    switchHoF(currentHoFType);
    document.getElementById('bestNewsModal').classList.add('active');
}

function switchHoF(type) {
    currentHoFType = type;
    // Update tabs
    const tabs = document.querySelectorAll('#bestNewsListContainer .nav-item');
    tabs.forEach(t => {
        if(t.innerText.toLowerCase() === type) t.classList.add('active');
        else t.classList.remove('active');
    });

    const listContainer = document.getElementById('hofListContent');
    
    const liveTypeMap = {};
    allLives.forEach(l => liveTypeMap[l.id] = (l.type || 'news')); 

    const filtered = allVotedNews.filter(n => {
        const lType = liveTypeMap[n.live_id] || 'news'; 
        return lType === type;
    });

    if(filtered.length === 0) {
        listContainer.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-sec);">Nessuna classifica per questa categoria.</div>';
        return;
    }

    const liveNameMap = {};
    allLives.forEach(l => liveNameMap[l.id] = l.name);

    let html = '<ul class="ranking-list">';
    filtered.forEach((news, index) => {
        const liveName = liveNameMap[news.live_id] || 'Live passata';
        const thumb = news.cover_image || 'brick.png';
        html += `
        <li class="ranking-item">
            <div class="ranking-pos">${index + 1}</div>
            <img src="${thumb}" class="ranking-thumb" alt="thumb">
            <div class="ranking-info">
                <div class="ranking-title">${news.title}</div>
                <div class="ranking-live">${liveName}</div>
            </div>
            <div class="ranking-votes">
                <span class="vote-number">${news.votes}</span>
                <span class="vote-label">Voti</span>
            </div>
        </li>`;
    });
    html += '</ul>';
    listContainer.innerHTML = html;
}

function closeBestNewsModal() { document.getElementById('bestNewsModal').classList.remove('active'); }


async function openViewModal(partialItem) {
    currentActiveNewsId = partialItem.id;
    document.getElementById('viewTitle').innerText = partialItem.title;
    document.getElementById('viewCategory').innerText = partialItem.category;
    document.getElementById('viewStaticBombs').innerHTML = getStaticBombs(partialItem.likelihood);
    document.getElementById('viewInteractiveBombs').innerHTML = getInteractiveBombs(partialItem.id);
    const viewImg = document.getElementById('viewImage');
    viewImg.style.backgroundImage = partialItem.cover_image ? `url('${partialItem.cover_image}')` : 'none';
    if(!partialItem.cover_image) viewImg.style.backgroundColor = '#eee';
    
    const cleanText = formatDescriptionTextOnly(partialItem.description);
    document.getElementById('viewDesc').innerHTML = cleanText;
    document.getElementById('viewImagesContainer').innerHTML = ''; 
    
    document.getElementById('viewMode').classList.remove('hidden');
    document.getElementById('editMode').classList.add('hidden');
    document.getElementById('modalOverlay').classList.add('active');
    
    const modalMainCard = document.querySelector('#modalOverlay .modal-card'); 
    if(currentViewMode === 'blog') {
        document.getElementById('modalOverlay').classList.add('fullscreen-mode');
        modalMainCard.classList.add('fullscreen');
    } else {
        document.getElementById('modalOverlay').classList.remove('fullscreen-mode');
        modalMainCard.classList.remove('fullscreen');
    }

    const btnEditContainer = document.getElementById('btnEditNewsContainer');
    if (isAdmin) {
        if (userRole === 'ideas_editor' && activeLiveType !== 'ideas') {
            btnEditContainer.style.display = 'none';
        } else {
            btnEditContainer.style.display = 'flex';
        }
    } else {
        btnEditContainer.style.display = 'none';
    }

    const { data: fullItem, error } = await sbClient.from('news').select('body_images').eq('id', partialItem.id).single();
    if (!error && fullItem) {
        currentViewImages = fullItem.body_images || [];
        if (currentViewImages.length > 0) {
            setTimeout(() => { document.getElementById('viewImagesContainer').innerHTML = createGalleryButton(currentViewImages.length); }, 100); 
        }
    }
}

function formatDescriptionTextOnly(text) {
    if(!text) return '';
    let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    s = s.replace(/(\r\n|\n|\r)*\s*\[\[IMMAGINE \d+\]\]\s*(\r\n|\n|\r)*/g, ''); 
    return s;
}

function createGalleryButton(count) {
    return `<div class="image-attachment-pill" onclick="openLightbox(0)">
        <div class="icon-box"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>
        <span>Visualizza Galleria (${count} foto)</span></div>`;
}

async function openEditModal(id = null) {
    if(!isAdmin) return;
    if (userRole === 'ideas_editor' && activeLiveType !== 'ideas') return alert("Non hai i permessi per modificare News.");

    tempCoverImage = ''; tempBodyImages = [];
    document.getElementById('fileInputCover').value = '';
    document.getElementById('fileInputBody').value = '';
    document.getElementById('previewImg').style.display = 'none';
    document.getElementById('uploadPlaceholder').style.display = 'block';
    const dl = document.getElementById('categoryOptions');
    dl.innerHTML = '';
    allCategories.forEach(cat => { const opt = document.createElement('option'); opt.value = cat; dl.appendChild(opt); });
    if(id) {
        showLoader();
        const { data: item, error } = await sbClient.from('news').select('*').eq('id', id).single();
        if(error) { alert(error.message); hideLoader(); return; }
        document.getElementById('editId').value = item.id;
        document.getElementById('editTitle').value = item.title;
        document.getElementById('editCategory').value = item.category; 
        document.getElementById('editLikelihood').value = item.likelihood || "1";
        document.getElementById('editDesc').value = item.description; 
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
    if (userRole === 'ideas_editor' && activeLiveType !== 'ideas') return alert("Permesso negato");

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
    } else {
        const maxOrder = cachedNews.length > 0 ? Math.max(...cachedNews.map(n=>n.order||0)) : -1;
        payload.live_id = activeLiveId; payload.order = maxOrder + 1; payload.is_online = false;
        await sbClient.from('news').insert([payload]);
    }
    if(category) allCategories.add(category);
    loadNews(activeLiveId);
    closeModal();
}

function optimizeContent(text, images) {
    const regex = /\[\[IMMAGINE (\d+)\]\]/g;
    let matches = [...text.matchAll(regex)];
    let newImages = [];
    matches.forEach(match => { const originalIndex = parseInt(match[1]) - 1; if (images[originalIndex]) newImages.push(images[originalIndex]); });
    let count = 1;
    let newText = text.replace(regex, (match, number) => {
        const originalIndex = parseInt(number) - 1;
        if (images[originalIndex]) return `[[TEMP_IMG_${count++}]]`;
        return ''; 
    });
    newText = newText.replace(/\[\[TEMP_IMG_(\d+)\]\]/g, '[[IMMAGINE $1]]');
    return { text: newText, images: newImages };
}

async function deleteCurrentNews() {
    if(!isAdmin) return;
    if (userRole === 'ideas_editor' && activeLiveType !== 'ideas') return alert("Permesso negato");
    
    if(confirm("Eliminare?")) {
        showLoader();
        await sbClient.from('news').delete().eq('id', currentActiveNewsId);
        loadNews(activeLiveId);
        closeModal();
    }
}

function handleCoverUpload(input) {
    const file = input.files[0]; if(!file) return;
    resizeImage(file, 500, 0.6, (base64) => {
        tempCoverImage = base64;
        document.getElementById('previewImg').src = tempCoverImage;
        document.getElementById('previewImg').style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
    });
}
function handleBodyImageUpload(input) {
    const files = input.files; if(!files || files.length === 0) return;
    Array.from(files).forEach((file, index) => {
        resizeImage(file, 2048, 0.85, (base64) => {
            tempBodyImages.push(base64);
            const ta = document.getElementById('editDesc');
            const tag = `\n[[IMMAGINE ${tempBodyImages.length}]]\n`;
            ta.value = ta.value.substring(0, ta.selectionStart) + tag + ta.value.substring(ta.selectionEnd);
            if(index===files.length-1) input.value = '';
        });
    });
}
function resizeImage(file, maxWidth, quality, callback) {
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

function openLightbox(i) {
    currentLightboxIndex = i; updateLightbox();
    document.getElementById('lightbox').classList.add('active');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('active'); }
function changeSlide(dir) {
    currentLightboxIndex += dir;
    if(currentLightboxIndex < 0) currentLightboxIndex = currentViewImages.length - 1;
    if(currentLightboxIndex >= currentViewImages.length) currentLightboxIndex = 0;
    updateLightbox();
}
function updateLightbox() {
    if(currentViewImages[currentLightboxIndex]) {
        const img = document.getElementById('lightboxImg');
        img.style.opacity = 0;
        setTimeout(() => { img.src = currentViewImages[currentLightboxIndex]; img.style.opacity = 1; }, 100);
    }
}
document.addEventListener('keydown', (e) => { if(document.getElementById('lightbox').classList.contains('active')) { if(e.key==='ArrowLeft') changeSlide(-1); if(e.key==='ArrowRight') changeSlide(1); if(e.key==='Escape') closeLightbox(); } });

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
        for(let n of cachedNews) { await sbClient.from('news').update({ order: n.order }).eq('id', n.id); }
    }
}

document.getElementById('modalOverlay').addEventListener('click', (e) => { if(e.target.id === 'modalOverlay') closeModal(); });
initApp();