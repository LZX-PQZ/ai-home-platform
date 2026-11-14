import { handleOrderAccept } from "@/lib/order";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return handleOrderAccept(request);
}
