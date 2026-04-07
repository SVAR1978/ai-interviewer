import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import interviewRoutes from './routes/interview.routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));

app.use('/auth', authRoutes);
app.use('/api', interviewRoutes);
app.use(express.static('public'));

export default app;
