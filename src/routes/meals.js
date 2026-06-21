import express from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const client = new Anthropic();

// 写真からAIで食事を分析
router.post('/analyze', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '写真が必要です' });

    const imageBase64 = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `この食事の写真を分析してください。日本のシニア向けの食事として、以下をJSON形式のみで返してください。説明文は不要です。
{
  "dishes": ["料理名1", "料理名2"],
  "totalCalories": 数値,
  "protein": 数値,
  "salt": 数値,
  "carbs": 数値,
  "fat": 数値,
  "advice": "シニア向けの一言アドバイス（30文字以内）"
}`,
          },
        ],
      }],
    });

    const text = response.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI応答の解析に失敗しました');

    const result = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '分析に失敗しました。もう一度お試しください。' });
  }
});

// 食事記録を保存
router.post('/', async (req, res) => {
  const { userId, mealType, dishes, calories, protein, salt, carbs, fat, mealDate } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO meal_records (user_id, meal_type, dishes, calories, protein, salt, carbs, fat, meal_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, mealType, JSON.stringify(dishes), calories, protein, salt, carbs, fat, mealDate]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '保存に失敗しました' });
  }
});

// 日付別の食事記録を取得
router.get('/:userId/:date', async (req, res) => {
  const { userId, date } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM meal_records WHERE user_id = $1 AND meal_date = $2 ORDER BY created_at ASC`,
      [userId, date]
    );
    const totals = result.rows.reduce(
      (acc, row) => ({
        calories: acc.calories + (row.calories || 0),
        protein: acc.protein + (row.protein || 0),
        salt: acc.salt + (row.salt || 0),
      }),
      { calories: 0, protein: 0, salt: 0 }
    );
    res.json({ success: true, meals: result.rows, totals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

export default router;
