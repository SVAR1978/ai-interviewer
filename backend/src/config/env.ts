import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongoURL: process.env.mongourl || '',
  jwtSecret: process.env.jsonpassword || '',
  geminiKey: process.env.GEMINI_API_KEY || process.env.gemini_key || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  assemblyAIKey: process.env.apiKey || '',
  geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || process.env.EMAIL_USER || '',
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS || '',
    from: process.env.SMTP_FROM || process.env.EMAIL_FROM || '"AI Interviewer" <no-reply@ai-interviewer.com>',
  },
  redisURL: process.env.REDIS_URL || '',
};
