/* ========================================
   ÇANAKKALE OYLAMA SİSTEMİ - ADMIN MODULE
   ======================================== */

const Admin = {
    elections: [],
    voters: [],
    currentTab: 'overview',

    // ===== TAB MANAGEMENT =====
    switchTab(tab) {
        this.currentTab = tab;

        // Update tab buttons
        document.querySelectorAll('.admin-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });

        // Show/hide tab content
        document.querySelectorAll('.admin-tab-content').forEach(c => {
            c.classList.remove('active');
        });
        const content = document.getElementById(`tab-${tab}`);
        if (content) {
            content.classList.add('active');
        }

        // Load data for the tab
        switch (tab) {
            case 'overview': this.loadOverview(); break;
            case 'elections': this.loadElections(); break;
            case 'voters': this.loadVoters(); break;
            case 'results': this.loadResultsTab(); break;
            case 'settings': this.loadSettings(); break;
        }
    },

    // ===== OVERVIEW =====
    async loadOverview() {
        try {
            const electionsData = await API.getElections();
            this.elections = Array.isArray(electionsData) ? electionsData : [];

            const votersData = await API.getVoters();
            this.voters = Array.isArray(votersData) ? votersData : [];

            const totalElections = this.elections.length;
            const activeElections = this.elections.filter(e => e.status === 'active').length;
            const totalVoters = this.voters.length;

            // Animate stats
            const statEls = {
                'stat-total-elections': totalElections,
                'stat-active-elections': activeElections,
                'stat-total-voters': totalVoters,
            };

            Object.entries(statEls).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) App.animateCountUp(el, value, 800);
            });

            // Calculate participation for active elections
            let participationText = '0%';
            const activeElection = this.elections.find(e => e.status === 'active');
            if (activeElection) {
                try {
                    const stats = await API.getStats(activeElection.id);
                    participationText = `${Math.round(stats.participationRate || 0)}%`;
                } catch (e) {
                    participationText = '-';
                }
            }
            const partEl = document.getElementById('stat-participation');
            if (partEl) {
                if (participationText.includes('%')) {
                    App.animateCountUp(partEl, participationText, 800);
                } else {
                    partEl.textContent = participationText;
                }
            }

            // Overview elections list
            this.renderOverviewElections();
        } catch (error) {
            console.error('Overview load error:', error);
        }
    },

    renderOverviewElections() {
        const list = document.getElementById('overview-elections-list');
        if (!list) return;

        if (this.elections.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>Henüz seçim oluşturulmadı</h3></div>';
            return;
        }

        list.innerHTML = this.elections.slice(0, 5).map((e, i) => `
            <div class="overview-election-item glass-card animate-slideUp stagger-${i + 1}">
                <div class="overview-election-info">
                    <div class="overview-election-title">${App.escapeHtml(e.title)}</div>
                    <div class="overview-election-desc">${App.escapeHtml(e.description || 'Açıklama yok')}</div>
                </div>
                ${App.getStatusBadge(e.status)}
            </div>
        `).join('');
    },

    // ===== ELECTIONS MANAGEMENT =====
    async loadElections() {
        const list = document.getElementById('elections-list');
        list.innerHTML = '<div class="skeleton skeleton-card" style="height:120px;margin-bottom:16px"></div>'.repeat(3);

        try {
            const data = await API.getElections();
            this.elections = Array.isArray(data) ? data : [];
            this.renderElections();
        } catch (error) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><h3>Seçimler yüklenemedi</h3></div>';
        }
    },

    renderElections() {
        const list = document.getElementById('elections-list');

        if (this.elections.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>Henüz seçim oluşturulmadı</h3><p>Yeni bir seçim oluşturmak için yukarıdaki butonu kullanın.</p></div>';
            return;
        }

        list.innerHTML = this.elections.map((e, i) => `
            <div class="election-admin-card glass-card animate-slideUp stagger-${Math.min(i + 1, 10)}" id="election-card-${e.id}">
                <div class="election-admin-info">
                    <div class="election-admin-title">
                        ${App.escapeHtml(e.title)}
                        ${App.getStatusBadge(e.status)}
                    </div>
                    <div class="election-admin-desc">${App.escapeHtml(e.description || 'Açıklama yok')}</div>
                    <div class="election-admin-meta">
                        <span>Maks. Oy: ${e.max_votes || 1}</span>
                        <span>Oluşturulma: ${App.formatDate(e.created_at)}</span>
                    </div>
                </div>
                <div class="election-admin-actions">
                    ${e.status === 'draft' ? `
                        <button class="btn btn-success btn-sm" onclick="Admin.startElection(${e.id})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            Başlat
                        </button>
                    ` : ''}
                    ${e.status === 'active' ? `
                        <button class="btn btn-secondary btn-sm" onclick="Admin.completeElection(${e.id})" style="border-color: var(--accent); color: var(--accent);">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            Tamamla
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="Admin.showEditElectionModal(${e.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Düzenle
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="Admin.showManageCandidates(${e.id})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                        Adaylar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="Admin.deleteElection(${e.id}, '${App.escapeHtml(e.title)}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Sil
                    </button>
                </div>
            </div>
        `).join('');
    },

    showCreateElectionModal() {
        App.showModal('Yeni Seçim Oluştur', `
            <form id="create-election-form" onsubmit="Admin.createElection(event)">
                <div class="form-group">
                    <input type="text" id="election-title" class="form-input" placeholder=" " required>
                    <label class="form-label" for="election-title">Seçim Başlığı</label>
                </div>
                <div class="form-group">
                    <textarea id="election-description" class="form-input form-textarea" placeholder=" " rows="3"></textarea>
                    <label class="form-label" for="election-description">Açıklama</label>
                </div>
                <div class="form-group">
                    <input type="number" id="election-max-votes" class="form-input" placeholder=" " min="1" value="1" required>
                    <label class="form-label" for="election-max-votes">Maksimum Oy Sayısı</label>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="App.hideModal()">İptal</button>
                    <button type="submit" class="btn btn-primary">Oluştur</button>
                </div>
            </form>
        `);
    },

    async createElection(event) {
        event.preventDefault();
        const title = document.getElementById('election-title').value.trim();
        const description = document.getElementById('election-description').value.trim();
        const maxVotes = parseInt(document.getElementById('election-max-votes').value) || 1;

        if (!title) {
            App.showToast('Lütfen seçim başlığını girin', 'warning');
            return;
        }

        try {
            await API.createElection({ title, description, max_votes: maxVotes });
            App.hideModal();
            App.showToast('Seçim başarıyla oluşturuldu', 'success');
            this.loadElections();
        } catch (error) {
            // Error handled by API
        }
    },

    showEditElectionModal(electionId) {
        const election = this.elections.find(e => e.id === electionId);
        if (!election) return;

        App.showModal('Seçimi Düzenle', `
            <form onsubmit="Admin.updateElection(event, ${electionId})">
                <div class="form-group">
                    <input type="text" id="edit-election-title" class="form-input" placeholder=" " value="${App.escapeHtml(election.title)}" required>
                    <label class="form-label" for="edit-election-title">Seçim Başlığı</label>
                </div>
                <div class="form-group">
                    <textarea id="edit-election-description" class="form-input form-textarea" placeholder=" " rows="3">${App.escapeHtml(election.description || '')}</textarea>
                    <label class="form-label" for="edit-election-description">Açıklama</label>
                </div>
                <div class="form-group">
                    <input type="number" id="edit-election-max-votes" class="form-input" placeholder=" " min="1" value="${election.max_votes || 1}" required>
                    <label class="form-label" for="edit-election-max-votes">Maksimum Oy Sayısı</label>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="App.hideModal()">İptal</button>
                    <button type="submit" class="btn btn-primary">Güncelle</button>
                </div>
            </form>
        `);
    },

    async updateElection(event, electionId) {
        event.preventDefault();
        const title = document.getElementById('edit-election-title').value.trim();
        const description = document.getElementById('edit-election-description').value.trim();
        const maxVotes = parseInt(document.getElementById('edit-election-max-votes').value) || 1;

        try {
            await API.updateElection(electionId, { title, description, max_votes: maxVotes });
            App.hideModal();
            App.showToast('Seçim güncellendi', 'success');
            this.loadElections();
        } catch (error) {}
    },

    startElection(electionId) {
        App.showConfirm(
            'Seçimi Başlat',
            'Bu seçimi başlatmak istediğinize emin misiniz? Seçmenler oy kullanabilecektir.',
            async () => {
                try {
                    await API.updateElectionStatus(electionId, 'active');
                    App.showToast('Seçim başlatıldı! 🗳️', 'success');
                    this.loadElections();
                } catch (error) {}
            },
            '▶️'
        );
    },

    completeElection(electionId) {
        App.showConfirm(
            'Seçimi Tamamla',
            'Bu seçimi tamamlamak istediğinize emin misiniz? Bu işlem geri alınamaz ve sonuçlar açıklanır.',
            async () => {
                try {
                    await API.updateElectionStatus(electionId, 'completed');
                    App.showToast('Seçim tamamlandı! Sonuçlar açıklandı.', 'success');
                    this.loadElections();
                } catch (error) {}
            },
            '🏁'
        );
    },

    deleteElection(electionId, title) {
        App.showConfirm(
            'Seçimi Sil',
            `"${title}" seçimini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
            async () => {
                try {
                    await API.deleteElection(electionId);
                    App.showToast('Seçim silindi', 'success');
                    this.loadElections();
                } catch (error) {}
            },
            '🗑️'
        );
    },

    // ===== CANDIDATES MANAGEMENT =====
    async showManageCandidates(electionId) {
        const election = this.elections.find(e => e.id === electionId);
        if (!election) return;

        try {
            const candidates = await API.getCandidates(electionId);
            const candidateList = Array.isArray(candidates) ? candidates : [];

            let candidatesHTML = candidateList.map(c => `
                <div class="candidate-admin-item" id="candidate-item-${c.id}">
                    <div class="candidate-admin-info">
                        <div class="candidate-admin-avatar">${App.generateAvatar(c.name)}</div>
                        <div>
                            <div class="candidate-admin-name">${App.escapeHtml(c.name)}</div>
                            <div class="candidate-admin-desc">${App.escapeHtml(c.description || '')}</div>
                        </div>
                    </div>
                    <div class="table-actions">
                        <button class="btn btn-secondary btn-sm" onclick="Admin.editCandidateInline(${c.id}, '${App.escapeHtml(c.name)}', '${App.escapeHtml(c.description || '')}', ${electionId})">Düzenle</button>
                        <button class="btn btn-danger btn-sm" onclick="Admin.deleteCandidate(${c.id}, ${electionId})">Sil</button>
                    </div>
                </div>
            `).join('');

            if (candidateList.length === 0) {
                candidatesHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">Henüz aday eklenmedi</p>';
            }

            App.showModal(`${election.title} - Adaylar`, `
                <div class="candidates-admin-list" style="border-top:none; padding-top:0;" id="candidates-admin-list">
                    ${candidatesHTML}
                </div>
                <hr style="border-color: var(--glass-border); margin: 1.5rem 0;">
                <h4 style="margin-bottom: 1rem; font-size: 0.95rem;">Yeni Aday Ekle</h4>
                <form onsubmit="Admin.addCandidate(event, ${electionId})">
                    <div class="form-group">
                        <input type="text" id="candidate-name" class="form-input" placeholder=" " required>
                        <label class="form-label" for="candidate-name">Aday Adı</label>
                    </div>
                    <div class="form-group">
                        <input type="text" id="candidate-description" class="form-input" placeholder=" ">
                        <label class="form-label" for="candidate-description">Açıklama</label>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        Aday Ekle
                    </button>
                </form>
            `);
        } catch (error) {
            App.showToast('Adaylar yüklenemedi', 'error');
        }
    },

    async addCandidate(event, electionId) {
        event.preventDefault();
        const name = document.getElementById('candidate-name').value.trim();
        const description = document.getElementById('candidate-description').value.trim();

        if (!name) {
            App.showToast('Lütfen aday adını girin', 'warning');
            return;
        }

        try {
            await API.createCandidate({
                election_id: electionId,
                name,
                description
            });
            App.showToast('Aday eklendi', 'success');
            App.hideModal();
            this.showManageCandidates(electionId);
        } catch (error) {}
    },

    editCandidateInline(candidateId, currentName, currentDesc, electionId) {
        App.hideModal();
        setTimeout(() => {
            App.showModal('Adayı Düzenle', `
                <form onsubmit="Admin.updateCandidate(event, ${candidateId}, ${electionId})">
                    <div class="form-group">
                        <input type="text" id="edit-candidate-name" class="form-input" placeholder=" " value="${currentName}" required>
                        <label class="form-label" for="edit-candidate-name">Aday Adı</label>
                    </div>
                    <div class="form-group">
                        <input type="text" id="edit-candidate-description" class="form-input" placeholder=" " value="${currentDesc}">
                        <label class="form-label" for="edit-candidate-description">Açıklama</label>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="App.hideModal(); setTimeout(() => Admin.showManageCandidates(${electionId}), 200);">İptal</button>
                        <button type="submit" class="btn btn-primary">Güncelle</button>
                    </div>
                </form>
            `);
        }, 250);
    },

    async updateCandidate(event, candidateId, electionId) {
        event.preventDefault();
        const name = document.getElementById('edit-candidate-name').value.trim();
        const description = document.getElementById('edit-candidate-description').value.trim();

        try {
            await API.updateCandidate(candidateId, { name, description });
            App.showToast('Aday güncellendi', 'success');
            App.hideModal();
            setTimeout(() => this.showManageCandidates(electionId), 200);
        } catch (error) {}
    },

    deleteCandidate(candidateId, electionId) {
        App.showConfirm(
            'Adayı Sil',
            'Bu adayı silmek istediğinize emin misiniz?',
            async () => {
                try {
                    await API.deleteCandidate(candidateId);
                    App.showToast('Aday silindi', 'success');
                    // Refresh modal
                    App.hideModal();
                    setTimeout(() => this.showManageCandidates(electionId), 200);
                } catch (error) {}
            },
            '🗑️'
        );
    },

    // ===== VOTERS MANAGEMENT =====
    async loadVoters() {
        const tbody = document.getElementById('voters-tbody');
        const noVoters = document.getElementById('no-voters');
        const table = document.querySelector('.table-wrapper');

        tbody.innerHTML = '<tr><td colspan="6"><div class="skeleton skeleton-text" style="margin:1rem auto"></div></td></tr>'.repeat(3);

        try {
            const data = await API.getVoters();
            this.voters = Array.isArray(data) ? data : [];

            if (this.voters.length === 0) {
                table.classList.add('hidden');
                noVoters.classList.remove('hidden');
                return;
            }

            table.classList.remove('hidden');
            noVoters.classList.add('hidden');
            this.renderVoters();
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">Seçmenler yüklenemedi</td></tr>';
        }
    },

    renderVoters() {
        const tbody = document.getElementById('voters-tbody');
        
        tbody.innerHTML = this.voters.map((v, i) => {
            const fullName = `${v.first_name || ''} ${v.last_name || ''}`.trim() || '-';
            const initials = App.generateAvatar(fullName);
            const avatarContent = v.profile_image 
                ? `<img src="${v.profile_image}" alt="${App.escapeHtml(fullName)}">` 
                : initials;
            const isActive = v.is_active !== false;

            return `
                <tr class="animate-fadeIn" style="animation-delay: ${i * 0.05}s">
                    <td>
                        <div class="table-avatar">${avatarContent}</div>
                    </td>
                    <td><strong>${App.escapeHtml(fullName)}</strong></td>
                    <td style="color: var(--text-secondary)">${App.escapeHtml(v.role || '-')}</td>
                    <td>
                        <div class="token-display">
                            <span class="token-text" title="${App.escapeHtml(v.token || '')}">${App.escapeHtml(v.token || '-')}</span>
                            ${v.token ? `<button class="btn-copy" onclick="App.copyToClipboard('${App.escapeHtml(v.token)}', this)" title="Kopyala">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>` : ''}
                        </div>
                    </td>
                    <td>
                        ${isActive 
                            ? '<span class="badge badge-active">Aktif</span>' 
                            : '<span class="badge badge-inactive">Pasif</span>'}
                    </td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-secondary btn-sm" onclick="Admin.showEditVoterModal(${v.id})">Düzenle</button>
                            <button class="btn btn-danger btn-sm" onclick="Admin.deleteVoter(${v.id}, '${App.escapeHtml(fullName)}')">Sil</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    showCreateVoterModal() {
        App.showModal('Yeni Seçmen Ekle', `
            <form id="create-voter-form" onsubmit="Admin.createVoter(event)">
                <div class="form-group">
                    <input type="text" id="voter-first-name" class="form-input" placeholder=" " required>
                    <label class="form-label" for="voter-first-name">Ad</label>
                </div>
                <div class="form-group">
                    <input type="text" id="voter-last-name" class="form-input" placeholder=" " required>
                    <label class="form-label" for="voter-last-name">Soyad</label>
                </div>
                <div class="form-group">
                    <input type="text" id="voter-role-input" class="form-input" placeholder=" ">
                    <label class="form-label" for="voter-role-input">Görev / Pozisyon</label>
                </div>
                <div class="form-group">
                    <div class="file-upload" id="voter-image-upload">
                        <input type="file" id="voter-image" accept="image/*" onchange="Admin.previewImage(event)">
                        <div class="file-upload-icon">📷</div>
                        <div class="file-upload-text">Profil fotoğrafı yüklemek için tıklayın</div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="App.hideModal()">İptal</button>
                    <button type="submit" class="btn btn-primary">Seçmen Ekle</button>
                </div>
            </form>
        `);
    },

    previewImage(event) {
        const file = event.target.files[0];
        if (!file) return;

        const upload = document.getElementById('voter-image-upload');
        const reader = new FileReader();
        reader.onload = (e) => {
            upload.innerHTML = `
                <input type="file" id="voter-image" accept="image/*" onchange="Admin.previewImage(event)">
                <div class="file-upload-preview">
                    <img src="${e.target.result}" alt="Preview">
                </div>
                <div class="file-upload-text">${file.name}</div>
            `;
        };
        reader.readAsDataURL(file);
    },

    async createVoter(event) {
        event.preventDefault();

        const firstName = document.getElementById('voter-first-name').value.trim();
        const lastName = document.getElementById('voter-last-name').value.trim();
        const role = document.getElementById('voter-role-input').value.trim();
        const imageInput = document.getElementById('voter-image');

        if (!firstName || !lastName) {
            App.showToast('Lütfen ad ve soyadı girin', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('first_name', firstName);
        formData.append('last_name', lastName);
        if (role) formData.append('role', role);
        if (imageInput && imageInput.files[0]) {
            formData.append('profile_image', imageInput.files[0]);
        }

        try {
            const data = await API.createVoter(formData);
            App.hideModal();

            // Show token prominently
            const voter = data;
            if (voter && voter.token) {
                setTimeout(() => {
                    App.showModal('Seçmen Oluşturuldu ✅', `
                        <div style="text-align: center;">
                            <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                                <strong>${App.escapeHtml(firstName)} ${App.escapeHtml(lastName)}</strong> başarıyla eklendi.
                            </p>
                            <div class="token-highlight">
                                <div class="token-highlight-label">Oylama Tokeni</div>
                                <div class="token-highlight-value">${App.escapeHtml(voter.token)}</div>
                                <button class="btn btn-primary btn-sm" onclick="App.copyToClipboard('${App.escapeHtml(voter.token)}', this)">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                    Kopyala
                                </button>
                            </div>
                            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 1rem;">
                                ⚠️ Bu tokeni güvenli bir şekilde seçmenle paylaşın. Token bir kez gösterilir.
                            </p>
                        </div>
                        <div class="modal-actions" style="justify-content: center;">
                            <button class="btn btn-secondary" onclick="App.hideModal()">Tamam</button>
                        </div>
                    `);
                }, 250);
            } else {
                App.showToast('Seçmen eklendi', 'success');
            }

            this.loadVoters();
        } catch (error) {}
    },

    showEditVoterModal(voterId) {
        const voter = this.voters.find(v => v.id === voterId);
        if (!voter) return;

        const isActive = voter.is_active !== false;

        App.showModal('Seçmeni Düzenle', `
            <form onsubmit="Admin.updateVoter(event, ${voterId})">
                <div class="form-group">
                    <input type="text" id="edit-voter-first-name" class="form-input" placeholder=" " value="${App.escapeHtml(voter.first_name || '')}" required>
                    <label class="form-label" for="edit-voter-first-name">Ad</label>
                </div>
                <div class="form-group">
                    <input type="text" id="edit-voter-last-name" class="form-input" placeholder=" " value="${App.escapeHtml(voter.last_name || '')}" required>
                    <label class="form-label" for="edit-voter-last-name">Soyad</label>
                </div>
                <div class="form-group">
                    <input type="text" id="edit-voter-role" class="form-input" placeholder=" " value="${App.escapeHtml(voter.role || '')}">
                    <label class="form-label" for="edit-voter-role">Görev / Pozisyon</label>
                </div>
                <div class="form-group" style="display:flex; align-items:center; gap:1rem;">
                    <label style="color: var(--text-secondary); font-size: 0.9rem;">Durum:</label>
                    <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                        <input type="checkbox" id="edit-voter-active" ${isActive ? 'checked' : ''} style="width:18px; height:18px; accent-color: var(--accent);">
                        <span style="color: var(--text-secondary); font-size:0.9rem;">Aktif</span>
                    </label>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="App.hideModal()">İptal</button>
                    <button type="submit" class="btn btn-primary">Güncelle</button>
                </div>
            </form>
        `);
    },

    async updateVoter(event, voterId) {
        event.preventDefault();
        const firstName = document.getElementById('edit-voter-first-name').value.trim();
        const lastName = document.getElementById('edit-voter-last-name').value.trim();
        const role = document.getElementById('edit-voter-role').value.trim();
        const isActive = document.getElementById('edit-voter-active').checked;

        try {
            await API.updateVoter(voterId, {
                first_name: firstName,
                last_name: lastName,
                role: role,
                is_active: isActive
            });
            App.hideModal();
            App.showToast('Seçmen güncellendi', 'success');
            this.loadVoters();
        } catch (error) {}
    },

    deleteVoter(voterId, name) {
        App.showConfirm(
            'Seçmeni Sil',
            `"${name}" seçmenini silmek istediğinize emin misiniz?`,
            async () => {
                try {
                    await API.deleteVoter(voterId);
                    App.showToast('Seçmen silindi', 'success');
                    this.loadVoters();
                } catch (error) {}
            },
            '🗑️'
        );
    },

    // ===== RESULTS TAB =====
    async loadResultsTab() {
        const select = document.getElementById('results-election-select');
        
        try {
            const data = await API.getElections();
            this.elections = Array.isArray(data) ? data : [];

            select.innerHTML = '<option value="">Seçim seçin...</option>';
            this.elections.forEach(e => {
                select.innerHTML += `<option value="${e.id}">${App.escapeHtml(e.title)} (${e.status === 'completed' ? 'Tamamlandı' : e.status === 'active' ? 'Aktif' : 'Taslak'})</option>`;
            });
        } catch (error) {
            App.showToast('Seçimler yüklenemedi', 'error');
        }
    },

    async loadDetailedResults() {
        const select = document.getElementById('results-election-select');
        const electionId = select.value;
        const emptyEl = document.getElementById('admin-results-empty');
        const statsEl = document.getElementById('admin-results-stats');
        const statsGrid = document.getElementById('admin-stats-grid');
        const chartEl = document.getElementById('admin-results-chart');
        const tbody = document.getElementById('detailed-votes-tbody');

        if (!electionId) {
            emptyEl.classList.remove('hidden');
            statsEl.classList.add('hidden');
            return;
        }

        emptyEl.classList.add('hidden');
        statsEl.classList.remove('hidden');

        try {
            // Load stats
            const stats = await API.getStats(electionId);
            statsGrid.innerHTML = `
                <div class="stat-card glass-card animate-slideUp stagger-1">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #d4a843, #e8c468);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                    </div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.totalVoters || 0}</span>
                        <span class="stat-label">Toplam Seçmen</span>
                    </div>
                </div>
                <div class="stat-card glass-card animate-slideUp stagger-2">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #2ecc71, #27ae60);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div class="stat-info">
                        <span class="stat-value">${stats.votedCount || 0}</span>
                        <span class="stat-label">Oy Kullanan</span>
                    </div>
                </div>
                <div class="stat-card glass-card animate-slideUp stagger-3">
                    <div class="stat-icon" style="background: linear-gradient(135deg, #3498db, #2980b9);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 20V10"></path><path d="M18 20V4"></path><path d="M6 20v-4"></path></svg>
                    </div>
                    <div class="stat-info">
                        <span class="stat-value">${Math.round(stats.participationRate || 0)}%</span>
                        <span class="stat-label">Katılım Oranı</span>
                    </div>
                </div>
            `;

            // Load detailed results
            const detailedData = await API.getDetailedResults(electionId);
            const votes = detailedData.votes || [];

            // Render chart
            // Use stats.candidateStats for chart
            const candidateStats = stats.candidateStats || [];
            const totalVotes = stats.totalVotes || 0;
            const sorted = [...candidateStats].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));

            chartEl.innerHTML = '<div class="results-chart">' + sorted.map((r, i) => {
                const voteCount = r.vote_count || r.votes || 0;
                const pct = totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : 0;
                const isWinner = i === 0;
                return `
                    <div class="result-bar-item animate-slideUp stagger-${Math.min(i + 1, 10)}">
                        <div class="result-bar-info">
                            <span class="result-bar-name">${App.escapeHtml(r.candidate_name || r.name || 'Aday')}</span>
                            <div class="result-bar-count">
                                <span class="result-bar-votes">${voteCount}</span>
                                <span class="result-bar-percent">(${pct}%)</span>
                            </div>
                        </div>
                        <div class="result-bar-track">
                            <div class="result-bar-fill ${isWinner ? 'winner' : ''}" style="width:${pct}%"></div>
                        </div>
                    </div>
                `;
            }).join('') + '</div>';

            // Render detailed votes table
            if (votes.length > 0) {
                tbody.innerHTML = votes.map(v => `
                    <tr>
                        <td>${App.escapeHtml(`${v.voter_first_name || ''} ${v.voter_last_name || ''}`.trim() || '-')}</td>
                        <td><span class="badge badge-active">${App.escapeHtml(v.candidate_name || '-')}</span></td>
                        <td style="color: var(--text-muted)">${App.formatDate(v.created_at || v.voted_at)}</td>
                    </tr>
                `).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:2rem;">Henüz oy kullanılmamış</td></tr>';
            }

        } catch (error) {
            statsEl.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><h3>Sonuçlar yüklenemedi</h3></div>';
        }
    },

    // ===== SETTINGS / LOGO =====
    async loadSettings() {
        try {
            const data = await API.getLogo();
            const preview = document.getElementById('current-logo-preview');
            if (data.logo) {
                preview.innerHTML = `
                    <img src="${data.logo}" alt="Site Logosu" style="max-height:80px;max-width:300px;object-fit:contain;margin:0 auto;border-radius:8px;border:1px solid var(--glass-border);padding:8px;background:rgba(255,255,255,0.05);">
                `;
            } else {
                preview.innerHTML = '<p style="color: var(--text-muted);">Logo yüklenmedi</p>';
            }
        } catch (e) {}
    },

    async uploadLogo(input) {
        if (!input.files || !input.files[0]) return;
        const formData = new FormData();
        formData.append('logo', input.files[0]);

        try {
            const data = await API.uploadLogo(formData);
            App.showToast('Logo başarıyla yüklendi! ✅', 'success');
            this.loadSettings();
            this.updateLogoInHeader();
        } catch (error) {
            App.showToast('Logo yüklenemedi', 'error');
        }
        input.value = '';
    },

    async deleteLogo() {
        App.showConfirm(
            'Logoyu Kaldır',
            'Site logosunu kaldırmak istediğinize emin misiniz?',
            async () => {
                try {
                    await API.deleteLogo();
                    App.showToast('Logo kaldırıldı', 'success');
                    this.loadSettings();
                    this.updateLogoInHeader();
                } catch (e) {
                    App.showToast('Logo kaldırılamadı', 'error');
                }
            },
            '🗑️'
        );
    },

    async updateLogoInHeader() {
        try {
            const data = await API.getLogo();
            const logoEl = document.getElementById('header-logo');
            const fallbackEl = document.getElementById('brand-icon-fallback');
            if (data.logo) {
                logoEl.src = data.logo;
                logoEl.classList.remove('hidden');
                if (fallbackEl) fallbackEl.style.display = 'none';
            } else {
                logoEl.classList.add('hidden');
                logoEl.src = '';
                if (fallbackEl) fallbackEl.style.display = '';
            }
        } catch (e) {}
    }
};
