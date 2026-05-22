/* ========================================
   ÇANAKKALE OYLAMA SİSTEMİ - API MODULE
   ======================================== */

const API = {
    token: localStorage.getItem('auth_token'),
    baseURL: '',

    setToken(token) {
        this.token = token;
        localStorage.setItem('auth_token', token);
    },

    clearToken() {
        this.token = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
    },

    async request(method, url, data = null, isFormData = false) {
        const options = {
            method: method.toUpperCase(),
            headers: {}
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data) {
            if (isFormData) {
                options.body = data;
            } else {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(data);
            }
        }

        try {
            const response = await fetch(`${this.baseURL}${url}`, options);
            const result = await response.json();

            if (!response.ok) {
                const errorMessage = result.error || result.message || 'Bir hata oluştu';
                throw new Error(errorMessage);
            }

            // Backend wraps all responses in {success, data}, unwrap it
            if (result.success && result.data !== undefined) {
                return result.data;
            }

            return result;
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                if (typeof App !== 'undefined') App.showToast('Sunucuya bağlanılamıyor. Lütfen bağlantınızı kontrol edin.', 'error');
            } else if (error.message) {
                if (typeof App !== 'undefined') App.showToast(error.message, 'error');
            }
            throw error;
        }
    },

    // ===== AUTH =====
    async loginAdmin(username, password) {
        return this.request('POST', '/api/auth/login/admin', { username, password });
    },

    async loginVoter(token) {
        return this.request('POST', '/api/auth/login/voter', { token });
    },

    async getMe() {
        return this.request('GET', '/api/auth/me');
    },

    // ===== ELECTIONS =====
    async getElections() {
        return this.request('GET', '/api/elections');
    },

    async getElection(id) {
        return this.request('GET', `/api/elections/${id}`);
    },

    async createElection(data) {
        return this.request('POST', '/api/elections', data);
    },

    async updateElection(id, data) {
        return this.request('PUT', `/api/elections/${id}`, data);
    },

    async updateElectionStatus(id, status) {
        return this.request('PUT', `/api/elections/${id}/status`, { status });
    },

    async deleteElection(id) {
        return this.request('DELETE', `/api/elections/${id}`);
    },

    // ===== CANDIDATES =====
    async getCandidates(electionId) {
        return this.request('GET', `/api/candidates/election/${electionId}`);
    },

    async createCandidate(data) {
        return this.request('POST', '/api/candidates', data);
    },

    async updateCandidate(id, data) {
        return this.request('PUT', `/api/candidates/${id}`, data);
    },

    async deleteCandidate(id) {
        return this.request('DELETE', `/api/candidates/${id}`);
    },

    // ===== VOTERS =====
    async getVoters() {
        return this.request('GET', '/api/voters');
    },

    async createVoter(formData) {
        return this.request('POST', '/api/voters', formData, true);
    },

    async uploadVoterImage(id, formData) {
        return this.request('POST', `/api/voters/upload-image/${id}`, formData, true);
    },

    async updateVoter(id, data) {
        return this.request('PUT', `/api/voters/${id}`, data);
    },

    async deleteVoter(id) {
        return this.request('DELETE', `/api/voters/${id}`);
    },

    // ===== VOTES =====
    async castVote(electionId, candidateIds) {
        return this.request('POST', '/api/votes', {
            election_id: electionId,
            candidate_ids: candidateIds
        });
    },

    async getMyVotes(electionId) {
        return this.request('GET', `/api/votes/my/${electionId}`);
    },

    async getResults(electionId) {
        return this.request('GET', `/api/votes/results/${electionId}`);
    },

    async getDetailedResults(electionId) {
        return this.request('GET', `/api/votes/detailed/${electionId}`);
    },

    async getStats(electionId) {
        return this.request('GET', `/api/votes/stats/${electionId}`);
    },

    async getParticipation(electionId) {
        return this.request('GET', `/api/votes/participation/${electionId}`);
    },

    // ===== SETTINGS =====
    async getLogo() {
        return this.request('GET', '/api/settings/logo');
    },

    async uploadLogo(formData) {
        return this.request('POST', '/api/settings/logo', formData, true);
    },

    async deleteLogo() {
        return this.request('DELETE', '/api/settings/logo');
    }
};
