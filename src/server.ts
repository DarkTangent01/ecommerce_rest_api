import express, { type NextFunction, type Request, type Response } from "express";
import type { Server } from "http";
import { APP_IP_ADDRESS, APP_PORT, CORS_ORIGIN, NODE_ENV, REQUEST_BODY_LIMIT, RESERVATION_SWEEP_SECONDS, TRUST_PROXY } from "./config/index.js";
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
import { connectDatabase, mongoose, registerDatabaseEvents } from "./infrastructure/database/mongoose.js";
import { isOriginAllowed, parseOriginList } from "./utils/cors.js";
import routes from "./modules/routes.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Sources live in src/ (or dist/ once built); logs and uploads stay at the project root.
const projectRoot = path.resolve(__dirname, "..");

/**
 * Mongoose does not retry a failed initial connection, so the process used to run forever
 * without a database. Retry with capped backoff; /ready reports 503 until connected.
 */
const connectWithRetry = async (attempt = 1): Promise<void> => {
  try {
    await connectDatabase();
  } catch (err) {
    const delayMs = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
    console.error(`[!] DB connection failed (attempt ${attempt}): ${(err as Error).message}; retrying in ${delayMs}ms`);
    setTimeout(() => void connectWithRetry(attempt + 1), delayMs).unref();
  }
};

const installProcessHandlers = (httpServer: Server, stopSweeper: () => void) => {
  let shuttingDown = false;
  const shutdown = (reason: string, exitCode: number) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logEvent("info", "server.shutdown", null, { reason });
    stopSweeper();
    // Give in-flight requests time to finish, then force exit.
    setTimeout(() => process.exit(exitCode || 1), 10_000).unref();
    httpServer.close(() => {
      void mongoose.disconnect().finally(() => process.exit(exitCode));
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM", 0));
  process.on("SIGINT", () => shutdown("SIGINT", 0));
  process.on("unhandledRejection", (reason) => {
    logEvent("error", "process.unhandled_rejection", null, { reason: reason instanceof Error ? reason.stack : String(reason) });
  });
  process.on("uncaughtException", (err) => {
    logEvent("error", "process.uncaught_exception", null, { error: err.stack });
    shutdown("uncaughtException", 1);
  });
};

const startServer = async (): Promise<Server> => {
  await connectWithRetry();
  const stopSweeper = startReservationSweeper(RESERVATION_SWEEP_SECONDS);

  // Bind to the configured address (it used to be ignored, so the API listened on every interface).
  const httpServer = app.listen(APP_PORT, APP_IP_ADDRESS, () => console.log(`[+] Listening on http://${APP_IP_ADDRESS}:${APP_PORT}/`));
  installProcessHandlers(httpServer, stopSweeper);
  return httpServer;
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
// Off unless TRUST_PROXY names the proxy in front of the app. A hard-coded hop count let any
// client pick req.ip via X-Forwarded-For when the app was reached directly (SEC-01).
app.set("trust proxy", TRUST_PROXY);
app.use(requestContext);
app.use(tenantContext);
app.use(metricsMiddleware);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(preventParameterPollution);
const allowlist = parseOriginList(CORS_ORIGIN);
app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowlist, NODE_ENV)) {
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
// Public product images only (I-2): exactly the names the upload handler generates, served so the
// browser can never run them as a page. Private files must not be stored in uploads/.
const UPLOAD_NAME = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|webp)$/;
app.use("/uploads", (req: Request, res: Response, next: NextFunction) => {
  if (!UPLOAD_NAME.test(req.path)) return next(CustomeErrorHandler.notFound("Route not found"));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  return next();
});
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
