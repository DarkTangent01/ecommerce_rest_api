import { queueInfo } from "../utils/queue.js";
import { fileURLToPath } from "url";
import path from "path";

export const startWorkers = () => {
  console.log(JSON.stringify({ at: new Date().toISOString(), level: "info", message: "workers.ready", queue: queueInfo() }));
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  startWorkers();
}
