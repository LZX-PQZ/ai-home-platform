import { mockResponse } from "@/lib/api-response";
import { demoDemand, providers } from "@/lib/mock-data";
import { matchProviders } from "@/lib/match";
export function GET() { return mockResponse(matchProviders(demoDemand,providers)); }
