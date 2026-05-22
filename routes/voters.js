const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../db/database');
const { authenticateAdmin } = require('../middleware/auth');

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir'));
    }
  }
});

// Generate random 8-character token
function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// GET /api/voters - List all voters
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM voters ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get voters error:', error);
    res.status(500).json({ success: false, error: 'Seçmenler alınamadı' });
  }
});

// POST /api/voters - Create voter
router.post('/', authenticateAdmin, upload.single('profile_image'), async (req, res) => {
  try {
    const { first_name, last_name, role } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ success: false, error: 'Ad ve soyad gerekli' });
    }

    // Generate unique token
    let token;
    let isUnique = false;
    while (!isUnique) {
      token = generateToken();
      const { rows } = await pool.query('SELECT id FROM voters WHERE token = $1', [token]);
      if (rows.length === 0) isUnique = true;
    }

    const profileImage = req.file ? `/uploads/${req.file.filename}` : '';

    const { rows } = await pool.query(
      'INSERT INTO voters (token, first_name, last_name, role, profile_image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [token, first_name, last_name, role || '', profileImage]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Create voter error:', error);
    res.status(500).json({ success: false, error: 'Seçmen oluşturulamadı' });
  }
});

// POST /api/voters/upload-image/:id - Upload profile image
router.post('/upload-image/:id', authenticateAdmin, upload.single('profile_image'), async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM voters WHERE id = $1', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçmen bulunamadı' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Dosya yüklenmedi' });
    }

    const profileImage = `/uploads/${req.file.filename}`;
    const { rows } = await pool.query(
      'UPDATE voters SET profile_image = $1 WHERE id = $2 RETURNING *',
      [profileImage, req.params.id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ success: false, error: 'Resim yüklenemedi' });
  }
});

// PUT /api/voters/:id - Update voter
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM voters WHERE id = $1', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçmen bulunamadı' });
    }
    const voter = existing[0];

    const { first_name, last_name, role, is_active } = req.body;

    const { rows } = await pool.query(
      'UPDATE voters SET first_name = $1, last_name = $2, role = $3, is_active = $4 WHERE id = $5 RETURNING *',
      [
        first_name || voter.first_name,
        last_name || voter.last_name,
        role !== undefined ? role : voter.role,
        is_active !== undefined ? is_active : voter.is_active,
        req.params.id
      ]
    );

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update voter error:', error);
    res.status(500).json({ success: false, error: 'Seçmen güncellenemedi' });
  }
});

// DELETE /api/voters/:id - Delete voter
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM voters WHERE id = $1', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçmen bulunamadı' });
    }

    await pool.query('DELETE FROM voters WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: { message: 'Seçmen başarıyla silindi' } });
  } catch (error) {
    console.error('Delete voter error:', error);
    res.status(500).json({ success: false, error: 'Seçmen silinemedi' });
  }
});

module.exports = router;
