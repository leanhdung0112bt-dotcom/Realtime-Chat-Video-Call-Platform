import 'dotenv/config';

import http from 'http';
import mongoose from 'mongoose';
import { validateTokenConfiguration } from "./utils/token.utils.js";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initSocket } from "./sockets/socket.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    validateTokenConfiguration();
    // 1. Connect Database
    await connectDB();
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));

    // 2. Create HTTP server
    const server = http.createServer(app);

    // 3. Initialize Socket.io
    const io = initSocket(server);
    const shutdown = () => {
      io.close();
      server.close(() => { void mongoose.disconnect().finally(() => process.exit(0)); });
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);

    // 4. Start listening
    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(` Realtime Chat & Video Server running on :${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
