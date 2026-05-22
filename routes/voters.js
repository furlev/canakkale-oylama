const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const db = require('../db/database');
const { authenticateAdmin } = require('../middleware/auth');

// Multer configuration for profile image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir (jpeg, jpg, png, gif, webp)'));
    }
  }
});

// Generate unique 8-character uppercase alphanumeric token
function generateVoterToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    token = '';
    for (let i = 0; i < 8; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
    const existing = db.prepare('SELECT id FROM voters WHERE token = ?').get(token);
    if (!existing) break;
  } while (attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('Benzersiz token oluşturulamadı');
  }

  return token;
}

// GET /api/voters - List all voters
router.get('/', authenticateAdmin, (req, res) => {
  try {
    const voters = db.prepare('SELECT * FROM voters ORDER BY created_at DESC').all();
    res.json({ success: true, data: voters });
  } catch (error) {
    console.error('Get voters error:', error);
    res.status(500).json({ success: false, error: 'Seçmenler alınamadı' });
  }
});

// POST /api/voters - Create voter
router.post('/', authenticateAdmin, upload.single('profile_image'), (req, res) => {
  try {
    const { first_name, last_name, role } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ success: false, error: 'Ad ve soyad gerekli' });
    }

    const token = generateVoterToken();
    let profileImage = '';
    if (req.file) {
      profileImage = '/uploads/' + req.file.filename;
    }

    const result = db.prepare(
      'INSERT INTO voters (token, first_name, last_name, role, profile_image) VALUES (?, ?, ?, ?, ?)'
    ).run(token, first_name, last_name, role || '', profileImage);

    const voter = db.prepare('SELECT * FROM voters WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: voter });
  } catch (error) {
    console.error('Create voter error:', error);
    res.status(500).json({ success: false, error: 'Seçmen oluşturulamadı' });
  }
});

// POST /api/voters/upload-image/:id - Upload profile image for voter
router.post('/upload-image/:id', authenticateAdmin, upload.single('profile_image'), (req, res) => {
  try {
    const voter = db.prepare('SELECT * FROM voters WHERE id = ?').get(req.params.id);
    if (!voter) {
      return res.status(404).json({ success: false, error: 'Seçmen bulunamadı' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Resim dosyası gerekli' });
    }

    const profileImage = '/uploads/' + req.file.filename;
    db.prepare('UPDATE voters SET profile_image = ? WHERE id = ?').run(profileImage, req.params.id);

    const updated = db.prepare('SELECT * FROM voters WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Upload voter image error:', error);
    res.status(500).json({ success: false, error: 'Profil resmi yüklenemedi' });
  }
});

// PUT /api/voters/:id - Update voter
router.put('/:id', authenticateAdmin, (req, res) => {
  try {
    const voter = db.prepare('SELECT * FROM voters WHERE id = ?').get(req.params.id);
    if (!voter) {
      return res.status(404).json({ success: false, error: 'Seçmen bulunamadı' });
    }

    const { first_name, last_name, role, is_active } = req.body;

    db.prepare(
      'UPDATE voters SET first_name = ?, last_name = ?, role = ?, is_active = ? WHERE id = ?'
    ).run(
      first_name || voter.first_name,
      last_name || voter.last_name,
      role !== undefined ? role : voter.role,
      is_active !== undefined ? (is_active ? 1 : 0) : voter.is_active,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM voters WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update voter error:', error);
    res.status(500).json({ success: false, error: 'Seçmen güncellenemedi' });
  }
});

// DELETE /api/voters/:id - Delete voter
router.delete('/:id', authenticateAdmin, (req, res) => {
  try {
    const voter = db.prepare('SELECT * FROM voters WHERE id = ?').get(req.params.id);
    if (!voter) {
      return res.status(404).json({ success: false, error: 'Seçmen bulunamadı' });
    }

    db.prepare('DELETE FROM voters WHERE id = ?').run(req.params.id);

    res.json({ success: true, data: { message: 'Seçmen başarıyla silindi' } });
  } catch (error) {
    console.error('Delete voter error:', error);
    res.status(500).json({ success: false, error: 'Seçmen silinemedi' });
  }
});

module.exports = router;
