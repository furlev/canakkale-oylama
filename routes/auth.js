const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authenticateAny, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login/admin
router.post('/login/admin', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Kullanıcı adı ve şifre gerekli' });
    }

    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    const isValid = bcrypt.compareSync(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    const token = jwt.sign(
      { type: 'admin', id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token,
        type: 'admin',
        id: admin.id,
        username: admin.username
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ success: false, error: 'Giriş sırasında bir hata oluştu' });
  }
});

// POST /api/auth/login/voter
router.post('/login/voter', (req, res) => {
  try {
    const { token: voterToken } = req.body;

    if (!voterToken) {
      return res.status(400).json({ success: false, error: 'Seçmen token\'ı gerekli' });
    }

    const voter = db.prepare('SELECT * FROM voters WHERE token = ? AND is_active = 1').get(voterToken);
    if (!voter) {
      return res.status(401).json({ success: false, error: 'Geçersiz veya devre dışı seçmen token\'ı' });
    }

    const jwtToken = jwt.sign(
      {
        type: 'voter',
        id: voter.id,
        firstName: voter.first_name,
        lastName: voter.last_name,
        role: voter.role,
        profileImage: voter.profile_image
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      data: {
        token: jwtToken,
        type: 'voter',
        id: voter.id,
        firstName: voter.first_name,
        lastName: voter.last_name,
        role: voter.role,
        profileImage: voter.profile_image
      }
    });
  } catch (error) {
    console.error('Voter login error:', error);
    res.status(500).json({ success: false, error: 'Giriş sırasında bir hata oluştu' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateAny, (req, res) => {
  try {
    if (req.user.type === 'admin') {
      const admin = db.prepare('SELECT id, username, created_at FROM admins WHERE id = ?').get(req.user.data.id);
      if (!admin) {
        return res.status(404).json({ success: false, error: 'Admin bulunamadı' });
      }
      res.json({
        success: true,
        data: { type: 'admin', ...admin }
      });
    } else {
      const voter = req.user.data;
      res.json({
        success: true,
        data: {
          type: 'voter',
          id: voter.id,
          firstName: voter.first_name,
          lastName: voter.last_name,
          role: voter.role,
          profileImage: voter.profile_image
        }
      });
    }
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, error: 'Kullanıcı bilgisi alınamadı' });
  }
});

module.exports = router;
