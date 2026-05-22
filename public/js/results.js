/* ========================================
   ÇANAKKALE OYLAMA SİSTEMİ - RESULTS MODULE
   ======================================== */

const Results = {
    currentElectionId: null,

    async loadResults(electionId) {
        this.currentElectionId = electionId;

        const waitingEl = document.getElementById('results-waiting');
        const contentEl = document.getElementById('results-content');
        const backBtn = document.getElementById('results-back-btn');

        waitingEl.classList.add('hidden');
        contentEl.classList.add('hidden');

        try {
            // Get election info
            const election = await API.getElection(electionId);

            // If election is active, check if user voted
            if (election.status === 'active') {
                if (App.currentUser && !App.isAdmin()) {
                    try {
                        const myVotes = await API.getMyVotes(electionId);
                        const votes = Array.isArray(myVotes) ? myVotes : [];
                        if (votes.length === 0) {
                            // Hasn't voted yet, redirect to voting
                            App.navigate(`#voting/${electionId}`);
                            return;
                        }
                    } catch (e) {
                        // If error checking votes, show waiting
                    }
                }

                // Show waiting screen for voters
                if (App.currentUser && !App.isAdmin()) {
                    waitingEl.classList.remove('hidden');
                    contentEl.classList.add('hidden');
                    return;
                }
            }

            // Load results
            await this.showResults(electionId, election);

        } catch (error) {
            waitingEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Sonuçlar yüklenemedi</h3>
                    <p>Lütfen daha sonra tekrar deneyin.</p>
                </div>
            `;
            waitingEl.classList.remove('hidden');
        }
    },

    async showResults(electionId, election) {
        const contentEl = document.getElementById('results-content');
        const winnerName = document.getElementById('winner-name');
        const winnerCard = document.getElementById('winner-card');
        const chartEl = document.getElementById('results-chart');

        try {
            const resultsData = await API.getResults(electionId);
            const results = resultsData.results || [];

            if (results.length === 0) {
                contentEl.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📊</div>
                        <h3>Henüz oy kullanılmamış</h3>
                    </div>
                `;
                contentEl.classList.remove('hidden');
                return;
            }

            // Sort by vote count
            const sorted = [...results].sort((a, b) => (b.vote_count || b.votes || 0) - (a.vote_count || a.votes || 0));
            const totalVotes = sorted.reduce((sum, r) => sum + (r.vote_count || r.votes || 0), 0);
            const winner = sorted[0];

            // Show winner if election is completed
            if (election.status === 'completed' && winner) {
                winnerName.textContent = winner.candidate_name || winner.name || 'Bilinmiyor';
                winnerCard.classList.remove('hidden');
                winnerCard.style.display = '';

                // Launch confetti for completed elections
                setTimeout(() => launchConfetti(), 800);
            } else {
                winnerCard.style.display = 'none';
            }

            // Render bar chart
            chartEl.innerHTML = '';
            sorted.forEach((result, index) => {
                const voteCount = result.vote_count || result.votes || 0;
                const percentage = totalVotes > 0 ? ((voteCount / totalVotes) * 100).toFixed(1) : 0;
                const isWinner = index === 0 && election.status === 'completed';

                const barItem = document.createElement('div');
                barItem.className = `result-bar-item animate-slideUp stagger-${Math.min(index + 1, 10)}`;
                barItem.innerHTML = `
                    <div class="result-bar-info">
                        <span class="result-bar-name">${App.escapeHtml(result.candidate_name || result.name || 'Aday')}</span>
                        <div class="result-bar-count">
                            <span class="result-bar-votes" data-target="${voteCount}">0</span>
                            <span class="result-bar-percent">(${percentage}%)</span>
                        </div>
                    </div>
                    <div class="result-bar-track">
                        <div class="result-bar-fill ${isWinner ? 'winner' : ''}" data-width="${percentage}"></div>
                    </div>
                `;

                chartEl.appendChild(barItem);
            });

            contentEl.classList.remove('hidden');

            // Animate bars and numbers after a short delay
            setTimeout(() => {
                document.querySelectorAll('.result-bar-fill').forEach(bar => {
                    bar.style.width = bar.dataset.width + '%';
                });

                document.querySelectorAll('.result-bar-votes').forEach(el => {
                    const target = parseInt(el.dataset.target);
                    App.animateCountUp(el, target, 1200);
                });
            }, 300);

        } catch (error) {
            contentEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>Sonuçlar yüklenemedi</h3>
                </div>
            `;
            contentEl.classList.remove('hidden');
        }
    }
};
