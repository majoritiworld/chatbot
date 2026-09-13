import { z } from "zod";

const textPartSchema = z.object({
  text: z.string().min(1).max(8000),
  type: z.enum(["text"]),
});

const filePartSchema = z.object({
  mediaType: z.enum(["image/jpeg", "image/png"]),
  name: z.string().min(1).max(100),
  type: z.enum(["file"]),
  url: z.url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const userMessageSchema = z.object({
  id: z.guid(),
  parts: z.array(partSchema),
  role: z.enum(["user"]),
});

const toolApprovalMessageSchema = z.object({
  id: z.string(),
  parts: z.array(z.record(z.string(), z.unknown())).optional(),
  role: z.enum(["user", "assistant", "system"]),
});

export const postRequestBodySchema = z.object({
  // guid, not uuid: database ids are not guaranteed to be RFC-4122 versioned.
  id: z.guid(),
  entrevistaId: z.guid().optional(),
  message: userMessageSchema.optional(),
  messages: z.array(z.any()).optional(),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(["public", "private"]),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
