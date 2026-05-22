const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/database');
const { authenticateAny, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login/admin
router.post('/login/admin', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Kullanıcı adı ve şifre gerekli' });
    }

    const { rows } = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    const admin = rows[0];
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
router.post('/login/voter', async (req, res) => {
  try {
    const { token: voterToken } = req.body;

    if (!voterToken) {
      return res.status(400).json({ success: false, error: 'Seçmen token\'ı gerekli' });
    }

    const { rows } = await pool.query('SELECT * FROM voters WHERE token = $1 AND is_active = TRUE', [voterToken]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Geçersiz veya devre dışı seçmen token\'ı' });
    }

    const voter = rows[0];
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
router.get('/me', authenticateAny, async (req, res) => {
  try {
    if (req.user.type === 'admin') {
      const { rows } = await pool.query('SELECT id, username, created_at FROM admins WHERE id = $1', [req.user.data.id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Admin bulunamadı' });
      }
      res.json({
        success: true,
        data: { type: 'admin', ...rows[0] }
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
