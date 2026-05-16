import fs from "fs";
import path from "path";
import crypto from "crypto";
import { AuditLog } from "../models/index.js";

const auditLogger = (action, req, metadata = {}) => {
  const logsDirectory = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDirectory)) {
    fs.mkdirSync(logsDirectory, { recursive: true });
  }

  const entry = {
    at: new Date().toISOString(),
    action,
    requestId: req.requestId || null,
    actor: req.user?._id || null,
    role: req.user?.role || null,
    ip: req.ip,
    userAgent: req.get?.("user-agent") || null,
    method: req.method,
    path: req.originalUrl,
    metadata,
  };

  fs.appendFile(path.join(logsDirectory, "audit.log"), `${JSON.stringify(entry)}\n`, (err) => {
    if (err) {
      console.error("Audit log write failed", err);
    }
  });

  writeTamperProofAudit(action, req, metadata).catch((err) => {
    console.error("Tamper-proof audit write failed", err);
  });
};

export const writeTamperProofAudit = async (action, req, metadata = {}) => {
  const last = await AuditLog.findOne().sort("-sequence");
  const sequence = (last?.sequence || 0) + 1;
  const previousHash = last?.hash || "GENESIS";
  const body = {
    sequence,
    action,
    actor: req.user?._id || null,
    tenant: req.tenant || req.user?.tenant || "default",
    requestId: req.requestId || null,
    ip: req.ip || null,
    metadata,
    previousHash,
  };
  const hash = crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
  return AuditLog.create({ ...body, hash });
};

export default auditLogger;
