import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mealRoutes from './routes/meals.js';
import exerciseRoutes from './routes/exercises.js';
import healthRoutes from './routes/health.js';
import goalRoutes from './routes/goals.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/meals', mealRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/goals', goalRoutes);

app.get('/api/ping', (req, res) => res.json({ status: 'ok', version: '1.1.0' }));

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>元気やせ API</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; color: #333; }
    h1 { font-size: 28px; color: #185FA5; }
    .badge { display: inline-block; background: #E1F5EE; color: #0F6E56; padding: 4px 12px; border-radius: 99px; font-size: 13px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; background: #f5f5f5; padding: 8px 12px; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    a { color: #185FA5; }
  </style>
</head>
<body>
  <h1>🥗 元気やせ API</h1>
  <span class="badge">✓ 稼働中 v1.1.0</span>
  <p>シニア向けダイエットアプリ「元気やせ」のバックエンドAPIです。</p>
  <table>
    <tr><th>エンドポイント</th><th>機能</th></tr>
    <tr><td><code>GET /api/ping</code></td><td>動作確認</td></tr>
    <tr><td><code>POST /api/meals/analyze</code></td><td>食事写真をAI分析</td></tr>
    <tr><td><code>POST /api/meals</code></td><td>食事記録を保存</td></tr>
    <tr><td><code>GET /api/meals/:userId/:date</code></td><td>日付別食事を取得</td></tr>
    <tr><td><code>GET /api/exercises</code></td><td>体操メニュー一覧（17種）</td></tr>
    <tr><td><code>GET /api/exercises/chair</code></td><td>椅子体操10種</td></tr>
    <tr><td><code>GET /api/exercises/today</code></td><td>今日のおすすめ体操</td></tr>
    <tr><td><code>POST /api/health</code></td><td>体重・血圧を記録</td></tr>
    <tr><td><code>GET /api/goals/presets</code></td><td>カロリー目標の目安</td></tr>
    <tr><td><code>POST /api/goals/:userId</code></td><td>カロリー目標を設定</td></tr>
  </table>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`元気やせ サーバー起動 → http://localhost:${PORT}`);
});
