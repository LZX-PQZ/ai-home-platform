import { mockResponse, notImplemented } from "@/lib/api-response";
import { tickets } from "@/lib/mock-data";
export function GET() { return mockResponse(tickets); }
export const POST=notImplemented;
