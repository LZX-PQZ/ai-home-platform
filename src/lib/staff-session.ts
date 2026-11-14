import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { StaffIdentity, StaffSessionState, type StaffRoleDTO } from "@/contracts";

export const STAFF_SESSION_COOKIE = "__Host-ai_home_staff_session";
export const STAFF_SESSION_TTL_SECONDS = 30 * 60;
type Database = Pick<Prisma.TransactionClient, "staffSession">;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function staffCredential(request: Request) {
  const values = (request.headers.get("cookie") ?? "").split(";").map(v => v.trim())
    .filter(v => v.startsWith(`${STAFF_SESSION_COOKIE}=`));
  const token = values.length === 1 ? values[0].slice(STAFF_SESSION_COOKIE.length + 1) : "";
  return { present: values.length > 0, hash: /^[a-f0-9]{64}$/.test(token) ? hash(token) : null };
}

export async function readStaffSession(request: Request, db: Database, now = new Date(), role?: StaffRoleDTO) {
  const credential = staffCredential(request);
  if (!credential.hash) return StaffSessionState.parse({ status: "signed_out" });
  const row = await db.staffSession.findUnique({ where: { tokenHash: credential.hash },
    include: { user: { include: { staffCredential: true, provider: true } } } });
  if (!row || row.expiresAt <= now || (role && row.role !== role) || row.user.role !== row.role
    || row.user.providerId !== row.providerId || !row.user.staffCredential
    || hash(row.user.staffCredential.passwordHash) !== row.credentialHash
    || (row.role === "provider" && row.user.provider?.id !== row.providerId)) {
    return StaffSessionState.parse({ status: "signed_out" });
  }
  const identity = StaffIdentity.safeParse({ userId: row.userId, role: row.role, providerId: row.providerId });
  if (!identity.success) return StaffSessionState.parse({ status: "signed_out" });
  return StaffSessionState.parse({ status: "signed_in", identity: identity.data, expiresAt: row.expiresAt.toISOString() });
}

/** Called only inside the password handler's transaction after credential/account revalidation. */
export async function issueStaffSession(identity: { userId: string; role: StaffRoleDTO; providerId: string | null }, passwordHash: string,
  db: Database, now = new Date()) {
  const verified = StaffIdentity.parse(identity);
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + STAFF_SESSION_TTL_SECONDS * 1000);
  await db.staffSession.deleteMany({ where: { expiresAt: { lte: now } } });
  await db.staffSession.create({ data: { tokenHash: hash(token), ...verified, credentialHash: hash(passwordHash), expiresAt } });
  return { data: StaffSessionState.parse({ status: "signed_in", identity: verified, expiresAt: expiresAt.toISOString() }),
    cookie: `${STAFF_SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${STAFF_SESSION_TTL_SECONDS}` };
}

export async function revokeStaffSession(request: Request, db: Database) {
  const credential = staffCredential(request);
  if (credential.hash) await db.staffSession.deleteMany({ where: { tokenHash: credential.hash } });
}
export const expiredStaffCookie = `${STAFF_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
