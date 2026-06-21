import express from 'express';
import { db } from '../db.js';

const router = express.Router();

const EXERCISE_MENU = [
  // 椅子体操（10種類）
  { id: 1,  name: '椅子に座ったまま足上げ',     duration: 5, level: '初級', category: '椅子体操', description: '椅子に座ったまま、片足ずつゆっくり上げ下げします。左右10回ずつ。' },
  { id: 2,  name: '椅子に座ったまま腕伸ばし',   duration: 3, level: '初級', category: '椅子体操', description: '両腕をゆっくり前に伸ばし、肩の高さまで上げ下げします。10回。' },
  { id: 3,  name: '椅子でかかと上げ下げ',       duration: 3, level: '初級', category: '椅子体操', description: '座ったままかかとをゆっくり上げ下げ。ふくらはぎを鍛えます。20回。' },
  { id: 4,  name: '椅子でひざ抱え体操',         duration: 4, level: '初級', category: '椅子体操', description: '片ひざを両手で抱えてゆっくり胸に引き寄せます。左右10回ずつ。' },
  { id: 5,  name: '椅子に座ったまま背伸び',     duration: 3, level: '初級', category: '椅子体操', description: '背筋を伸ばし、両手を上に伸ばします。深呼吸しながら5回。' },
  { id: 6,  name: '椅子でゆっくり上体ひねり',   duration: 4, level: '初級', category: '椅子体操', description: '椅子の背もたれを持ちながら上体をゆっくりひねります。左右10回。' },
  { id: 7,  name: '椅子でひざ伸ばし体操',       duration: 5, level: '初級', category: '椅子体操', description: '座ったまま片足をゆっくり伸ばし、3秒キープして戻します。10回ずつ。' },
  { id: 8,  name: '椅子で肩甲骨寄せ',           duration: 3, level: '初級', category: '椅子体操', description: '両肘を後ろに引いて肩甲骨を寄せます。肩こり解消に。10回。' },
  { id: 9,  name: '椅子でゆっくり首まわし',     duration: 3, level: '初級', category: '椅子体操', description: '首をゆっくり右・左・前・後ろと動かします。各5回ずつ。' },
  { id: 10, name: '椅子でお腹引き締め体操',     duration: 4, level: '初級', category: '椅子体操', description: 'お腹に力を入れて5秒キープ。座りながらできる腹筋トレーニング。10回。' },
  // 柔軟
  { id: 11, name: 'ゆっくり肩まわし',           duration: 3, level: '初級', category: '柔軟', description: '両肩を大きくゆっくり回します。前10回・後ろ10回。' },
  { id: 12, name: '足首くるくる体操',           duration: 3, level: '初級', category: '柔軟', description: '足首をゆっくり内側・外側に回します。転倒予防に効果的。' },
  { id: 13, name: '手首・指のストレッチ',       duration: 3, level: '初級', category: '柔軟', description: '指を1本ずつゆっくり反らせます。手のこわばり解消に。' },
  // 筋力
  { id: 14, name: '壁を使った立ち座り練習',     duration: 5, level: '初級', category: '筋力', description: '壁に手をついてゆっくり立ち座りを繰り返します。10回。' },
  { id: 15, name: '壁を使った腕立て伏せ',       duration: 5, level: '中級', category: '筋力', description: '壁に手をついて体を斜めにし、腕を曲げ伸ばしします。10回。' },
  // 有酸素
  { id: 16, name: 'その場足踏み体操',           duration: 5, level: '中級', category: '有酸素', description: '足を高く上げながらその場で足踏みします。1分を3セット。' },
  { id: 17, name: '深呼吸ウォーキング',         duration: 10, level: '中級', category: '有酸素', description: '3歩吸って3歩吐きながらゆっくり歩きます。' },
];

// 全メニュー取得
router.get('/', (req, res) => {
  const { level, category } = req.query;
  let result = EXERCISE_MENU;
  if (level && level !== 'すべて') result = result.filter(e => e.level === level);
  if (category && category !== 'すべて') result = result.filter(e => e.category === category);
  res.json({ success: true, exercises: result, total: result.length });
});

// 今日のおすすめメニューを取得（各カテゴリから1つずつ）
router.get('/today', (req, res) => {
  const { level = '初級' } = req.query;
  const filtered = EXERCISE_MENU.filter(e => e.level === level || level === 'すべて');
  const seen = new Set();
  const recommended = filtered.filter(e => {
    if (seen.has(e.category)) return false;
    seen.add(e.category);
    return true;
  });
  res.json({ success: true, exercises: recommended });
});

// 椅子体操だけ取得
router.get('/chair', (req, res) => {
  const chair = EXERCISE_MENU.filter(e => e.category === '椅子体操');
  res.json({ success: true, exercises: chair, total: chair.length });
});

// 体操完了を記録
router.post('/complete', async (req, res) => {
  const { userId, exerciseId, durationMinutes, completedAt } = req.body;
  if (!userId || !exerciseId) {
    return res.status(400).json({ error: 'ユーザーIDと体操IDは必須です' });
  }
  try {
    const result = await db.query(
      `INSERT INTO exercise_records (user_id, exercise_id, duration_minutes, completed_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, exerciseId, durationMinutes, completedAt || new Date()]
    );
    res.json({ success: true, data: result.rows[0], message: '体操を記録しました！お疲れさまでした。' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '体操の記録に失敗しました。もう一度お試しください。' });
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
    res.status(500).json({ error: '体操記録の取得に失敗しました。もう一度お試しください。' });
  }
});

export default router;
