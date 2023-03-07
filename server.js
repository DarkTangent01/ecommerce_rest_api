import express from "express";
import { APP_IP_ADDRESS, APP_PORT, DB_URL } from "./config";
import errorHandler from "./middlewares/errorHandler";
import helmet from "helmet";
import hpp from "hpp";
import cors from "cors";
import xss from "xss-clean";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import fs from "fs";
import path from "path";


const app = express();
import routes from "./routes";
import mongoose from "mongoose";

const mongodbURI = process.env.DB_URL || DB_URL;
mongoose.connect(mongodbURI, {
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "Connection Error: "));
db.once("open", () => {
  console.log("[+] DB Connected...");
});

global.appRoot = path.resolve(__dirname);


// Create a logs directory if it doesn't exist

const logsDirectory = path.join(__dirname, "logs");
if (!fs.existsSync(logsDirectory)){
  fs.mkdirSync(logsDirectory);
}

// Middleware setup
app.use(helmet());
app.use(hpp());
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ strict: false }));
app.use(xss());
app.use(mongoSanitize());

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);


// Middleware to log requests

app.use((req, res, next) => {
  const logMessage = `${new Date().toISOString()} - ${req.method} ${req.path}\n`;
  const logFilePath = path.join(logsDirectory, "access.log");

  // Append log message to access.log file
  fs.appendFile(logFilePath, logMessage, (err) => {
    if (err) {
      console.error(`Error writing to log file: ${err}`);
    }
  });
  next();
});

app.use("/api", routes);
app.use("/uploads", express.static("uploads"));

app.use(errorHandler);
app.listen(APP_PORT, () =>
  console.log(`[+] Listening on http://${APP_IP_ADDRESS}:${APP_PORT}/`)
);
