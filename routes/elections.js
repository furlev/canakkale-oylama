const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateAdmin, authenticateAny } = require('../middleware/auth');

// GET /api/elections - List elections
router.get('/', authenticateAny, (req, res) => {
  try {
    let elections;
    if (req.user.type === 'admin') {
      elections = db.prepare('SELECT * FROM elections ORDER BY created_at DESC').all();
    } else {
      // Voters only see active elections
      elections = db.prepare("SELECT * FROM elections WHERE status = 'active' ORDER BY created_at DESC").all();
    }

    // Attach candidate count and vote count for each election
    const enriched = elections.map(election => {
      const candidateCount = db.prepare('SELECT COUNT(*) as count FROM candidates WHERE election_id = ?').get(election.id).count;
      const voteCount = db.prepare('SELECT COUNT(*) as count FROM votes WHERE election_id = ?').get(election.id).count;
      const voterCount = db.prepare('SELECT COUNT(DISTINCT voter_id) as count FROM votes WHERE election_id = ?').get(election.id).count;
      return { ...election, candidateCount, voteCount, voterCount };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get elections error:', error);
    res.status(500).json({ success: false, error: 'Seçimler alınamadı' });
  }
});

// GET /api/elections/:id - Get single election with candidates
router.get('/:id', authenticateAny, (req, res) => {
  try {
    const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(req.params.id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    // If voter, only allow viewing active elections
    if (req.user.type === 'voter' && election.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Bu seçime erişim yetkiniz yok' });
    }

    const candidates = db.prepare('SELECT * FROM candidates WHERE election_id = ? ORDER BY display_order ASC, id ASC').all(election.id);
    const voteCount = db.prepare('SELECT COUNT(*) as count FROM votes WHERE election_id = ?').get(election.id).count;
    const voterCount = db.prepare('SELECT COUNT(DISTINCT voter_id) as count FROM votes WHERE election_id = ?').get(election.id).count;

    res.json({
      success: true,
      data: { ...election, candidates, voteCount, voterCount }
    });
  } catch (error) {
    console.error('Get election error:', error);
    res.status(500).json({ success: false, error: 'Seçim bilgisi alınamadı' });
  }
});

// POST /api/elections - Create election
router.post('/', authenticateAdmin, (req, res) => {
  try {
    const { title, description, max_votes, start_date, end_date } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Seçim başlığı gerekli' });
    }

    const result = db.prepare(
      'INSERT INTO elections (title, description, max_votes, start_date, end_date) VALUES (?, ?, ?, ?, ?)'
    ).run(
      title,
      description || '',
      max_votes || 1,
      start_date || null,
      end_date || null
    );

    const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: election });
  } catch (error) {
    console.error('Create election error:', error);
    res.status(500).json({ success: false, error: 'Seçim oluşturulamadı' });
  }
});

// PUT /api/elections/:id - Update election
router.put('/:id', authenticateAdmin, (req, res) => {
  try {
    const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(req.params.id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    const { title, description, max_votes, start_date, end_date } = req.body;

    db.prepare(
      'UPDATE elections SET title = ?, description = ?, max_votes = ?, start_date = ?, end_date = ? WHERE id = ?'
    ).run(
      title || election.title,
      description !== undefined ? description : election.description,
      max_votes !== undefined ? max_votes : election.max_votes,
      start_date !== undefined ? start_date : election.start_date,
      end_date !== undefined ? end_date : election.end_date,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM elections WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update election error:', error);
    res.status(500).json({ success: false, error: 'Seçim güncellenemedi' });
  }
});

// PUT /api/elections/:id/status - Change election status
router.put('/:id/status', authenticateAdmin, (req, res) => {
  try {
    const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(req.params.id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    const { status } = req.body;
    const validStatuses = ['draft', 'active', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Geçersiz durum. Geçerli durumlar: draft, active, completed' });
    }

    db.prepare('UPDATE elections SET status = ? WHERE id = ?').run(status, req.params.id);

    const updated = db.prepare('SELECT * FROM elections WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update election status error:', error);
    res.status(500).json({ success: false, error: 'Seçim durumu güncellenemedi' });
  }
});

// DELETE /api/elections/:id - Delete election (only if draft)
router.delete('/:id', authenticateAdmin, (req, res) => {
  try {
    const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(req.params.id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    if (election.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Sadece taslak durumundaki seçimler silinebilir' });
    }

    db.prepare('DELETE FROM elections WHERE id = ?').run(req.params.id);

    res.json({ success: true, data: { message: 'Seçim başarıyla silindi' } });
  } catch (error) {
    console.error('Delete election error:', error);
    res.status(500).json({ success: false, error: 'Seçim silinemedi' });
  }
});

module.exports = router;
