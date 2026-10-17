import type { Types } from "mongoose";
import { Notification } from "../models/index.js";
import { enqueueJob } from "../utils/queue.js";
import type { NotificationRecord } from "../models/notification.js";

export const queueNotification = async ({
  user,
  tenant = "default",
  channel = "email",
  template,
  payload = {},
}: {
  user?: Types.ObjectId;
  tenant?: string;
  channel?: NotificationRecord["channel"];
  template: string;
  payload?: Record<string, unknown>;
}) => {
  const notification = await Notification.create({ user, tenant, channel, template, payload });
  await enqueueJob("notification.send", { notificationId: notification._id });
  return notification;
};
