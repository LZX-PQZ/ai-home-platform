import { handleOrderProgress } from "@/lib/order-progress";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return handleOrderProgress(request);
}
