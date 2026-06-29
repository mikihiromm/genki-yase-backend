import express from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const client = new Anthropic();

const COURSE_PROMPTS = {
  time_saving: '時短重視：手順を最小限にする（レンジ加熱・和えるだけ・煮るだけ等）。包丁を使う工程やフライパンを使う時間も短く済む献立を優先する。',
  nutrition_balance: '栄養バランス重視：シニア（60〜80代）に不足しがちなタンパク質・カルシウム・食物繊維を積極的に取り入れ、塩分は控えめにする。',
  diet: 'ダイエット重視：1食あたりのカロリーを抑えつつ、高タンパク・高食物繊維で腹持ちの良い献立にする。揚げ物や糖質過多な主食は避ける。',
  use_up_ingredients: '材料使い切り重視：購入した食材の使用率を最大化し、余りが出ないよう1週間の中で食材を計画的に分配する。',
};

const COURSE_NAMES = {
  time_saving: '時短重視',
  nutrition_balance: '栄養バランス重視',
  diet: 'ダイエット重視',
  use_up_ingredients: '材料使い切り重視',
};

// 買い物写真から食材＋想定調味料を分析
router.post('/analyze-photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '写真が選択されていません。買い物した食材の写真を撮ってから分析してください。' });

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: '対応していない画像形式です。JPEG・PNG形式の写真をご使用ください。' });
    }

    const imageBase64 = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          {
            type: 'text',
            text: `写真に写っている買い物した食材を識別してください。

以下のJSON形式のみで返してください。説明文・コードブロック・余計な文字は一切不要です。

{
  "ingredients": ["食材名1", "食材名2", ...],
  "assumedSeasonings": ["家に常備していると想定される基本調味料（醤油・味噌・塩・砂糖・酒・みりん・油など、一般的な日本の家庭にあるもの）", ...]
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
    res.status(500).json({ error: '食材の分析に失敗しました。写真を撮り直してもう一度お試しください。' });
  }
});

// 1週間分の献立を生成
router.post('/generate', async (req, res) => {
  const { ingredients, seasonings, leftovers, course } = req.body;

  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: '食材が指定されていません。買い物写真を分析してから献立を作成してください。' });
  }
  if (!COURSE_PROMPTS[course]) {
    return res.status(400).json({ error: 'コースの指定が不正です。' });
  }

  try {
    const ingredientText = ingredients.join('、');
    const seasoningText = (seasonings || []).join('、') || 'なし';
    const leftoverText = (leftovers || []).join('、') || 'なし';

    const dishSchema = {
      type: 'object',
      properties: { name: { type: 'string' }, recipe: { type: 'string' } },
      required: ['name', 'recipe'],
    };
    const dinnerPatternSchema = {
      type: 'object',
      properties: {
        main: dishSchema,
        sides: { type: 'array', items: dishSchema, minItems: 3, maxItems: 3 },
      },
      required: ['main', 'sides'],
    };

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      tool_choice: { type: 'tool', name: 'submit_menu_plan' },
      tools: [{
        name: 'submit_menu_plan',
        description: '完成した1週間分の献立プランを送信する',
        input_schema: {
          type: 'object',
          properties: {
            usedIngredientsSummary: { type: 'string', description: '食材の使い切り具合の簡単な説明（80文字以内）' },
            days: {
              type: 'array',
              minItems: 7,
              maxItems: 7,
              items: {
                type: 'object',
                properties: {
                  day: { type: 'integer' },
                  breakfast: {
                    type: 'object',
                    properties: { dishes: { type: 'array', items: { type: 'string' } }, recipe: { type: 'string' } },
                    required: ['dishes', 'recipe'],
                  },
                  lunch: {
                    type: 'object',
                    properties: { dish: { type: 'string' }, recipe: { type: 'string' } },
                    required: ['dish', 'recipe'],
                  },
                  dinner: {
                    type: 'object',
                    properties: { patternA: dinnerPatternSchema, patternB: dinnerPatternSchema },
                    required: ['patternA', 'patternB'],
                  },
                },
                required: ['day', 'breakfast', 'lunch', 'dinner'],
              },
            },
          },
          required: ['usedIngredientsSummary', 'days'],
        },
      }],
      messages: [{
        role: 'user',
        content: `あなたは日本の管理栄養士兼料理研究家です。買い物してきた食材から1週間（7日分）の献立を提案し、submit_menu_planツールで送信してください。

【購入した食材】
${ingredientText}

【家にある調味料】
${seasoningText}

【冷蔵庫の残り物（追加で使ってよい食材）】
${leftoverText}

【コース】
${COURSE_NAMES[course]}：${COURSE_PROMPTS[course]}

【献立のルール】
- 朝食：栄養バランスよく。品数は柔軟（1〜3品程度）
- 昼食：1品でもよい
- 夕食：主菜1品＋副菜3品を、2パターン（パターンA・パターンB）提案する
- 購入した食材をできるだけ使い切るよう、1週間の中で計画的に配分する
- カレー・肉じゃがなど「ありふれた超定番メニュー」は多用しない。季節感や工夫のあるメニューを優先する
- レシピの作り方は1文・40文字以内で簡潔に（手順を細かく書かない）
- daysは1〜7まで7件、各dinnerのsidesはそれぞれ3件にしてください`,
      }],
    });

    if (response.stop_reason === 'max_tokens') {
      throw new Error('献立の生成が長くなりすぎたため途中で止まりました。食材数を減らしてもう一度お試しください。');
    }

    const toolUse = response.content.find(b => b.type === 'tool_use' && b.name === 'submit_menu_plan');
    if (!toolUse) throw new Error('AI応答の解析に失敗しました');

    res.json({ success: true, data: toolUse.input });
  } catch (err) {
    console.error(err);
    if (err.message?.includes('途中で止まりました')) {
      return res.status(500).json({ error: err.message });
    }
    if (err.message?.includes('API')) {
      return res.status(503).json({ error: 'AI献立生成サービスに接続できませんでした。しばらくしてからもう一度お試しください。' });
    }
    res.status(500).json({ error: '献立の生成に失敗しました。もう一度お試しください。' });
  }
});

export default router;
