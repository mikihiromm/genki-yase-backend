import express from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const client = new Anthropic();

// 写真からAIで食事を分析（精度向上版）
router.post('/analyze', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '写真が選択されていません。食事の写真を撮ってから分析してください。' });

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: '対応していない画像形式です。JPEG・PNG形式の写真をご使用ください。' });
    }

    const imageBase64 = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `あなたは日本の管理栄養士です。シニア（60〜80代）向けに食事の栄養分析をしてください。

写真に写っている料理を日本食の知識をもとに詳しく分析し、以下のJSON形式のみで返してください。
説明文・コードブロック・余計な文字は一切不要です。JSONのみ出力してください。

分析のポイント：
- 茶碗・皿のサイズから分量を推定する
- 日本食特有の食材（出汁、みりん、醤油など）の塩分も考慮する
- シニアに不足しがちなタンパク質・カルシウム・ビタミンDに注目する
- 料理が見えない・不明な場合も最善の推定値を返す

{
  "dishes": ["料理名1", "料理名2"],
  "totalCalories": 数値（kcal）,
  "protein": 数値（g）,
  "salt": 数値（g、小数第一位まで）,
  "carbs": 数値（g）,
  "fat": 数値（g）,
  "calcium": 数値（mg）,
  "fiber": 数値（g）,
  "advice": "シニア向けの栄養アドバイス（40文字以内、具体的に）",
  "caution": "塩分や糖質など注意点があれば（なければ空文字）",
  "confidence": "high または medium または low（推定の確信度）"
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
    if (err.message?.includes('API')) {
      return res.status(503).json({ error: 'AI分析サービスに接続できませんでした。しばらくしてからもう一度お試しください。' });
    }
    res.status(500).json({ error: '食事の分析に失敗しました。写真を撮り直してもう一度お試しください。' });
  }
});

// 食事記録を保存
router.post('/', async (req, res) => {
  const { userId, mealType, dishes, calories, protein, salt, carbs, fat, mealDate } = req.body;
  if (!userId || !mealType || !mealDate) {
    return res.status(400).json({ error: 'ユーザーID・食事の種類・日付は必須です。入力内容を確認してください。' });
  }
  const validMealTypes = ['朝ごはん', '昼ごはん', '夜ごはん', '間食'];
  if (!validMealTypes.includes(mealType)) {
    return res.status(400).json({ error: '食事の種類は「朝ごはん・昼ごはん・夜ごはん・間食」のいずれかを選んでください。' });
  }
  try {
    const result = await db.query(
      `INSERT INTO meal_records (user_id, meal_type, dishes, calories, protein, salt, carbs, fat, meal_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [userId, mealType, JSON.stringify(dishes), calories, protein, salt, carbs, fat, mealDate]
    );
    res.json({ success: true, data: result.rows[0], message: `${mealType}を記録しました。` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '食事の記録に失敗しました。もう一度お試しください。' });
  }
});

// 過去7日間の食事履歴 + AIアドバイス（/:userId/:dateより前に定義する必要あり）
router.get('/history/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM meal_records
       WHERE user_id = $1 AND meal_date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY meal_date DESC, created_at ASC`,
      [userId]
    );

    // 日付ごとにグループ化
    const grouped = {};
    for (const row of result.rows) {
      const d = row.meal_date instanceof Date
        ? row.meal_date.toISOString().split('T')[0]
        : String(row.meal_date).split('T')[0];
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(row);
    }

    // データが少ない場合はAIアドバイスをスキップ
    let advice = null;
    if (result.rows.length >= 2) {
      const summary = Object.entries(grouped).slice(0, 5).map(([date, meals]) => {
        const totalCal = meals.reduce((s, m) => s + (m.calories || 0), 0);
        const totalProt = meals.reduce((s, m) => s + parseFloat(m.protein || 0), 0);
        const totalSalt = meals.reduce((s, m) => s + parseFloat(m.salt || 0), 0);
        const dishes = meals.flatMap(m => Array.isArray(m.dishes) ? m.dishes : []);
        return `${date}: ${dishes.join('、')} / ${totalCal}kcal / タンパク質${totalProt.toFixed(1)}g / 塩分${totalSalt.toFixed(1)}g`;
      }).join('\n');

      const aiRes = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `あなたは日本の管理栄養士です。シニア（60〜80代）の食事履歴を見て、日本語でアドバイスをください。

食事履歴（直近）：
${summary}

以下のJSON形式のみで返してください（説明文不要）：
{
  "overall": "全体的な食習慣のコメント（50文字以内）",
  "good": "良い点（40文字以内）",
  "improve": "改善のヒント（40文字以内）",
  "tip": "明日から試せる具体的なアドバイス（50文字以内）"
}`
        }]
      });

      const text = aiRes.content[0].text.trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) advice = JSON.parse(match[0]);
    }

    res.json({ success: true, history: grouped, advice, count: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '履歴の取得に失敗しました。' });
  }
});

// 日付別の食事記録を取得
router.get('/:userId/:date', async (req, res) => {
  const { userId, date } = req.params;
  if (!userId || !date) {
    return res.status(400).json({ error: 'ユーザーIDと日付を指定してください。' });
  }
  try {
    const result = await db.query(
      `SELECT * FROM meal_records WHERE user_id = $1 AND meal_date = $2 ORDER BY created_at ASC`,
      [userId, date]
    );
    const totals = result.rows.reduce(
      (acc, row) => ({
        calories: acc.calories + (row.calories || 0),
        protein:  acc.protein  + (row.protein  || 0),
        salt:     acc.salt     + (row.salt     || 0),
        carbs:    acc.carbs    + (row.carbs    || 0),
        fat:      acc.fat      + (row.fat      || 0),
      }),
      { calories: 0, protein: 0, salt: 0, carbs: 0, fat: 0 }
    );
    res.json({ success: true, meals: result.rows, totals, count: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '食事記録の取得に失敗しました。もう一度お試しください。' });
  }
});

export default router;
