const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateAdmin, authenticateAny } = require('../middleware/auth');

// GET /api/candidates/election/:electionId - Get candidates for an election
router.get('/election/:electionId', authenticateAny, (req, res) => {
  try {
    const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(req.params.electionId);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    // Voters can only see candidates of active elections
    if (req.user.type === 'voter' && election.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Bu seçimin adaylarına erişim yetkiniz yok' });
    }

    const candidates = db.prepare(
      'SELECT * FROM candidates WHERE election_id = ? ORDER BY display_order ASC, id ASC'
    ).all(req.params.electionId);

    // Attach vote counts for each candidate
    const enriched = candidates.map(candidate => {
      const voteCount = db.prepare('SELECT COUNT(*) as count FROM votes WHERE candidate_id = ?').get(candidate.id).count;
      return { ...candidate, voteCount };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ success: false, error: 'Adaylar alınamadı' });
  }
});

// POST /api/candidates - Create candidate
router.post('/', authenticateAdmin, (req, res) => {
  try {
    const { election_id, name, description, image, display_order } = req.body;

    if (!election_id || !name) {
      return res.status(400).json({ success: false, error: 'Seçim ID ve aday adı gerekli' });
    }

    const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(election_id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    const result = db.prepare(
      'INSERT INTO candidates (election_id, name, description, image, display_order) VALUES (?, ?, ?, ?, ?)'
    ).run(
      election_id,
      name,
      description || '',
      image || '',
      display_order || 0
    );

    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: candidate });
  } catch (error) {
    console.error('Create candidate error:', error);
    res.status(500).json({ success: false, error: 'Aday oluşturulamadı' });
  }
});

// PUT /api/candidates/:id - Update candidate
router.put('/:id', authenticateAdmin, (req, res) => {
  try {
    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Aday bulunamadı' });
    }

    const { name, description, image, display_order } = req.body;

    db.prepare(
      'UPDATE candidates SET name = ?, description = ?, image = ?, display_order = ? WHERE id = ?'
    ).run(
      name || candidate.name,
      description !== undefined ? description : candidate.description,
      image !== undefined ? image : candidate.image,
      display_order !== undefined ? display_order : candidate.display_order,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update candidate error:', error);
    res.status(500).json({ success: false, error: 'Aday güncellenemedi' });
  }
});

// DELETE /api/candidates/:id - Delete candidate
router.delete('/:id', authenticateAdmin, (req, res) => {
  try {
    const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(req.params.id);
    if (!candidate) {
      return res.status(404).json({ success: false, error: 'Aday bulunamadı' });
    }

    db.prepare('DELETE FROM candidates WHERE id = ?').run(req.params.id);

    res.json({ success: true, data: { message: 'Aday başarıyla silindi' } });
  } catch (error) {
    console.error('Delete candidate error:', error);
    res.status(500).json({ success: false, error: 'Aday silinemedi' });
  }
});

module.exports = router;
