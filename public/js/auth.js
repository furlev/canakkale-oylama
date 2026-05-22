/* ========================================
   ÇANAKKALE OYLAMA SİSTEMİ - AUTH MODULE
   ======================================== */

const Auth = {
    currentTab: 'voter',

    switchTab(tab) {
        this.currentTab = tab;

        // Update tab buttons
        document.querySelectorAll('.login-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        // Show/hide forms
        const voterForm = document.getElementById('voter-login-form');
        const adminForm = document.getElementById('admin-login-form');

        if (tab === 'voter') {
            voterForm.classList.remove('hidden');
            adminForm.classList.add('hidden');
            setTimeout(() => {
                document.getElementById('voter-token').focus();
            }, 100);
        } else {
            voterForm.classList.add('hidden');
            adminForm.classList.remove('hidden');
            setTimeout(() => {
                document.getElementById('admin-username').focus();
            }, 100);
        }
    },

    async loginVoter(event) {
        event.preventDefault();

        const tokenInput = document.getElementById('voter-token');
        const btn = document.getElementById('voter-login-btn');
        const token = tokenInput.value.trim();

        if (!token) {
            App.showToast('Lütfen oylama tokeninizi girin', 'warning');
            tokenInput.focus();
            tokenInput.parentElement.classList.add('animate-shake');
            setTimeout(() => tokenInput.parentElement.classList.remove('animate-shake'), 500);
            return;
        }

        App.setButtonLoading(btn, true);

        try {
            const data = await API.loginVoter(token);
            API.setToken(data.token);
            
            // Set user from login response
            App.currentUser = {
                type: 'voter',
                id: data.id,
                first_name: data.firstName,
                last_name: data.lastName,
                role: data.role || 'Seçmen',
                profile_image: data.profileImage || ''
            };
            localStorage.setItem('user_data', JSON.stringify(App.currentUser));
            
            App.showToast('Giriş başarılı! Hoş geldiniz.', 'success');
            tokenInput.value = '';
            App.onLoginSuccess();
        } catch (error) {
            tokenInput.parentElement.classList.add('animate-shake');
            setTimeout(() => tokenInput.parentElement.classList.remove('animate-shake'), 500);
        } finally {
            App.setButtonLoading(btn, false);
        }
    },

    async loginAdmin(event) {
        event.preventDefault();

        const usernameInput = document.getElementById('admin-username');
        const passwordInput = document.getElementById('admin-password');
        const btn = document.getElementById('admin-login-btn');

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username) {
            App.showToast('Lütfen kullanıcı adınızı girin', 'warning');
            usernameInput.focus();
            return;
        }

        if (!password) {
            App.showToast('Lütfen şifrenizi girin', 'warning');
            passwordInput.focus();
            return;
        }

        App.setButtonLoading(btn, true);

        try {
            const data = await API.loginAdmin(username, password);
            API.setToken(data.token);
            
            App.currentUser = {
                type: 'admin',
                role: 'admin',
                id: data.id,
                username: data.username
            };
            localStorage.setItem('user_data', JSON.stringify(App.currentUser));
            
            App.showToast('Yönetici girişi başarılı!', 'success');
            usernameInput.value = '';
            passwordInput.value = '';
            App.onLoginSuccess();
        } catch (error) {
            usernameInput.parentElement.classList.add('animate-shake');
            setTimeout(() => usernameInput.parentElement.classList.remove('animate-shake'), 500);
        } finally {
            App.setButtonLoading(btn, false);
        }
    },

    togglePassword() {
        const input = document.getElementById('admin-password');
        const toggle = input.parentElement.querySelector('.password-toggle');
        
        if (input.type === 'password') {
            input.type = 'text';
            toggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        } else {
            input.type = 'password';
            toggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        }
    }
};
