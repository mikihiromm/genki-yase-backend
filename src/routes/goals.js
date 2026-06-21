import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// シニア向けカロリー目標の目安
const CALORIE_PRESETS = {
  '女性・低活動': { calories: 1400, protein: 50, salt: 7.0,  label: '女性・あまり動かない方' },
  '女性・普通活動': { calories: 1600, protein: 55, salt: 7.0, label: '女性・普通に活動する方' },
  '男性・低活動': { calories: 1800, protein: 60, salt: 7.5,  label: '男性・あまり動かない方' },
  '男性・普通活動': { calories: 2000, protein: 65, salt: 7.5, label: '男性・普通に活動する方' },
};

// プリセット一覧を取得
router.get('/presets', (req, res) => {
  const list = Object.entries(CALORIE_PRESETS).map(([key, val]) => ({ key, ...val }));
  res.json({ success: true, presets: list });
});

// カロリー目標を保存・更新
router.post('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { calorieGoal, proteinGoal, saltGoal, presetKey } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'ユーザーIDを指定してください。' });
  }

  // プリセットが指定された場合はプリセット値を使用
  let goals = { calorieGoal, proteinGoal, saltGoal };
  if (presetKey && CALORIE_PRESETS[presetKey]) {
    const preset = CALORIE_PRESETS[presetKey];
    goals = { calorieGoal: preset.calories, proteinGoal: preset.protein, saltGoal: preset.salt };
  }

  if (!goals.calorieGoal || goals.calorieGoal < 800 || goals.calorieGoal > 4000) {
    return res.status(400).json({ error: 'カロリー目標は800〜4000kcalの範囲で設定してください。' });
  }

  try {
    await db.query(
      `INSERT INTO user_goals (user_id, calorie_goal, protein_goal, salt_goal, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET calorie_goal = $2, protein_goal = $3, salt_goal = $4, updated_at = NOW()`,
      [userId, goals.calorieGoal, goals.proteinGoal || null, goals.saltGoal || null]
    );
    res.json({
      success: true,
      goals: { ...goals, userId },
      message: `1日の目標を${goals.calorieGoal}kcalに設定しました。`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '目標の設定に失敗しました。もう一度お試しください。' });
  }
});

// カロリー目標を取得
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM user_goals WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        goals: { calorieGoal: 1600, proteinGoal: 55, saltGoal: 7.0 },
        isDefault: true,
        message: 'まだ目標が設定されていません。デフォルト値を表示しています。'
      });
    }
    const row = result.rows[0];
    res.json({
      success: true,
      goals: {
        calorieGoal: row.calorie_goal,
        proteinGoal: row.protein_goal,
        saltGoal: row.salt_goal,
      },
      isDefault: false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '目標の取得に失敗しました。もう一度お試しください。' });
  }
});

export default router;
