import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// シニア向け体操メニュー一覧（固定マスターデータ）
const EXERCISE_MENU = [
  { id: 1, name: '椅子に座ったまま足上げ', duration: 5, level: '初級', category: '筋力', description: '椅子に座ったまま、片足ずつゆっくり上げ下げします。' },
  { id: 2, name: 'ゆっくり肩まわし', duration: 3, level: '初級', category: '柔軟', description: '両肩を大きくゆっくり回します。前10回・後ろ10回。' },
  { id: 3, name: 'その場足踏み体操', duration: 5, level: '中級', category: '有酸素', description: '足を高く上げながらその場で足踏みします。' },
  { id: 4, name: '壁を使った立ち座り練習', duration: 5, level: '初級', category: '筋力', description: '壁に手をついてゆっくり立ち座りを繰り返します。' },
  { id: 5, name: '首のゆっくりストレッチ', duration: 3, level: '初級', category: '柔軟', description: '首をゆっくり左右・前後に倒します。' },
  { id: 6, name: '深呼吸ウォーキング', duration: 10, level: '中級', category: '有酸素', description: '3歩吸って3歩吐きながらゆっくり歩きます。' },
];

// 今日のおすすめメニューを取得
router.get('/today', (req, res) => {
  const { level = '初級' } = req.query;
  const filtered = EXERCISE_MENU.filter(e => e.level === level || level === 'すべて');
  // カテゴリが重複しないよう1つずつ選ぶ
  const seen = new Set();
  const recommended = filtered.filter(e => {
    if (seen.has(e.category)) return false;
    seen.add(e.category);
    return true;
  });
  res.json({ success: true, exercises: recommended });
});

// 体操完了を記録
router.post('/complete', async (req, res) => {
  const { userId, exerciseId, durationMinutes, completedAt } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO exercise_records (user_id, exercise_id, duration_minutes, completed_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, exerciseId, durationMinutes, completedAt]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '記録に失敗しました' });
  }
});

// 体操記録の週次集計
router.get('/summary/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      `SELECT DATE(completed_at) as date, COUNT(*) as count, SUM(duration_minutes) as total_minutes
       FROM exercise_records
       WHERE user_id = $1 AND completed_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(completed_at) ORDER BY date ASC`,
      [userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

export default router;
