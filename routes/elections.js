const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { authenticateAdmin, authenticateAny } = require('../middleware/auth');

// GET /api/elections - List elections
router.get('/', authenticateAny, async (req, res) => {
  try {
    let elections;
    if (req.user.type === 'admin') {
      const { rows } = await pool.query('SELECT * FROM elections ORDER BY created_at DESC');
      elections = rows;
    } else {
      const { rows } = await pool.query("SELECT * FROM elections WHERE status = 'active' ORDER BY created_at DESC");
      elections = rows;
    }

    // Enrich with counts
    for (const election of elections) {
      const cc = await pool.query('SELECT COUNT(*)::int as count FROM candidates WHERE election_id = $1', [election.id]);
      const vc = await pool.query('SELECT COUNT(*)::int as count FROM votes WHERE election_id = $1', [election.id]);
      const vrc = await pool.query('SELECT COUNT(DISTINCT voter_id)::int as count FROM votes WHERE election_id = $1', [election.id]);
      election.candidateCount = cc.rows[0].count;
      election.voteCount = vc.rows[0].count;
      election.voterCount = vrc.rows[0].count;
    }

    res.json({ success: true, data: elections });
  } catch (error) {
    console.error('Get elections error:', error);
    res.status(500).json({ success: false, error: 'Seçimler alınamadı' });
  }
});

// GET /api/elections/:id - Get single election with candidates
router.get('/:id', authenticateAny, async (req, res) => {
  try {
    const { rows: elRows } = await pool.query('SELECT * FROM elections WHERE id = $1', [req.params.id]);
    if (elRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }
    const election = elRows[0];

    if (req.user.type === 'voter' && election.status !== 'active') {
      return res.status(403).json({ success: false, error: 'Bu seçime erişim yetkiniz yok' });
    }

    const { rows: candidates } = await pool.query(
      'SELECT * FROM candidates WHERE election_id = $1 ORDER BY display_order ASC, id ASC', [election.id]
    );
    const vc = await pool.query('SELECT COUNT(*)::int as count FROM votes WHERE election_id = $1', [election.id]);
    const vrc = await pool.query('SELECT COUNT(DISTINCT voter_id)::int as count FROM votes WHERE election_id = $1', [election.id]);

    res.json({
      success: true,
      data: { ...election, candidates, voteCount: vc.rows[0].count, voterCount: vrc.rows[0].count }
    });
  } catch (error) {
    console.error('Get election error:', error);
    res.status(500).json({ success: false, error: 'Seçim bilgisi alınamadı' });
  }
});

// POST /api/elections - Create election
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { title, description, max_votes, start_date, end_date } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Seçim başlığı gerekli' });
    }

    const { rows } = await pool.query(
      'INSERT INTO elections (title, description, max_votes, start_date, end_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description || '', max_votes || 1, start_date || null, end_date || null]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Create election error:', error);
    res.status(500).json({ success: false, error: 'Seçim oluşturulamadı' });
  }
});

// PUT /api/elections/:id - Update election
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM elections WHERE id = $1', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }
    const election = existing[0];

    const { title, description, max_votes, start_date, end_date } = req.body;

    const { rows } = await pool.query(
      'UPDATE elections SET title = $1, description = $2, max_votes = $3, start_date = $4, end_date = $5 WHERE id = $6 RETURNING *',
      [
        title || election.title,
        description !== undefined ? description : election.description,
        max_votes !== undefined ? max_votes : election.max_votes,
        start_date !== undefined ? start_date : election.start_date,
        end_date !== undefined ? end_date : election.end_date,
        req.params.id
      ]
    );

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update election error:', error);
    res.status(500).json({ success: false, error: 'Seçim güncellenemedi' });
  }
});

// PUT /api/elections/:id/status - Change election status
router.put('/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM elections WHERE id = $1', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    const { status } = req.body;
    const validStatuses = ['draft', 'active', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Geçersiz durum. Geçerli durumlar: draft, active, completed' });
    }

    const { rows } = await pool.query('UPDATE elections SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Update election status error:', error);
    res.status(500).json({ success: false, error: 'Seçim durumu güncellenemedi' });
  }
});

// DELETE /api/elections/:id - Delete election (only if draft)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { rows: existing } = await pool.query('SELECT * FROM elections WHERE id = $1', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    if (existing[0].status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Sadece taslak durumundaki seçimler silinebilir' });
    }

    await pool.query('DELETE FROM elections WHERE id = $1', [req.params.id]);
    res.json({ success: true, data: { message: 'Seçim başarıyla silindi' } });
  } catch (error) {
    console.error('Delete election error:', error);
    res.status(500).json({ success: false, error: 'Seçim silinemedi' });
  }
});

module.exports = router;
