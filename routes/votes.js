const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateAdmin, authenticateVoter, authenticateAny } = require('../middleware/auth');

// POST /api/votes - Cast vote
router.post('/', authenticateVoter, (req, res) => {
  try {
    const { election_id, candidate_ids } = req.body;
    const voterId = req.voter.id;

    if (!election_id || !candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Seçim ID ve aday listesi gerekli' });
    }

    // Check election exists and is active
    const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(election_id);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }
    if (election.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Bu seçim aktif değil' });
    }

    // Check candidate count against max_votes
    if (candidate_ids.length > election.max_votes) {
      return res.status(400).json({
        success: false,
        error: `En fazla ${election.max_votes} aday seçebilirsiniz`
      });
    }

    // Check voter hasn't already voted in this election
    const existingVote = db.prepare('SELECT id FROM votes WHERE election_id = ? AND voter_id = ?').get(election_id, voterId);
    if (existingVote) {
      return res.status(400).json({ success: false, error: 'Bu seçimde zaten oy kullandınız' });
    }

    // Validate all candidate IDs belong to this election
    for (const candidateId of candidate_ids) {
      const candidate = db.prepare('SELECT id FROM candidates WHERE id = ? AND election_id = ?').get(candidateId, election_id);
      if (!candidate) {
        return res.status(400).json({ success: false, error: `Geçersiz aday ID: ${candidateId}` });
      }
    }

    // Insert votes atomically using a transaction
    const insertVote = db.prepare('INSERT INTO votes (election_id, voter_id, candidate_id) VALUES (?, ?, ?)');
    const insertMany = db.transaction((candidates) => {
      for (const candidateId of candidates) {
        insertVote.run(election_id, voterId, candidateId);
      }
    });

    insertMany(candidate_ids);

    res.status(201).json({
      success: true,
      data: { message: 'Oyunuz başarıyla kaydedildi', election_id, candidate_ids }
    });
  } catch (error) {
    console.error('Cast vote error:', error);
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ success: false, error: 'Bu seçimde zaten oy kullandınız' });
    }
    res.status(500).json({ success: false, error: 'Oy kullanılamadı' });
  }
});

// GET /api/votes/my/:electionId - Get voter's own votes for an election
router.get('/my/:electionId', authenticateVoter, (req, res) => {
  try {
    const votes = db.prepare(`
      SELECT v.*, c.name as candidate_name, c.image as candidate_image
      FROM votes v
      JOIN candidates c ON v.candidate_id = c.id
      WHERE v.election_id = ? AND v.voter_id = ?
    `).all(req.params.electionId, req.voter.id);

    res.json({ success: true, data: votes });
  } catch (error) {
    console.error('Get my votes error:', error);
    res.status(500).json({ success: false, error: 'Oylarınız alınamadı' });
  }
});

// GET /api/votes/results/:electionId - Get aggregated results
router.get('/results/:electionId', authenticateAny, (req, res) => {
  try {
    const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(req.params.electionId);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    const results = db.prepare(`
      SELECT 
        c.id as candidate_id,
        c.name as candidate_name,
        c.image as candidate_image,
        c.description as candidate_description,
        c.display_order,
        COUNT(v.id) as vote_count
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      WHERE c.election_id = ?
      GROUP BY c.id
      ORDER BY vote_count DESC, c.display_order ASC
    `).all(req.params.electionId);

    const totalVotes = db.prepare('SELECT COUNT(*) as count FROM votes WHERE election_id = ?').get(req.params.electionId).count;
    const totalVoters = db.prepare('SELECT COUNT(DISTINCT voter_id) as count FROM votes WHERE election_id = ?').get(req.params.electionId).count;

    res.json({
      success: true,
      data: {
        election,
        results,
        totalVotes,
        totalVoters
      }
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ success: false, error: 'Sonuçlar alınamadı' });
  }
});

// GET /api/votes/detailed/:electionId - Get detailed vote data (admin only)
router.get('/detailed/:electionId', authenticateAdmin, (req, res) => {
  try {
    const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(req.params.electionId);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    const votes = db.prepare(`
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
      WHERE v.election_id = ?
      ORDER BY v.voted_at DESC
    `).all(req.params.electionId);

    res.json({
      success: true,
      data: { election, votes }
    });
  } catch (error) {
    console.error('Get detailed votes error:', error);
    res.status(500).json({ success: false, error: 'Detaylı oy bilgileri alınamadı' });
  }
});

// GET /api/votes/stats/:electionId - Get statistics (admin only)
router.get('/stats/:electionId', authenticateAdmin, (req, res) => {
  try {
    const election = db.prepare('SELECT * FROM elections WHERE id = ?').get(req.params.electionId);
    if (!election) {
      return res.status(404).json({ success: false, error: 'Seçim bulunamadı' });
    }

    const totalVoters = db.prepare('SELECT COUNT(*) as count FROM voters WHERE is_active = 1').get().count;
    const votedCount = db.prepare('SELECT COUNT(DISTINCT voter_id) as count FROM votes WHERE election_id = ?').get(req.params.electionId).count;
    const participationRate = totalVoters > 0 ? ((votedCount / totalVoters) * 100).toFixed(2) : 0;
    const totalVotes = db.prepare('SELECT COUNT(*) as count FROM votes WHERE election_id = ?').get(req.params.electionId).count;

    // Per-candidate stats
    const candidateStats = db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.image,
        COUNT(v.id) as vote_count,
        CASE WHEN ? > 0 THEN ROUND(CAST(COUNT(v.id) AS FLOAT) / ? * 100, 2) ELSE 0 END as vote_percentage
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      WHERE c.election_id = ?
      GROUP BY c.id
      ORDER BY vote_count DESC
    `).all(totalVotes, totalVotes, req.params.electionId);

    res.json({
      success: true,
      data: {
        election,
        totalVoters,
        votedCount,
        notVotedCount: totalVoters - votedCount,
        participationRate: parseFloat(participationRate),
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
