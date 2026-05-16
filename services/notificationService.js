import { Notification } from "../models/index.js";
import { enqueueJob } from "../utils/queue.js";

export const queueNotification = async ({ user, tenant = "default", channel = "email", template, payload = {} }) => {
  const notification = await Notification.create({ user, tenant, channel, template, payload });
  await enqueueJob("notification.send", { notificationId: notification._id });
  return notification;
};
