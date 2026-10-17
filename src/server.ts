import express, { type NextFunction, type Request, type Response } from "express";
import type { Server } from "http";
import { APP_IP_ADDRESS, APP_PORT, CORS_ORIGIN, NODE_ENV, REQUEST_BODY_LIMIT, RESERVATION_SWEEP_SECONDS } from "./config/index.js";
import { startReservationSweeper } from "./services/inventoryService.js";
import errorHandler from "./middlewares/errorHandler.js";
import helmet from "helmet";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generalLimiter } from "./middlewares/rateLimiters.js";
import CustomeErrorHandler from "./shared/errors/CustomeErrorHandler.js";
import { requestContext, logEvent } from "./utils/requestContext.js";
import { rawJsonBody } from "./middlewares/rawBody.js";
import preventParameterPollution from "./middlewares/preventParameterPollution.js";
import tenantContext from "./middlewares/tenantContext.js";
import metricsMiddleware from "./middlewares/metricsMiddleware.js";
import sanitizeInput from "./middlewares/sanitizeInput.js";
import sanitizeNoSql from "./middlewares/sanitizeNoSql.js";
import { connectDatabase, registerDatabaseEvents } from "./infrastructure/database/mongoose.js";
import routes from "./modules/routes.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Sources live in src/ (or dist/ once built); logs and uploads stay at the project root.
const projectRoot = path.resolve(__dirname, "..");

const startServer = async (): Promise<Server> => {
  try {
    await connectDatabase();
  } catch (err) {
    console.error(`[!] DB connection failed: ${(err as Error).message}`);
  }
  startReservationSweeper(RESERVATION_SWEEP_SECONDS);

  return app.listen(APP_PORT, () => console.log(`[+] Listening on http://${APP_IP_ADDRESS}:${APP_PORT}/`));
};
registerDatabaseEvents();

global.appRoot = projectRoot;

// Create a logs directory if it doesn't exist

const logsDirectory = path.join(projectRoot, "logs");
if (!fs.existsSync(logsDirectory)) {
  fs.mkdirSync(logsDirectory);
}

// Middleware setup
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(requestContext);
app.use(tenantContext);
app.use(metricsMiddleware);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(preventParameterPollution);
const allowlist = CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowlist.length === 0 || allowlist.includes(origin)) {
        return callback(null, true);
      }
      return callback(CustomeErrorHandler.forbidden("CORS origin denied"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-Id", "Idempotency-Key", "X-Step-Up-Verified"],
  })
);
app.use(express.urlencoded({ extended: false, limit: REQUEST_BODY_LIMIT, parameterLimit: 100 }));
app.use(express.json({ strict: true, limit: REQUEST_BODY_LIMIT, verify: rawJsonBody }));
app.use(sanitizeInput);
app.use(sanitizeNoSql);
app.use(generalLimiter);

// Middleware to log requests

app.use((req: Request, _res: Response, next: NextFunction) => {
  const logMessage = `${new Date().toISOString()} ${req.requestId} ${req.method} ${req.path}\n`;
  const logFilePath = path.join(logsDirectory, "access.log");
  logEvent("info", "request.received", req);

  // Append log message to access.log file
  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error(`Error writing to log file: ${err.message}`);
    }
  });
  next();
});

app.use("/api", routes);
app.use("/api/v1", routes);
app.use(
  "/uploads",
  express.static("uploads", {
    fallthrough: false,
    dotfiles: "deny",
    maxAge: NODE_ENV === "production" ? "7d" : 0,
  })
);

app.use((_req: Request, _res: Response, next: NextFunction) => {
  return next(CustomeErrorHandler.notFound("Route not found"));
});

app.use(errorHandler);
const isMain = Boolean(process.argv[1]) && path.resolve(process.argv[1] ?? "") === __filename;
let server: Server | undefined;

if (isMain) {
  server = await startServer();
}

export { app, server, connectDatabase, startServer };
