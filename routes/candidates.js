const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { authenticateAdmin, authenticateAny } = require('../middleware/auth');

// GET /api/candidates/election/:electionId - Get candidates for an election
router.get('/election/:electionId', authenticateAny, async (req, res) => {
  try {
    const { rows: elRows } = await pool.query('SELECT * FROM elections WHERE id = $1', [req.params.electionId]);
    if (elRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    if (req.user.type === 'voter' && elRows[0].status !== 'active') {
      return res.status(403).json({ success: false, error: 'Bu seçimin adaylarına erişim yetkiniz yok' });
    }

    const { rows: candidates } = await pool.query(
      'SELECT * FROM candidates WHERE election_id = $1 ORDER BY display_order ASC, id ASC',
      [req.params.electionId]
    );

    // Attach vote counts
    for (const candidate of candidates) {
      const vc = await pool.query('SELECT COUNT(*)::int as count FROM votes WHERE candidate_id = $1', [candidate.id]);
      candidate.voteCount = vc.rows[0].count;
    }

    res.json({ success: true, data: candidates });
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ success: false, error: 'Adaylar alınamadı' });
  }
});

// POST /api/candidates - Create candidate
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { election_id, name, description, image, display_order } = req.body;

    if (!election_id || !name) {
      return res.status(400).json({ success: false, error: 'Seçim ID ve aday adı gerekli' });
    }

    const { rows: elRows } = await pool.query('SELECT * FROM elections WHERE id = $1', [election_id]);
    if (elRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    const { rows } = await pool.query(
      'INSERT INTO candidates (election_id, name, description, image, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [election_id, name, description || '', image || '', display_order || 0]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Create candidate error:', error);
    res.status(500).json({ success: false, error: 'Aday oluşturulamadı' });
  }
});

// PUT /api/candidates/:id - Update candidate
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM candidates WHERE id = $1', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Aday bulunamadı' });
    }
    const candidate = existing[0];

    const { name, description, image, display_order } = req.body;

    const { rows } = await pool.query(
      'UPDATE candidates SET name = $1, description = $2, image = $3, display_order = $4 WHERE id = $5 RETURNING *',
      [
        name || candidate.name,
        description !== undefined ? description : candidate.description,
        image !== undefined ? image : candidate.image,
        display_order !== undefined ? display_order : candidate.display_order,
        req.params.id
      ]
    );

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update candidate error:', error);
    res.status(500).json({ success: false, error: 'Aday güncellenemedi' });
  }
});

// DELETE /api/candidates/:id - Delete candidate
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM candidates WHERE id = $1', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Aday bulunamadı' });
    }

    await pool.query('DELETE FROM candidates WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: { message: 'Aday başarıyla silindi' } });
  } catch (error) {
    console.error('Delete candidate error:', error);
    res.status(500).json({ success: false, error: 'Aday silinemedi' });
  }
});

module.exports = router;
