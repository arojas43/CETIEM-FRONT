import { prisma } from "@/lib/db";

type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
};

/** Create one or more in-app notifications. Fire-and-forget (never throws). */
export async function notify(input: NotifyInput | NotifyInput[]) {
  try {
    const items = Array.isArray(input) ? input : [input];
    await prisma.notification.createMany({ data: items });
  } catch (err) {
    console.error("[notify] failed to create notification(s):", err);
  }
}
