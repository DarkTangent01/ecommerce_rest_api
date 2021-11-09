import express from "express";
import { APP_IP_ADDRESS, APP_PORT, DB_URL } from "./config";
import errorHandler from "./middlewares/errorHandler";
const app = express();
import routes from "./routes";
import mongoose from "mongoose";
import path from 'path';


// Databse Connection
mongoose.connect(DB_URL, {
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "Connection Error: "));
db.once("open", () => {
  console.log("[+] DB Connected...");
});

global.appRoot = path.resolve(__dirname);

app.use(express.urlencoded({extended: false}));
app.use(express.json());
app.use("/api", routes);

app.use(errorHandler);
app.listen(APP_PORT, () =>
  console.log(`[+] Listning on http://${APP_IP_ADDRESS}:${APP_PORT}/`)
);
