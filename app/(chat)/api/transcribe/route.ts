import { NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/app/(auth)/auth";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY no configurada" },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("audio");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el audio" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const transcription = await openai.audio.transcriptions.create({
      file,
      language: "es",
      model: "whisper-1",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("whisper error", error);
    return NextResponse.json(
      { error: "No se pudo transcribir el audio" },
      { status: 500 }
    );
  }
}
