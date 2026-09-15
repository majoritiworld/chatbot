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

export const postRequestBodySchema = z
  .object({
    entrevistaId: z.guid().optional(),
    // guid, not uuid: database ids are not guaranteed to be RFC-4122 versioned.
    id: z.guid(),
    message: userMessageSchema.optional(),
    messages: z.array(z.any()).optional(),
    seccionId: z.guid().optional(),
    selectedChatModel: z.string(),
    selectedVisibilityType: z.enum(["public", "private"]),
  })
  .superRefine((value, ctx) => {
    if (value.entrevistaId && !value.seccionId) {
      ctx.addIssue({
        code: "custom",
        message: "seccionId es obligatorio en una entrevista",
        path: ["seccionId"],
      });
    }
  });

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
