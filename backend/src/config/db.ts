import mongoose from 'mongoose';
import dns from 'dns';
import { config } from './env';

// Use reliable DNS resolvers (Google & Cloudflare) to prevent querySrv ECONNREFUSED on local networks
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (err) {
  console.warn('[DB] Could not override DNS servers, using system default:', err);
}

export const connectDB = async (retries = 5, delay = 2500): Promise<void> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(config.mongoURL);
      console.log('Connected to MongoDB!');
      return;
    } catch (error: any) {
      console.error(`MongoDB connection attempt ${attempt}/${retries} failed:`, error?.message || error);
      if (attempt === retries) {
        console.error('All MongoDB connection attempts exhausted.');
        process.exit(1);
      }
      console.log(`Retrying MongoDB connection in ${delay / 1000}s...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};
