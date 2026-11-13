import { mockResponse, notImplemented } from "@/lib/api-response";
import { demoDemand } from "@/lib/mock-data";
export function GET() { return mockResponse([demoDemand]); }
export const POST = notImplemented;
