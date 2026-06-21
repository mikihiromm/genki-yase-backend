import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mealRoutes from './routes/meals.js';
import exerciseRoutes from './routes/exercises.js';
import healthRoutes from './routes/health.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/meals', mealRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/health', healthRoutes);

app.get('/api/ping', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`元気やせ サーバー起動 → http://localhost:${PORT}`);
});
