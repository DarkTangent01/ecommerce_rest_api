import { QUEUE_BACKEND, REDIS_URL } from "../config/index.js";

export interface Job {
  id: string;
  name: string;
  payload: unknown;
  status: "queued" | "running" | "done" | "failed";
  createdAt: Date;
}

const jobs: Job[] = [];

export const enqueueJob = async (name: string, payload: unknown): Promise<Job> => {
  const job: Job = {
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
