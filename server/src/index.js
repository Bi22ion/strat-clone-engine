import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import datasetRoutes from './routes/datasets.js';
import modelRoutes from './routes/models.js';
import brokerRoutes from './routes/broker.js';
import botRoutes from './routes/bots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Explicitly allow your Vercel frontend, local environments, and optional env variable
app.use(cors({
  origin: [
    'https://nexus-live-seven.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Strat-Clone Engine API', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/bots', botRoutes);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Strat-Clone Engine API running on http://localhost:${PORT}`);
});

export default app;