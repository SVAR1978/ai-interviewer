import http from 'http';
import app from './app';
import { connectDB } from './config/db';
import { config } from './config/env';
import { initSocketServer } from './sockets/interview.socket';

const startServer = async () => {
  await connectDB();
  const server = http.createServer(app);
  initSocketServer(server);

  server.listen(config.port, () => {
    console.log(`Server is running on port ${config.port} with Socket.io enabled`);
  });
};

startServer();
