import { mockResponse, notImplemented } from "@/lib/api-response";
import { payments } from "@/lib/mock-data";
export function GET() { return mockResponse(payments); }
export const POST=notImplemented;
