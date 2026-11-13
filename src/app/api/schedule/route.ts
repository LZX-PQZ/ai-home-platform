import { mockResponse, notImplemented } from "@/lib/api-response";
import { schedule } from "@/lib/mock-data";
export function GET() { return mockResponse(schedule); }
export const POST=notImplemented;
