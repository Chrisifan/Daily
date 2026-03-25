import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import classifyRouter from "./routes/classify.js";
import suggestionsRouter from "./routes/suggestions.js";

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || ["http://localhost:1420", "tauri://localhost"],
  credentials: true,
}));

app.use(express.json());

// 请求日志
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 路由
app.use("/api/classify", classifyRouter);
app.use("/api/suggestions", suggestionsRouter);

// 健康检查
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "smart-workbench-ai",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    aiEnabled: !!process.env.OPENAI_API_KEY,
  });
});

// 404 处理
app.use((_req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "The requested resource was not found",
  });
});

// 错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║         Smart Workbench AI Service                     ║
╠════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                          ║
║  AI Enabled: ${process.env.OPENAI_API_KEY ? "Yes ✓" : "No (mock mode)"}                          ║
╚════════════════════════════════════════════════════════╝
  `);
});
