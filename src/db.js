import pg from 'pg';

const { Pool } = pg;

let pool;

const getPool = () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 1,
    });
  }
  return pool;
};

export const db = {
  query: (text, params) => getPool().query(text, params),
};

export const initDb = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS meal_records (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      dishes JSONB,
      calories INTEGER,
      protein NUMERIC(5,1),
      salt NUMERIC(4,1),
      carbs NUMERIC(5,1),
      fat NUMERIC(5,1),
      meal_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS exercise_records (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      exercise_id INTEGER NOT NULL,
      duration_minutes INTEGER,
      completed_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_records (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      weight NUMERIC(5,1),
      systolic INTEGER,
      diastolic INTEGER,
      recorded_at TIMESTAMP NOT NULL
    );
  `);
  console.log('データベース初期化完了');
};
