import { notImplemented } from "@/lib/api-response";
import { handleScheduleRead } from "@/lib/schedule-read";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleScheduleRead(request);
}

export const POST = notImplemented;
