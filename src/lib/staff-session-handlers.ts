import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { StaffSessionState, envelope, type StaffRoleDTO, type StaffSessionStateDTO } from "@/contracts";
import { prisma } from "@/lib/prisma";
import { DEMO_SESSION_COOKIE, isSameOrigin, revokeDemoSession } from "@/lib/demo-provider-session";
import { OWNER_SESSION_COOKIE, revokeOwnerSession } from "@/lib/owner-auth";
import { loginRetryAfter, readInput, recordFailure, secureOrigin } from "@/lib/owner-session-handlers";
import { PasswordCapacityError, verifyOwnerPassword } from "@/lib/owner-password";
import { expiredStaffCookie, issueStaffSession, readStaffSession, revokeStaffSession } from "@/lib/staff-session";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const failures = {
  FORBIDDEN: [403, "请从本站安全连接操作登录。"],
  VALIDATION_ERROR: [400, "账号或密码格式不正确。"],
  INVALID_CREDENTIALS: [401, "账号、密码或所选登录端不正确。"],
  RATE_LIMITED: [429, "登录尝试过于频繁，请稍后重试。"],
  SESSION_UNAVAILABLE: [503, "登录状态暂时无法确认，请稍后重试。"],
} as const;
class InvalidCredentials extends Error {}
function failure(code: keyof typeof failures, retryAfter?: number) {
  return Response.json({ ok: false, error: { code, message: failures[code][1] } }, {
    status: failures[code][0], headers: { ...headers, ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) },
  });
}
function success(data: StaffSessionStateDTO) {
  return Response.json(envelope(StaffSessionState).parse({ ok: true, data, meta: { source: "live" } }), { headers });
}

export function createStaffSessionHandlers(role: StaffRoleDTO, db: PrismaClient = prisma, clock = () => new Date()) {
  return {
    async GET(request: Request) {
      if (!secureOrigin(request)) return failure("FORBIDDEN");
      try {
        return success(await db.$transaction(tx => readStaffSession(request, tx, clock(), role), { isolationLevel: "Serializable" }));
      } catch { return failure("SESSION_UNAVAILABLE"); }
    },
    async POST(request: Request) {
      if (!secureOrigin(request) || !isSameOrigin(request)) return failure("FORBIDDEN");
      let input;
      try { input = await readInput(request); } catch { return failure("VALIDATION_ERROR"); }
      const key = `staff:${role}:${createHash("sha256").update(input.login).digest("hex")}`;
      try {
        const retryAfter = await loginRetryAfter(db, key, clock());
        if (retryAfter) return failure("RATE_LIMITED", retryAfter);
        const credential = await db.staffCredential.findUnique({ where: { login: input.login } });
        if (!await verifyOwnerPassword(input.password, credential?.passwordHash ?? null) || !credential) throw new InvalidCredentials();
        const result = await db.$transaction(async tx => {
          const retryAfter = await loginRetryAfter(tx, key, clock());
          if (retryAfter) return { retryAfter };
          const current = await tx.staffCredential.findUnique({ where: { login: input.login }, include: { user: { include: { provider: true } } } });
          if (!current || current.userId !== credential.userId || current.passwordHash !== credential.passwordHash
            || current.user.role !== role || (role === "provider" ? !current.user.provider || current.user.provider.id !== current.user.providerId : current.user.providerId !== null)) {
            throw new InvalidCredentials();
          }
          await revokeStaffSession(request, tx);
          await revokeOwnerSession(request, tx, clock());
          await revokeDemoSession(request, tx);
          const issued = await issueStaffSession({ userId: current.userId, role, providerId: current.user.providerId }, current.passwordHash, tx, clock());
          await tx.ownerLoginAttempt.deleteMany({ where: { key } });
          return issued;
        }, { isolationLevel: "Serializable" });
        if ("retryAfter" in result) return failure("RATE_LIMITED", result.retryAfter);
        const response = success(result.data);
        response.headers.set("Set-Cookie", result.cookie);
        response.headers.append("Set-Cookie", `${OWNER_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
        response.headers.append("Set-Cookie", `${DEMO_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
        return response;
      } catch (error) {
        if (error instanceof InvalidCredentials) {
          try {
            const retryAfter = await recordFailure(db, key, clock());
            return retryAfter ? failure("RATE_LIMITED", retryAfter) : failure("INVALID_CREDENTIALS");
          } catch { return failure("SESSION_UNAVAILABLE"); }
        }
        return error instanceof PasswordCapacityError ? failure("RATE_LIMITED", 1) : failure("SESSION_UNAVAILABLE");
      }
    },
    async DELETE(request: Request) {
      if (!secureOrigin(request) || !isSameOrigin(request)) return failure("FORBIDDEN");
      try {
        // Logging out either staff screen revokes the current staff session, not an arbitrary account.
        await db.$transaction(tx => revokeStaffSession(request, tx), { isolationLevel: "Serializable" });
        const response = success({ status: "signed_out" });
        response.headers.set("Set-Cookie", expiredStaffCookie);
        return response;
      } catch { return failure("SESSION_UNAVAILABLE"); }
    },
  };
}
