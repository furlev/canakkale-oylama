const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db/database');
const { authenticateAdmin } = require('../middleware/auth');

// Multer for logo upload
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `site-logo${ext}`);
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir'));
    }
  }
});

// GET /api/settings/logo - Get current logo
router.get('/logo', async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    
    for (const ext of extensions) {
      const logoPath = path.join(uploadsDir, `site-logo${ext}`);
      if (fs.existsSync(logoPath)) {
        return res.json({ success: true, data: { logo: `/uploads/site-logo${ext}?t=${Date.now()}` } });
      }
    }

    res.json({ success: true, data: { logo: null } });
  } catch (error) {
    console.error('Get logo error:', error);
    res.status(500).json({ success: false, error: 'Logo bilgisi alınamadı' });
  }
});

// POST /api/settings/logo - Upload logo
router.post('/logo', authenticateAdmin, uploadLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Logo dosyası yüklenmedi' });
    }

    // Remove old logos with different extensions
    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
    const currentExt = path.extname(req.file.filename).toLowerCase();
    const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    
    for (const ext of extensions) {
      if (ext !== currentExt) {
        const oldPath = path.join(uploadsDir, `site-logo${ext}`);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }

    res.json({
      success: true,
      data: { logo: `/uploads/${req.file.filename}?t=${Date.now()}` }
    });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ success: false, error: 'Logo yüklenemedi' });
  }
});

// DELETE /api/settings/logo - Remove logo
router.delete('/logo', authenticateAdmin, async (req, res) => {
  try {
    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
    const extensions = ['.png', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    
    for (const ext of extensions) {
      const logoPath = path.join(uploadsDir, `site-logo${ext}`);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }

    res.json({ success: true, data: { message: 'Logo silindi' } });
  } catch (error) {
    console.error('Delete logo error:', error);
    res.status(500).json({ success: false, error: 'Logo silinemedi' });
  }
});

module.exports = router;
