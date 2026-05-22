/* ========================================
   ÇANAKKALE OYLAMA SİSTEMİ - VOTING MODULE
   ======================================== */

const Voting = {
    currentElection: null,
    candidates: [],
    selectedCandidates: new Set(),
    maxVotes: 1,
    hasVoted: false,
    _pollTimer: null,
    _participationTimer: null,

    // ===== POLLING CONTROL =====
    startPolling(electionId) {
        this.stopPolling();
        // Poll every 5 seconds for election status changes
        this._pollTimer = setInterval(() => this.pollElectionStatus(electionId), 5000);
    },

    startParticipationPolling(electionId) {
        this.stopParticipationPolling();
        this.loadParticipation(electionId);
        this._participationTimer = setInterval(() => this.loadParticipation(electionId), 5000);
    },

    stopPolling() {
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    },

    stopParticipationPolling() {
        if (this._participationTimer) { clearInterval(this._participationTimer); this._participationTimer = null; }
    },

    async pollElectionStatus(electionId) {
        try {
            const election = await API.getElection(electionId);
            if (election.status === 'completed') {
                this.stopPolling();
                this.stopParticipationPolling();
                App.showToast('Seçim tamamlandı! Sonuçlar açıklanıyor...', 'info');
                setTimeout(() => App.navigate(`#results/${electionId}`), 1500);
            }
        } catch (e) { /* ignore polling errors */ }
    },

    // ===== VOTER DASHBOARD =====
    async loadDashboard() {
        const container = document.getElementById('voter-elections');
        const noElections = document.getElementById('no-elections');
        const avatarEl = document.getElementById('voter-avatar');
        const nameEl = document.getElementById('voter-name');
        const roleEl = document.getElementById('voter-role');

        // Set profile info
        const user = App.currentUser;
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Seçmen';
        nameEl.textContent = fullName;
        roleEl.textContent = user.role || 'Seçmen';

        if (user.profile_image) {
            avatarEl.innerHTML = `<img src="${user.profile_image}" alt="${App.escapeHtml(fullName)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        } else {
            avatarEl.textContent = App.generateAvatar(fullName);
        }

        // Load elections
        container.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';

        try {
            const elections = await API.getElections();
            const electionList = Array.isArray(elections) ? elections : [];
            const visibleElections = electionList.filter(e => e.status === 'active' || e.status === 'completed');

            if (visibleElections.length === 0) {
                container.innerHTML = '';
                noElections.classList.remove('hidden');
                // Start polling for new elections
                this.stopPolling();
                this._pollTimer = setInterval(async () => {
                    try {
                        const el = await API.getElections();
                        const list = Array.isArray(el) ? el : [];
                        const active = list.find(e => e.status === 'active');
                        if (active) {
                            this.stopPolling();
                            App.showToast('Yeni seçim başladı! 🗳️', 'success');
                            setTimeout(() => App.navigate(`#voting/${active.id}`), 1000);
                        }
                    } catch (e) {}
                }, 5000);
                return;
            }

            // If there's exactly one active election and voter hasn't voted, go directly
            const activeElections = visibleElections.filter(e => e.status === 'active');
            if (activeElections.length === 1) {
                try {
                    const myVotes = await API.getMyVotes(activeElections[0].id);
                    const votes = Array.isArray(myVotes) ? myVotes : [];
                    if (votes.length === 0) {
                        // Auto-redirect to the only active election
                        App.navigate(`#voting/${activeElections[0].id}`);
                        return;
                    }
                } catch (e) {}
            }

            noElections.classList.add('hidden');
            container.innerHTML = '';

            for (let i = 0; i < visibleElections.length; i++) {
                const election = visibleElections[i];
                const card = await this.createElectionCard(election, i);
                container.appendChild(card);
            }
        } catch (error) {
            container.innerHTML = '';
            noElections.classList.remove('hidden');
        }
    },

    async createElectionCard(election, index) {
        const card = document.createElement('div');
        card.className = `election-card glass-card animate-slideUp stagger-${index + 1}`;
        
        let footerAction = '';
        let votedStatus = '';

        if (election.status === 'active') {
            try {
                const myVotes = await API.getMyVotes(election.id);
                const votes = Array.isArray(myVotes) ? myVotes : [];
                if (votes.length > 0) {
                    votedStatus = '<div style="margin-bottom: 12px;"><span class="badge badge-active">✅ Oyunuz kaydedildi</span></div>';
                    footerAction = `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); App.navigate('#results/${election.id}')">Durumu Gör</button>`;
                } else {
                    footerAction = `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); App.navigate('#voting/${election.id}')">Oy Ver</button>`;
                }
            } catch {
                footerAction = `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); App.navigate('#voting/${election.id}')">Oy Ver</button>`;
            }
        } else if (election.status === 'completed') {
            footerAction = `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); App.navigate('#results/${election.id}')">Sonuçları Gör</button>`;
        }

        card.innerHTML = `
            <div class="election-card-header">
                <h3 class="election-card-title">${App.escapeHtml(election.title)}</h3>
                ${App.getStatusBadge(election.status)}
            </div>
            ${votedStatus}
            <p class="election-card-desc">${App.escapeHtml(election.description || '')}</p>
            <div class="election-card-footer">
                <span class="election-card-meta">Maks. ${election.max_votes || 1} oy</span>
                ${footerAction}
            </div>
        `;

        return card;
    },

    // ===== VOTING INTERFACE =====
    async loadElection(electionId) {
        this.selectedCandidates.clear();
        this.hasVoted = false;

        const titleEl = document.getElementById('voting-title');
        const descEl = document.getElementById('voting-description');
        const maxEl = document.getElementById('voting-max');
        const grid = document.getElementById('candidates-grid');
        const actions = document.getElementById('voting-actions');
        const alreadyVoted = document.getElementById('already-voted');
        const maxVotesEl = document.getElementById('max-votes');

        grid.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
        actions.classList.remove('hidden');
        alreadyVoted.classList.add('hidden');

        try {
            const electionData = await API.getElection(electionId);
            this.currentElection = electionData;
            this.candidates = electionData.candidates || [];
            this.maxVotes = electionData.max_votes || 1;

            if (this.candidates.length === 0) {
                const candData = await API.getCandidates(electionId);
                this.candidates = Array.isArray(candData) ? candData : [];
            }

            titleEl.textContent = this.currentElection.title;
            descEl.textContent = this.currentElection.description || '';
            maxEl.textContent = `En fazla ${this.maxVotes} aday seçebilirsiniz`;
            maxVotesEl.textContent = this.maxVotes;

            // Check if already voted
            try {
                const myVotes = await API.getMyVotes(electionId);
                const votes = Array.isArray(myVotes) ? myVotes : [];
                if (votes.length > 0) {
                    this.hasVoted = true;
                    this.showAlreadyVoted(votes);
                    // Start polling for election completion
                    this.startPolling(electionId);
                    this.startParticipationPolling(electionId);
                    return;
                }
            } catch (e) {}

            // Check if election is still active
            if (this.currentElection.status !== 'active') {
                App.navigate(`#results/${electionId}`);
                return;
            }

            this.renderCandidates();
            // Start polling for election status + participation
            this.startPolling(electionId);
            this.startParticipationPolling(electionId);
        } catch (error) {
            grid.innerHTML = '<div class="empty-state"><div class="empty-icon">❌</div><h3>Seçim yüklenemedi</h3></div>';
            actions.classList.add('hidden');
        }
    },

    // ===== PARTICIPANTS PANEL =====
    async loadParticipation(electionId) {
        try {
            const data = await API.getParticipation(electionId);
            const participants = data.participants || [];
            const counter = document.getElementById('participation-counter');
            const list = document.getElementById('participants-list');

            if (counter) counter.textContent = `${data.votedCount}/${data.totalCount}`;

            if (list) {
                list.innerHTML = participants.map(p => {
                    const name = `${p.first_name} ${p.last_name}`.trim();
                    const avatar = p.profile_image
                        ? `<img src="${p.profile_image}" alt="${App.escapeHtml(name)}">`
                        : `<span>${App.generateAvatar(name)}</span>`;
                    return `
                        <div class="participant-item ${p.has_voted ? 'voted' : ''}">
                            <div class="participant-avatar">${avatar}</div>
                            <div class="participant-info">
                                <div class="participant-name">${App.escapeHtml(name)}</div>
                                <div class="participant-role">${App.escapeHtml(p.role || '')}</div>
                            </div>
                            ${p.has_voted ? '<div class="participant-check">✅</div>' : '<div class="participant-waiting">⏳</div>'}
                        </div>
                    `;
                }).join('');
            }
        } catch (e) { /* ignore */ }
    },

    showAlreadyVoted(votes) {
        const grid = document.getElementById('candidates-grid');
        const actions = document.getElementById('voting-actions');
        const alreadyVoted = document.getElementById('already-voted');
        const votesList = document.getElementById('my-votes-list');

        grid.innerHTML = '';
        actions.classList.add('hidden');
        alreadyVoted.classList.remove('hidden');

        const voteTags = votes.map(v => {
            const candidateName = v.candidate_name || v.name || 'Aday';
            return `<span class="my-vote-tag">${App.escapeHtml(candidateName)}</span>`;
        }).join('');

        votesList.innerHTML = voteTags;
    },

    renderCandidates() {
        const grid = document.getElementById('candidates-grid');
        grid.innerHTML = '';

        this.candidates.forEach((candidate, index) => {
            const card = document.createElement('div');
            card.className = `candidate-card glass-card animate-slideUp stagger-${Math.min(index + 1, 10)}`;
            card.dataset.id = candidate.id;

            const initials = App.generateAvatar(candidate.name);
            const avatarContent = candidate.image 
                ? `<img src="${candidate.image}" alt="${App.escapeHtml(candidate.name)}">` 
                : initials;

            card.innerHTML = `
                <div class="candidate-avatar">${avatarContent}</div>
                <h3 class="candidate-name">${App.escapeHtml(candidate.name)}</h3>
                <p class="candidate-desc">${App.escapeHtml(candidate.description || '')}</p>
            `;

            card.addEventListener('click', () => this.toggleCandidate(candidate.id, card));
            grid.appendChild(card);
        });

        this.updateSelectionUI();
    },

    toggleCandidate(candidateId, cardElement) {
        if (this.selectedCandidates.has(candidateId)) {
            this.selectedCandidates.delete(candidateId);
            cardElement.classList.remove('selected');
        } else {
            if (this.selectedCandidates.size >= this.maxVotes) {
                App.showToast(`En fazla ${this.maxVotes} aday seçebilirsiniz`, 'warning');
                cardElement.classList.add('animate-shake');
                setTimeout(() => cardElement.classList.remove('animate-shake'), 500);
                return;
            }
            this.selectedCandidates.add(candidateId);
            cardElement.classList.add('selected');
        }

        this.updateSelectionUI();
    },

    updateSelectionUI() {
        const countEl = document.getElementById('selection-count');
        const btn = document.getElementById('btn-confirm-vote');

        countEl.textContent = this.selectedCandidates.size;
        btn.disabled = this.selectedCandidates.size === 0;
    },

    confirmVote() {
        const selectedNames = this.candidates
            .filter(c => this.selectedCandidates.has(c.id))
            .map(c => c.name);

        const namesList = selectedNames.map(n => `• ${n}`).join('\n');

        App.showConfirm(
            'Oyunuzu Onaylıyor Musunuz?',
            `Aşağıdaki adaylara oy vereceksiniz:\n${namesList}`,
            () => this.submitVote(),
            '🗳️'
        );
    },

    async submitVote() {
        const btn = document.getElementById('btn-confirm-vote');
        App.setButtonLoading(btn, true);

        try {
            await API.castVote(
                this.currentElection.id,
                Array.from(this.selectedCandidates)
            );

            App.showToast('Oyunuz başarıyla kaydedildi! 🎉', 'success');
            this.showVoteSuccess();
            // Refresh participation panel immediately
            this.loadParticipation(this.currentElection.id);
        } catch (error) {
            App.setButtonLoading(btn, false);
        }
    },

    showVoteSuccess() {
        const grid = document.getElementById('candidates-grid');
        const actions = document.getElementById('voting-actions');
        
        actions.classList.add('hidden');
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem;">
                <div class="success-checkmark animate-bounceIn">
                    <div class="check-icon"></div>
                </div>
                <h2 style="margin: 1.5rem 0 0.5rem; font-size: 1.5rem;">Oyunuz Kaydedildi!</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">Oy kullandığınız için teşekkür ederiz.</p>
                <button class="btn btn-primary" onclick="App.navigate('#results/${this.currentElection.id}')">
                    Durumu Görüntüle
                </button>
            </div>
        `;

        setTimeout(() => launchConfetti(), 500);
    }
};
