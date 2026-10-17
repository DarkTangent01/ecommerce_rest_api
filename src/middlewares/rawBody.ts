import type { IncomingMessage, ServerResponse } from "http";
import type { Request } from "express";

export const rawJsonBody = (req: IncomingMessage, _res: ServerResponse, buf: Buffer) => {
  if (buf && buf.length) {
    (req as Request).rawBody = buf.toString("utf8");
  }
};
