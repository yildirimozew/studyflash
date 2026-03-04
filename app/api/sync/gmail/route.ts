import { NextResponse } from "next/server";
import { syncGmailMessages } from "@/lib/services/email";
import { revalidatePath } from "next/cache";

export async function POST() {
  const result = await syncGmailMessages();

  revalidatePath("/");

  return NextResponse.json(result);
}
