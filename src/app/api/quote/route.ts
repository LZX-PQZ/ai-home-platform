import { mockResponse, notImplemented } from "@/lib/api-response";
import { quotes } from "@/lib/mock-data";
export function GET() { return mockResponse(quotes); }
export const POST = notImplemented;
