import { SecuritySignal } from "../models/index.js";

export const evaluateCheckoutRisk = async ({ user, tenant, ip, total }) => {
  const recentSignals = await SecuritySignal.countDocuments({
    user,
    tenant,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    severity: { $in: ["medium", "high", "critical"] },
  });
  const score = Math.min(100, recentSignals * 20 + (total > 1000 ? 30 : 0));
  return { score, stepUpRequired: score >= 70, ip };
};
