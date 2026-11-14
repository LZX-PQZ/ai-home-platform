import { createStaffSessionHandlers } from "@/lib/staff-session-handlers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const { GET, POST, DELETE } = createStaffSessionHandlers("provider");
