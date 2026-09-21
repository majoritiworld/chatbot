"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/auth";

export async function signOutAction() {
  await signOut();
  redirect("/login");
}
