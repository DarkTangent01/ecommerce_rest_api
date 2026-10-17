import { QUEUE_BACKEND, REDIS_URL } from "../config/index.js";

const jobs = [];

export const enqueueJob = async (name, payload) => {
  const job = {
    id: `${Date.now()}-${jobs.length + 1}`,
    name,
    payload,
    status: "queued",
    createdAt: new Date(),
  };
  jobs.push(job);
  return job;
};

export const queueInfo = () => ({
  backend: REDIS_URL && QUEUE_BACKEND === "bullmq" ? "bullmq-ready" : "memory",
  queued: jobs.filter((job) => job.status === "queued").length,
});
