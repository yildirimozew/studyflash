import { NextResponse } from "next/server";
import { syncOutlookMessages } from "@/lib/services/email";
import { revalidatePath } from "next/cache";

export async function POST() {
  const result = await syncOutlookMessages();

  revalidatePath("/");

  return NextResponse.json(result);
}
