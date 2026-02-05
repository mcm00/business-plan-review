// ========== APP STATE ==========
const state = {
    currentUser: 'Francisco',
    sections: [],
    discussions: [],
    notifications: [],
    activeFilter: 'all',
    activeSectionId: null
};

const API_BASE = '';

// ========== DOM ELEMENTS ==========
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const elements = {
    menuToggle: $('#menu-toggle'),
    sidebar: $('#sidebar'),
    sidebarOverlay: $('#sidebar-overlay'),
    navList: $('#nav-list'),
    sidebarStats: $('#sidebar-stats'),
    mainContent: $('#main-content'),
    loading: $('#loading'),
    sectionsContainer: $('#sections-container'),
    panel: $('#panel'),
    panelClose: $('#panel-close'),
    panelFilters: $('#panel-filters'),
    discussionList: $('#discussion-list'),
    addForm: $('#add-form'),
    sectionSelect: $('#section-select'),
    formTextarea: $('#form-textarea'),
    fab: $('#fab'),
    fabBadge: $('#fab-badge'),
    currentUser: $('#current-user'),
    currentAvatar: $('#current-avatar'),
    notificationBtn: $('#notification-btn'),
    notificationBadge: $('#notification-badge'),
    notificationPanel: $('#notification-panel'),
    notificationList: $('#notification-list'),
    markAllRead: $('#mark-all-read'),
    toast: $('#toast')
};

// ========== UTILITY FUNCTIONS ==========
function formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    setTimeout(() => elements.toast.classList.remove('show'), 3000);
}

function parseMarkdown(text) {
    return text
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\|(.+)\|/g, (match) => {
            const cells = match.split('|').filter(c => c.trim());
            if (cells.some(c => c.includes('---'))) return '';
            const tag = match.includes('**') ? 'th' : 'td';
            const row = cells.map(c => `<${tag}>${c.replace(/\*\*/g, '').trim()}</${tag}>`).join('');
            return `<tr>${row}</tr>`;
        })
        .replace(/(<tr>.*<\/tr>)+/gs, '<table>$&</table>')
        .replace(/✅/g, '<span style="color: var(--success)">✅</span>')
        .replace(/❌/g, '<span style="color: var(--danger)">❌</span>');
}

// ========== API FUNCTIONS ==========
async function fetchSections() {
    const res = await fetch(`${API_BASE}/api/sections`);
    return res.json();
}

async function fetchDiscussions() {
    const res = await fetch(`${API_BASE}/api/discussions`);
    return res.json();
}

async function fetchStats() {
    const res = await fetch(`${API_BASE}/api/stats`);
    return res.json();
}

async function fetchNotifications(user) {
    const res = await fetch(`${API_BASE}/api/notifications/${user}`);
    return res.json();
}

async function createDiscussion(data) {
    const res = await fetch(`${API_BASE}/api/discussions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

async function addReply(discussionId, data) {
    const res = await fetch(`${API_BASE}/api/discussions/${discussionId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

async function resolveDiscussion(id, resolved, resolvedBy) {
    const res = await fetch(`${API_BASE}/api/discussions/${id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved, resolved_by: resolvedBy })
    });
    return res.json();
}

async function markNotificationRead(id) {
    await fetch(`${API_BASE}/api/notifications/${id}/read`, { method: 'PATCH' });
}

async function markAllNotificationsRead(user) {
    await fetch(`${API_BASE}/api/notifications/${user}/read-all`, { method: 'PATCH' });
}

// ========== RENDER FUNCTIONS ==========
function renderNavigation() {
    elements.navList.innerHTML = state.sections.map((section, index) => {
        const discussions = state.discussions.filter(d => d.section_id === section.id && !d.resolved);
        const comments = discussions.filter(d => d.type === 'comment').length;
        const questions = discussions.filter(d => d.type === 'question').length;

        return `
            <li class="nav-item ${index === 0 ? 'active' : ''}" data-id="${section.id}">
                <span class="nav-item-title">${section.title}</span>
                <div class="nav-badges">
                    ${comments ? `<span class="badge badge-comment">${comments}</span>` : ''}
                    ${questions ? `<span class="badge badge-question">${questions}</span>` : ''}
                </div>
            </li>
        `;
    }).join('');

    // Add click handlers
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            $$('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const sectionId = item.dataset.id;
            document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth' });
            closeSidebar();
        });
    });

    // Update section selector
    elements.sectionSelect.innerHTML = `
        <option value="">General</option>
        ${state.sections.map(s => `<option value="${s.id}">${s.title}</option>`).join('')}
    `;
}

function renderSections() {
    elements.loading.style.display = 'none';
    elements.sectionsContainer.innerHTML = state.sections.map(section => {
        const discussions = state.discussions.filter(d => d.section_id === section.id);
        const pending = discussions.filter(d => !d.resolved).length;

        return `
            <article class="section-card" id="section-${section.id}">
                <header class="section-header">
                    <h2 class="section-title">${section.title}</h2>
                    <div class="section-actions">
                        <button class="btn-section" onclick="addFeedbackToSection(${section.id})">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                            </svg>
                            <span>Add Feedback</span>
                        </button>
                    </div>
                </header>
                <div class="section-body">
                    <div class="section-content">${parseMarkdown(section.content)}</div>
                </div>
                <footer class="section-footer">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
                    </svg>
                    <span>${pending} pending feedback</span>
                </footer>
            </article>
        `;
    }).join('');
}

function renderDiscussions() {
    let discussions = [...state.discussions];

    // Apply filter
    switch (state.activeFilter) {
        case 'comments':
            discussions = discussions.filter(d => d.type === 'comment');
            break;
        case 'questions':
            discussions = discussions.filter(d => d.type === 'question');
            break;
        case 'resolved':
            discussions = discussions.filter(d => d.resolved);
            break;
        case 'pending':
            discussions = discussions.filter(d => !d.resolved);
            break;
    }

    // Update FAB badge
    const pendingCount = state.discussions.filter(d => !d.resolved).length;
    elements.fabBadge.textContent = pendingCount;
    elements.fabBadge.dataset.count = pendingCount;

    if (discussions.length === 0) {
        elements.discussionList.innerHTML = `
            <div class="empty-state">
                <p>No discussions yet.<br>Add a comment or question below!</p>
            </div>
        `;
        return;
    }

    elements.discussionList.innerHTML = discussions.map(d => {
        const isWife = d.author === 'Wife';
        const avatarClass = isWife ? 'avatar-wife' : 'avatar-francisco';
        const avatarLetter = isWife ? 'W' : 'F';

        return `
            <div class="discussion-item type-${d.type} ${d.resolved ? 'resolved' : ''}" data-id="${d.id}">
                <div class="discussion-header">
                    <div class="discussion-meta">
                        <div class="avatar ${avatarClass}">${avatarLetter}</div>
                        <div>
                            <div class="discussion-author">${d.author}</div>
                            <div class="discussion-time">${formatTime(d.created_at)}</div>
                        </div>
                    </div>
                    <span class="discussion-type">${d.type}</span>
                </div>
                ${d.section_title ? `<div class="discussion-section">📍 ${d.section_title}</div>` : ''}
                <div class="discussion-text">${d.text}</div>
                <div class="discussion-actions">
                    <button class="action-btn reply" onclick="toggleReplyForm(${d.id})">Reply</button>
                    ${d.resolved
                        ? `<button class="action-btn" onclick="handleResolve(${d.id}, false)">Reopen</button>`
                        : `<button class="action-btn resolve" onclick="handleResolve(${d.id}, true)">✓ Resolve</button>`
                    }
                </div>
                ${d.replies && d.replies.length > 0 ? `
                    <div class="replies">
                        ${d.replies.map(r => {
                            const rIsWife = r.author === 'Wife';
                            const rAvatarClass = rIsWife ? 'avatar-wife' : 'avatar-francisco';
                            const rAvatarLetter = rIsWife ? 'W' : 'F';
                            return `
                                <div class="reply">
                                    <div class="avatar ${rAvatarClass}">${rAvatarLetter}</div>
                                    <div class="reply-content">
                                        <div class="reply-header">
                                            <span class="reply-author">${r.author}</span>
                                            <span class="reply-time">${formatTime(r.created_at)}</span>
                                        </div>
                                        <div class="reply-text">${r.text}</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
                <div class="reply-form" id="reply-form-${d.id}">
                    <input type="text" class="reply-input" id="reply-input-${d.id}" placeholder="Write a reply...">
                    <div class="reply-form-actions">
                        <button class="btn-cancel" onclick="toggleReplyForm(${d.id})">Cancel</button>
                        <button class="btn-reply" onclick="submitReply(${d.id})">Reply</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function renderStats() {
    const stats = await fetchStats();

    elements.sidebarStats.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">${stats.totalComments}</div>
                <div class="stat-label">Comments</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.totalQuestions}</div>
                <div class="stat-label">Questions</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.resolved}</div>
                <div class="stat-label">Resolved</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.pending}</div>
                <div class="stat-label">Pending</div>
            </div>
        </div>
    `;
}

async function renderNotifications() {
    state.notifications = await fetchNotifications(state.currentUser);
    const unread = state.notifications.filter(n => !n.read).length;

    elements.notificationBadge.textContent = unread;
    elements.notificationBadge.dataset.count = unread;

    if (state.notifications.length === 0) {
        elements.notificationList.innerHTML = `
            <div class="empty-state">
                <p>No notifications yet</p>
            </div>
        `;
        return;
    }

    elements.notificationList.innerHTML = state.notifications.map(n => `
        <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}" onclick="handleNotificationClick(${n.id}, ${n.discussion_id})">
            <div class="notification-message">${n.message}</div>
            <div class="notification-time">${formatTime(n.created_at)}</div>
        </div>
    `).join('');
}

// ========== EVENT HANDLERS ==========
function updateUserAvatar() {
    const isWife = state.currentUser === 'Wife';
    elements.currentAvatar.textContent = isWife ? 'W' : 'F';
    elements.currentAvatar.className = `avatar ${isWife ? 'avatar-wife' : 'avatar-francisco'}`;
}

function closeSidebar() {
    elements.sidebar.classList.remove('open');
    elements.sidebarOverlay.classList.remove('open');
}

function openPanel() {
    elements.panel.classList.add('open');
}

function closePanel() {
    elements.panel.classList.remove('open');
}

window.addFeedbackToSection = function(sectionId) {
    elements.sectionSelect.value = sectionId;
    openPanel();
    elements.formTextarea.focus();
};

window.toggleReplyForm = function(id) {
    const form = document.getElementById(`reply-form-${id}`);
    form.classList.toggle('open');
    if (form.classList.contains('open')) {
        document.getElementById(`reply-input-${id}`).focus();
    }
};

window.submitReply = async function(discussionId) {
    const input = document.getElementById(`reply-input-${discussionId}`);
    const text = input.value.trim();

    if (!text) return;

    await addReply(discussionId, {
        text,
        author: state.currentUser
    });

    input.value = '';
    toggleReplyForm(discussionId);

    // Reload discussions
    state.discussions = await fetchDiscussions();
    renderDiscussions();
    renderNavigation();
    renderStats();
    showToast('Reply added');
};

window.handleResolve = async function(id, resolved) {
    await resolveDiscussion(id, resolved, state.currentUser);

    state.discussions = await fetchDiscussions();
    renderDiscussions();
    renderSections();
    renderNavigation();
    renderStats();
    showToast(resolved ? 'Marked as resolved' : 'Discussion reopened');
};

window.handleNotificationClick = async function(notifId, discussionId) {
    await markNotificationRead(notifId);
    renderNotifications();

    // Find and highlight discussion
    if (discussionId) {
        openPanel();
        const discEl = document.querySelector(`.discussion-item[data-id="${discussionId}"]`);
        if (discEl) {
            discEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            discEl.style.animation = 'highlight 1s ease';
        }
    }

    elements.notificationPanel.classList.remove('open');
};

// ========== INITIALIZE ==========
async function init() {
    // Load data
    try {
        state.sections = await fetchSections();
        state.discussions = await fetchDiscussions();

        renderNavigation();
        renderSections();
        renderDiscussions();
        renderStats();
        renderNotifications();
    } catch (err) {
        console.error('Failed to load data:', err);
        elements.loading.innerHTML = `
            <p style="color: var(--danger)">Failed to load data. Make sure the server is running.</p>
            <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer;">
                Retry
            </button>
        `;
    }

    // Event listeners
    elements.currentUser.addEventListener('change', async (e) => {
        state.currentUser = e.target.value;
        updateUserAvatar();
        await renderNotifications();
        showToast(`Now reviewing as ${state.currentUser}`);
    });

    elements.menuToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('open');
        elements.sidebarOverlay.classList.toggle('open');
    });

    elements.sidebarOverlay.addEventListener('click', closeSidebar);

    elements.fab.addEventListener('click', openPanel);
    elements.panelClose.addEventListener('click', closePanel);

    elements.notificationBtn.addEventListener('click', () => {
        elements.notificationPanel.classList.toggle('open');
    });

    elements.markAllRead.addEventListener('click', async () => {
        await markAllNotificationsRead(state.currentUser);
        renderNotifications();
        showToast('All notifications marked as read');
    });

    // Close notification panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!elements.notificationPanel.contains(e.target) &&
            !elements.notificationBtn.contains(e.target)) {
            elements.notificationPanel.classList.remove('open');
        }
    });

    // Filter buttons
    $$('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            $$('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            state.activeFilter = chip.dataset.filter;
            renderDiscussions();
        });
    });

    // Add form submit
    elements.addForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = document.querySelector('input[name="type"]:checked').value;
        const sectionId = elements.sectionSelect.value;
        const text = elements.formTextarea.value.trim();

        if (!text) return;

        await createDiscussion({
            section_id: sectionId || null,
            type,
            text,
            author: state.currentUser
        });

        elements.formTextarea.value = '';

        // Reload
        state.discussions = await fetchDiscussions();
        renderDiscussions();
        renderSections();
        renderNavigation();
        renderStats();
        showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} added`);
    });

    // Poll for notifications every 30 seconds
    setInterval(async () => {
        await renderNotifications();
    }, 30000);

    updateUserAvatar();
}

// Start app
document.addEventListener('DOMContentLoaded', init);
