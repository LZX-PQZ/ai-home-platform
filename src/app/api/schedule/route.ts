import { handleScheduleCreate } from "@/lib/schedule-create";
import { handleScheduleRead } from "@/lib/schedule-read";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleScheduleRead(request);
}

export function POST(request: Request) {
  return handleScheduleCreate(request);
}
