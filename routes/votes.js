const express = require('express');
const router = express.Router();
const { pool } = require('../db/database');
const { authenticateAdmin, authenticateVoter, authenticateAny } = require('../middleware/auth');

// POST /api/votes - Cast vote
router.post('/', authenticateVoter, async (req, res) => {
  const client = await pool.connect();
  try {
    const { election_id, candidate_ids } = req.body;
    const voterId = req.voter.id;

    if (!election_id || !candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Seçim ID ve aday listesi gerekli' });
    }

    // Check election exists and is active
    const { rows: elRows } = await client.query('SELECT * FROM elections WHERE id = $1', [election_id]);
    if (elRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }
    if (elRows[0].status !== 'active') {
      return res.status(400).json({ success: false, error: 'Bu seçim aktif değil' });
    }

    // Check candidate count against max_votes
    if (candidate_ids.length > elRows[0].max_votes) {
      return res.status(400).json({
        success: false,
        error: `En fazla ${elRows[0].max_votes} aday seçebilirsiniz`
      });
    }

    // Check voter hasn't already voted
    const { rows: existingVotes } = await client.query(
      'SELECT id FROM votes WHERE election_id = $1 AND voter_id = $2', [election_id, voterId]
    );
    if (existingVotes.length > 0) {
      return res.status(400).json({ success: false, error: 'Bu seçimde zaten oy kullandınız' });
    }

    // Validate all candidate IDs
    for (const candidateId of candidate_ids) {
      const { rows } = await client.query(
        'SELECT id FROM candidates WHERE id = $1 AND election_id = $2', [candidateId, election_id]
      );
      if (rows.length === 0) {
        return res.status(400).json({ success: false, error: `Geçersiz aday ID: ${candidateId}` });
      }
    }

    // Insert votes atomically
    await client.query('BEGIN');
    for (const candidateId of candidate_ids) {
      await client.query(
        'INSERT INTO votes (election_id, voter_id, candidate_id) VALUES ($1, $2, $3)',
        [election_id, voterId, candidateId]
      );
    }
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: { message: 'Oyunuz başarıyla kaydedildi', election_id, candidate_ids }
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Cast vote error:', error);
    if (error.message && error.message.includes('unique')) {
      return res.status(400).json({ success: false, error: 'Bu seçimde zaten oy kullandınız' });
    }
    res.status(500).json({ success: false, error: 'Oy kullanılamadı' });
  } finally {
    client.release();
  }
});

// GET /api/votes/my/:electionId - Get voter's own votes
router.get('/my/:electionId', authenticateVoter, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT v.*, c.name as candidate_name, c.image as candidate_image
      FROM votes v
      JOIN candidates c ON v.candidate_id = c.id
      WHERE v.election_id = $1 AND v.voter_id = $2
    `, [req.params.electionId, req.voter.id]);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get my votes error:', error);
    res.status(500).json({ success: false, error: 'Oylarınız alınamadı' });
  }
});

// GET /api/votes/results/:electionId - Get aggregated results
router.get('/results/:electionId', authenticateAny, async (req, res) => {
  try {
    const { rows: elRows } = await pool.query('SELECT * FROM elections WHERE id = $1', [req.params.electionId]);
    if (elRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    const { rows: results } = await pool.query(`
      SELECT 
        c.id as candidate_id,
        c.name as candidate_name,
        c.image as candidate_image,
        c.description as candidate_description,
        c.display_order,
        COUNT(v.id)::int as vote_count
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      WHERE c.election_id = $1
      GROUP BY c.id, c.name, c.image, c.description, c.display_order
      ORDER BY vote_count DESC, c.display_order ASC
    `, [req.params.electionId]);

    const tvResult = await pool.query('SELECT COUNT(*)::int as count FROM votes WHERE election_id = $1', [req.params.electionId]);
    const vrResult = await pool.query('SELECT COUNT(DISTINCT voter_id)::int as count FROM votes WHERE election_id = $1', [req.params.electionId]);

    res.json({
      success: true,
      data: {
        election: elRows[0],
        results,
        totalVotes: tvResult.rows[0].count,
        totalVoters: vrResult.rows[0].count
      }
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ success: false, error: 'Sonuçlar alınamadı' });
  }
});

// GET /api/votes/detailed/:electionId - Get detailed vote data (admin only)
router.get('/detailed/:electionId', authenticateAdmin, async (req, res) => {
  try {
    const { rows: elRows } = await pool.query('SELECT * FROM elections WHERE id = $1', [req.params.electionId]);
    if (elRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    const { rows: votes } = await pool.query(`
      SELECT 
        v.id as vote_id,
        v.voted_at,
        vt.id as voter_id,
        vt.first_name as voter_first_name,
        vt.last_name as voter_last_name,
        vt.role as voter_role,
        c.id as candidate_id,
        c.name as candidate_name
      FROM votes v
      JOIN voters vt ON v.voter_id = vt.id
      JOIN candidates c ON v.candidate_id = c.id
      WHERE v.election_id = $1
      ORDER BY v.voted_at DESC
    `, [req.params.electionId]);

    res.json({
      success: true,
      data: { election: elRows[0], votes }
    });
  } catch (error) {
    console.error('Get detailed votes error:', error);
    res.status(500).json({ success: false, error: 'Detaylı oy bilgileri alınamadı' });
  }
});

// GET /api/votes/stats/:electionId - Get statistics (admin only)
router.get('/stats/:electionId', authenticateAdmin, async (req, res) => {
  try {
    const { rows: elRows } = await pool.query('SELECT * FROM elections WHERE id = $1', [req.params.electionId]);
    if (elRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    const tvResult = await pool.query('SELECT COUNT(*)::int as count FROM voters WHERE is_active = TRUE');
    const totalVoters = tvResult.rows[0].count;

    const vcResult = await pool.query('SELECT COUNT(DISTINCT voter_id)::int as count FROM votes WHERE election_id = $1', [req.params.electionId]);
    const votedCount = vcResult.rows[0].count;

    const participationRate = totalVoters > 0 ? parseFloat(((votedCount / totalVoters) * 100).toFixed(2)) : 0;

    const vtResult = await pool.query('SELECT COUNT(*)::int as count FROM votes WHERE election_id = $1', [req.params.electionId]);
    const totalVotes = vtResult.rows[0].count;

    const { rows: candidateStats } = await pool.query(`
      SELECT 
        c.id, c.name, c.image,
        COUNT(v.id)::int as vote_count,
        CASE WHEN $1 > 0 THEN ROUND(COUNT(v.id)::numeric / $1 * 100, 2) ELSE 0 END as vote_percentage
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      WHERE c.election_id = $2
      GROUP BY c.id, c.name, c.image
      ORDER BY vote_count DESC
    `, [totalVotes, req.params.electionId]);

    res.json({
      success: true,
      data: {
        election: elRows[0],
        totalVoters,
        votedCount,
        notVotedCount: totalVoters - votedCount,
        participationRate,
        totalVotes,
        candidateStats
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'İstatistikler alınamadı' });
  }
});

module.exports = router;
