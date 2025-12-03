import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { initializeSocketHandlers } from "./socketHandlers.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const io = new Server(httpServer, { cors: corsOptions });
initializeSocketHandlers(io);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.get("/", (req, res) => {
  res.json({
    name: "Live Polling System API",
    version: "1.0.0",
  });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: "Something went wrong" });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { io };
