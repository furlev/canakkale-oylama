/* ========================================
   ÇANAKKALE OYLAMA SİSTEMİ - CONFETTI
   ======================================== */

const Confetti = {
    canvas: null,
    ctx: null,
    particles: [],
    animationId: null,
    isRunning: false,

    colors: [
        '#d4a843', '#e8c468', '#FFD700',  // Golds
        '#1a3a5c', '#2d6b9e', '#3498db',  // Blues
        '#ffffff', '#e0e0e0',              // Whites
        '#e74c3c', '#ff6b6b',              // Reds
        '#2ecc71', '#27ae60'               // Greens
    ],

    launch() {
        this.canvas = document.getElementById('confetti-canvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.canvas.classList.add('active');

        this.particles = [];
        this.isRunning = true;

        // Generate particles
        const count = Math.min(200, Math.floor(window.innerWidth / 5));
        for (let i = 0; i < count; i++) {
            this.particles.push(this.createParticle());
        }

        // Start animation
        this.animate();

        // Fade out after 5 seconds
        setTimeout(() => {
            this.canvas.style.transition = 'opacity 1.5s ease';
            this.canvas.style.opacity = '0';
            setTimeout(() => {
                this.stop();
            }, 1500);
        }, 5000);
    },

    createParticle() {
        const color = this.colors[Math.floor(Math.random() * this.colors.length)];
        const shape = Math.random() > 0.5 ? 'rect' : 'circle';
        const size = Math.random() * 10 + 5;

        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * -this.canvas.height - 50,
            size: size,
            color: color,
            shape: shape,
            velocityX: (Math.random() - 0.5) * 4,
            velocityY: Math.random() * 3 + 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 8,
            gravity: 0.05 + Math.random() * 0.05,
            drag: 0.97 + Math.random() * 0.02,
            wobble: Math.random() * 10,
            wobbleSpeed: Math.random() * 0.1 + 0.05,
            wobbleOffset: Math.random() * Math.PI * 2,
            opacity: 1,
            fadeSpeed: 0.001 + Math.random() * 0.002
        };
    },

    animate() {
        if (!this.isRunning) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let activeParticles = 0;

        this.particles.forEach(p => {
            if (p.opacity <= 0) return;
            activeParticles++;

            // Physics
            p.velocityY += p.gravity;
            p.velocityX *= p.drag;
            p.x += p.velocityX + Math.sin(p.wobbleOffset) * p.wobble * 0.05;
            p.y += p.velocityY;
            p.rotation += p.rotationSpeed;
            p.wobbleOffset += p.wobbleSpeed;

            // Fade when below screen
            if (p.y > this.canvas.height * 0.85) {
                p.opacity -= p.fadeSpeed * 5;
            }

            // Draw
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate((p.rotation * Math.PI) / 180);
            this.ctx.globalAlpha = Math.max(0, p.opacity);
            this.ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.restore();
        });

        if (activeParticles > 0) {
            this.animationId = requestAnimationFrame(() => this.animate());
        } else {
            this.stop();
        }
    },

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.canvas) {
            this.canvas.classList.remove('active');
            this.canvas.style.opacity = '';
            this.canvas.style.transition = '';
            if (this.ctx) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }
        this.particles = [];
    }
};

// Resize handler
window.addEventListener('resize', () => {
    if (Confetti.canvas && Confetti.isRunning) {
        Confetti.canvas.width = window.innerWidth;
        Confetti.canvas.height = window.innerHeight;
    }
});

// Export global
function launchConfetti() {
    Confetti.launch();
}
