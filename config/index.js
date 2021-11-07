import dotenv from "dotenv";
dotenv.config();
export const {
  APP_PORT,
  APP_IP_ADDRESS,
  DEBUG_MODE,
  DB_URL,
  JWT_SECRET,
  REFRESH_SECRET,
} = process.env;
