import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongoURL: process.env.mongourl || '',
  jwtSecret: process.env.jsonpassword || '',
  geminiKey: process.env.gemini_key || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5',
  assemblyAIKey: process.env.apiKey || '',
};
