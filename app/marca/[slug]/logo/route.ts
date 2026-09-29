import { slugValido } from "@/lib/consultoria/marca";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug: slugCrudo } = await context.params;
  const slug = slugValido(slugCrudo);
  const admin = createAdminClient();
  if (!(slug && admin)) {
    return new Response(null, { status: 404 });
  }

  const { data } = await admin
    .from("proyecto")
    .select("logo_path")
    .eq("slug", slug)
    .maybeSingle();

  if (!data?.logo_path) {
    return new Response(null, { status: 404 });
  }

  const archivo = await admin.storage.from("marcas").download(data.logo_path);
  if (archivo.error || !archivo.data) {
    return new Response(null, { status: 404 });
  }

  return new Response(await archivo.data.arrayBuffer(), {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Content-Type": archivo.data.type || "image/png",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
