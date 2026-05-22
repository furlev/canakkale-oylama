const jwt = require('jsonwebtoken');
const { pool } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'canakkale-oylama-secret-2026';

async function authenticateAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Yetkilendirme token\'ı gerekli' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin yetkisi gerekli' });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token süresi dolmuş' });
    }
    return res.status(401).json({ success: false, error: 'Geçersiz token' });
  }
}

async function authenticateVoter(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Yetkilendirme token\'ı gerekli' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'voter') {
      return res.status(403).json({ success: false, error: 'Seçmen yetkisi gerekli' });
    }

    const { rows } = await pool.query('SELECT * FROM voters WHERE id = $1 AND is_active = TRUE', [decoded.id]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Seçmen bulunamadı veya devre dışı' });
    }

    req.voter = rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token süresi dolmuş' });
    }
    return res.status(401).json({ success: false, error: 'Geçersiz token' });
  }
}

async function authenticateAny(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Yetkilendirme token\'ı gerekli' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type === 'admin') {
      req.user = { type: 'admin', data: decoded };
    } else if (decoded.type === 'voter') {
      const { rows } = await pool.query('SELECT * FROM voters WHERE id = $1 AND is_active = TRUE', [decoded.id]);
      if (rows.length === 0) {
        return res.status(401).json({ success: false, error: 'Seçmen bulunamadı veya devre dışı' });
      }
      req.user = { type: 'voter', data: rows[0] };
    } else {
      return res.status(401).json({ success: false, error: 'Geçersiz token türü' });
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token süresi dolmuş' });
    }
    return res.status(401).json({ success: false, error: 'Geçersiz token' });
  }
}

module.exports = { authenticateAdmin, authenticateVoter, authenticateAny, JWT_SECRET };
