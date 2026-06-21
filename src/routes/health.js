import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// 体重・血圧を記録
router.post('/', async (req, res) => {
  const { userId, weight, systolic, diastolic, recordedAt } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO health_records (user_id, weight, systolic, diastolic, recorded_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, weight, systolic, diastolic, recordedAt]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '記録に失敗しました' });
  }
});

// 過去30日の健康記録を取得
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM health_records
       WHERE user_id = $1 AND recorded_at >= NOW() - INTERVAL '30 days'
       ORDER BY recorded_at ASC`,
      [userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

export default router;
