import { mockResponse } from "@/lib/api-response";
import { providers } from "@/lib/mock-data";
export function GET() { return mockResponse(providers); }
