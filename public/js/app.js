/* ========================================
   ÇANAKKALE OYLAMA SİSTEMİ - APP CORE
   ======================================== */

const App = {
    currentUser: null,
    currentScreen: null,
    previousScreen: null,
    isTransitioning: false,

    async init() {
        this.generateParticles();
        
        // Try auto-login
        const token = localStorage.getItem('auth_token');
        if (token) {
            API.setToken(token);
            try {
                const data = await API.getMe();
                // Backend /me returns {type, ...fields}
                if (data.type === 'admin') {
                    this.currentUser = { type: 'admin', role: 'admin', id: data.id, username: data.username };
                } else {
                    this.currentUser = {
                        type: 'voter',
                        id: data.id,
                        first_name: data.firstName || data.first_name,
                        last_name: data.lastName || data.last_name,
                        role: data.role || 'Seçmen',
                        profile_image: data.profileImage || data.profile_image || ''
                    };
                }
                this.onLoginSuccess();
            } catch (e) {
                API.clearToken();
                this.hideLoading();
                this.showScreen('login-screen');
            }
        } else {
            this.hideLoading();
            this.showScreen('login-screen');
        }

        // Hash routing
        window.addEventListener('hashchange', () => this.handleRoute());
        
        // Handle resize for particles
        window.addEventListener('resize', () => this.handleResize());

        // Load site logo
        this.loadSiteLogo();
    },

    async loadSiteLogo() {
        try {
            const data = await API.getLogo();
            const logoEl = document.getElementById('header-logo');
            const fallbackEl = document.getElementById('brand-icon-fallback');
            if (data && data.logo) {
                logoEl.src = data.logo;
                logoEl.classList.remove('hidden');
                if (fallbackEl) fallbackEl.style.display = 'none';
            }
        } catch (e) {}
    },

    hideLoading() {
        const loader = document.getElementById('loading-screen');
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.classList.remove('active');
                loader.style.display = 'none';
            }, 500);
        }
    },

    onLoginSuccess() {
        this.hideLoading();
        this.updateHeader();
        this.isTransitioning = false;
        
        if (this.isAdmin()) {
            this.navigate('#admin');
        } else {
            this.navigate('#voter');
        }
        // Always trigger route handling (hash may already be set on refresh)
        this.handleRoute();
    },

    isAdmin() {
        return this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.type === 'admin');
    },

    updateHeader() {
        const header = document.getElementById('app-header');
        const nameEl = document.getElementById('header-user-name');
        const roleEl = document.getElementById('header-user-role');
        const avatarEl = document.getElementById('header-avatar');

        header.classList.remove('hidden');
        
        if (this.currentUser) {
            const name = this.currentUser.first_name 
                ? `${this.currentUser.first_name} ${this.currentUser.last_name || ''}`.trim()
                : this.currentUser.username || 'Kullanıcı';
            nameEl.textContent = name;
            roleEl.textContent = this.isAdmin() ? 'Yönetici' : (this.currentUser.role || 'Seçmen');
            
            // Show profile photo in header
            if (avatarEl) {
                if (this.currentUser.profile_image) {
                    avatarEl.innerHTML = `<img src="${this.currentUser.profile_image}" alt="${this.escapeHtml(name)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);">`;
                } else {
                    avatarEl.innerHTML = `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--gradient-start),var(--gradient-end));display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:600;border:2px solid var(--accent);">${this.generateAvatar(name)}</div>`;
                }
                avatarEl.style.display = 'flex';
            }
        }
    },

    handleRoute() {
        const hash = window.location.hash || '#login';
        const parts = hash.split('/');
        const route = parts[0];
        const param = parts[1];

        switch (route) {
            case '#login':
                this.showScreen('login-screen');
                break;
            case '#voter':
                if (!this.currentUser) { this.navigate('#login'); return; }
                this.showScreen('voter-dashboard');
                if (typeof Voting !== 'undefined') Voting.loadDashboard();
                break;
            case '#voting':
                if (!this.currentUser) { this.navigate('#login'); return; }
                this.showScreen('voting-screen');
                if (param && typeof Voting !== 'undefined') Voting.loadElection(param);
                break;
            case '#results':
                if (!this.currentUser) { this.navigate('#login'); return; }
                this.showScreen('results-screen');
                if (param && typeof Results !== 'undefined') Results.loadResults(param);
                break;
            case '#admin':
                if (!this.currentUser || !this.isAdmin()) { this.navigate('#login'); return; }
                this.showScreen('admin-dashboard');
                if (typeof Admin !== 'undefined') {
                    const tab = parts[1] || 'overview';
                    Admin.switchTab(tab);
                }
                break;
            default:
                this.navigate('#login');
        }
    },

    navigate(hash) {
        if (window.location.hash === hash) {
            // Hash didn't change, manually trigger route
            this.handleRoute();
        } else {
            window.location.hash = hash;
        }
    },

    navigateBack() {
        if (this.currentUser) {
            if (this.isAdmin()) {
                this.navigate('#admin');
            } else {
                this.navigate('#voter');
            }
        } else {
            this.navigate('#login');
        }
    },

    showScreen(screenId) {
        if (this.isTransitioning && this.currentScreen === screenId) return;

        const screens = document.querySelectorAll('.screen');
        const target = document.getElementById(screenId);
        if (!target) return;

        // Hide header on login screen
        const header = document.getElementById('app-header');
        if (screenId === 'login-screen' || screenId === 'loading-screen') {
            header.classList.add('hidden');
        } else if (this.currentUser) {
            header.classList.remove('hidden');
        }

        this.isTransitioning = true;
        const prevScreen = this.currentScreen ? document.getElementById(this.currentScreen) : null;

        // Immediately remove active from all other screens
        screens.forEach(s => {
            if (s.id !== screenId && s.id !== 'loading-screen') {
                s.classList.remove('active', 'page-leave', 'page-enter');
            }
        });

        target.classList.add('active', 'page-enter');
        setTimeout(() => {
            target.classList.remove('page-enter');
            this.isTransitioning = false;
        }, 400);

        this.previousScreen = this.currentScreen;
        this.currentScreen = screenId;

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    logout() {
        API.clearToken();
        this.currentUser = null;
        this.currentScreen = null;
        
        // Reset all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('app-header').classList.add('hidden');
        
        this.navigate('#login');
        this.showToast('Başarıyla çıkış yapıldı', 'success');
    },

    // ===== TOAST SYSTEM =====
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.classList.add('removing'); setTimeout(() => this.parentElement.remove(), 300);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;

        container.appendChild(toast);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('removing');
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    },

    // ===== MODAL SYSTEM =====
    showModal(title, bodyHTML) {
        const overlay = document.getElementById('modal-overlay');
        const titleEl = document.getElementById('modal-title');
        const bodyEl = document.getElementById('modal-body');

        titleEl.textContent = title;
        bodyEl.innerHTML = bodyHTML;
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    hideModal(event) {
        if (event && event.target !== event.currentTarget) return;
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    },

    // ===== CONFIRM DIALOG =====
    showConfirm(title, message, onConfirm, icon = '⚠️') {
        const overlay = document.getElementById('confirm-overlay');
        document.getElementById('confirm-icon').textContent = icon;
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        
        const btn = document.getElementById('confirm-action-btn');
        btn.onclick = () => {
            this.hideConfirm();
            onConfirm();
        };

        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    hideConfirm() {
        const overlay = document.getElementById('confirm-overlay');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    },

    // ===== PARTICLES =====
    generateParticles() {
        const container = document.getElementById('particles');
        if (!container) return;

        const count = Math.min(30, Math.floor(window.innerWidth / 60));
        container.innerHTML = '';

        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            const size = Math.random() * 6 + 2;
            const x = Math.random() * 100;
            const duration = Math.random() * 20 + 15;
            const delay = Math.random() * 15;

            particle.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                left: ${x}%;
                bottom: -10px;
                animation-duration: ${duration}s;
                animation-delay: ${delay}s;
                opacity: ${Math.random() * 0.4 + 0.1};
            `;

            container.appendChild(particle);
        }
    },

    handleResize() {
        // Debounce
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => {
            this.generateParticles();
        }, 300);
    },

    // ===== HELPERS =====
    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    generateAvatar(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    },

    getStatusBadge(status) {
        const badges = {
            'draft': '<span class="badge badge-draft">Taslak</span>',
            'active': '<span class="badge badge-active">Aktif</span>',
            'completed': '<span class="badge badge-completed">Tamamlandı</span>'
        };
        return badges[status] || badges['draft'];
    },

    animateCountUp(element, target, duration = 1000) {
        const start = 0;
        const startTime = performance.now();
        const isPercentage = typeof target === 'string' && target.includes('%');
        const numTarget = parseFloat(target);

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (numTarget - start) * eased);
            
            element.textContent = isPercentage ? `${current}%` : current;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };

        requestAnimationFrame(update);
    },

    setButtonLoading(btn, loading) {
        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    copyToClipboard(text, btnElement) {
        navigator.clipboard.writeText(text).then(() => {
            if (btnElement) {
                btnElement.classList.add('copied');
                const originalHTML = btnElement.innerHTML;
                btnElement.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                setTimeout(() => {
                    btnElement.classList.remove('copied');
                    btnElement.innerHTML = originalHTML;
                }, 2000);
            }
            this.showToast('Panoya kopyalandı', 'success');
        }).catch(() => {
            this.showToast('Kopyalama başarısız', 'error');
        });
    }
};
