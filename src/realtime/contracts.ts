import { z } from "zod";

export const realtimeChannel = "worksphere:realtime:v1";

export const roomTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("organization"), id: z.uuid() }).strict(),
  z.object({ kind: z.literal("project"), id: z.uuid() }).strict(),
]);

export type RoomTarget = z.infer<typeof roomTargetSchema>;

const changeAction = z.enum(["created", "updated", "deleted", "moved"]);

export const realtimeEventSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("task.changed"),
    target: z.object({ projectId: z.uuid() }).strict(),
    payload: z
      .object({ projectId: z.uuid(), taskId: z.uuid(), action: changeAction })
      .strict(),
  }),
  z.object({
    name: z.literal("comment.changed"),
    target: z.object({ projectId: z.uuid() }).strict(),
    payload: z
      .object({
        projectId: z.uuid(),
        taskId: z.uuid(),
        commentId: z.uuid(),
        action: z.enum(["created", "updated", "deleted"]),
      })
      .strict(),
  }),
  z.object({
    name: z.literal("notification.changed"),
    target: z.object({ userId: z.uuid() }).strict(),
    payload: z
      .object({ notificationId: z.uuid(), action: z.literal("created") })
      .strict(),
  }),
]);

export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
export type RealtimeEventName = RealtimeEvent["name"];

export const roomName = {
  organization: (id: string) => `organization:${id}`,
  project: (id: string) => `project:${id}`,
  user: (id: string) => `user:${id}`,
};
