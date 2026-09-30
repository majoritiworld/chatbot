"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/auth";
import { borrarSesionEntrevista } from "@/lib/consultoria/acceso-entrevista";

export async function signOutAction() {
  await signOut();
  await borrarSesionEntrevista();
  redirect("/login");
}
