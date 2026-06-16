import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// 当设置 PUBLIC_DIR 时，由同一进程托管已构建的前端静态文件（用于 Docker / 离线独立运行）。
// Replit 开发环境不设置该变量，前端仍由 Vite 单独提供，二者互不影响。
const publicDir = process.env["PUBLIC_DIR"];
if (publicDir && fs.existsSync(publicDir)) {
  logger.info({ publicDir }, "Serving static frontend");
  app.use(express.static(publicDir));
  // SPA 回退：非 /api 的 GET 请求一律返回 index.html，交给前端路由处理。
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
