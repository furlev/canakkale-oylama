const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'canakkale-oylama-secret-2026';

function authenticateAdmin(req, res, next) {
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

function authenticateVoter(req, res, next) {
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

    // Fetch full voter data from DB
    const voter = db.prepare('SELECT * FROM voters WHERE id = ? AND is_active = 1').get(decoded.id);
    if (!voter) {
      return res.status(401).json({ success: false, error: 'Seçmen bulunamadı veya devre dışı' });
    }

    req.voter = voter;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token süresi dolmuş' });
    }
    return res.status(401).json({ success: false, error: 'Geçersiz token' });
  }
}

function authenticateAny(req, res, next) {
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
      const voter = db.prepare('SELECT * FROM voters WHERE id = ? AND is_active = 1').get(decoded.id);
      if (!voter) {
        return res.status(401).json({ success: false, error: 'Seçmen bulunamadı veya devre dışı' });
      }
      req.user = { type: 'voter', data: voter };
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
