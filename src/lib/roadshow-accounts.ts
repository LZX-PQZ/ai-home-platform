import type { PrismaClient } from "@prisma/client";
import { DEMO_PROVIDER_ID, DEMO_PROVIDER_USER_ID, OwnerLoginInput } from "@/contracts";
import { hashOwnerPassword } from "@/lib/owner-password";

/** Explicit local provisioning, never invoked by seed, an HTTP request or application startup. */
export async function provisionRoadshowAccounts(db: PrismaClient, passwords: { owner: string; provider: string; admin: string }) {
  const hashes = {} as Record<keyof typeof passwords, string>;
  for (const role of ["owner", "provider", "admin"] as const) {
    OwnerLoginInput.shape.password.parse(passwords[role]);
    hashes[role] = await hashOwnerPassword(passwords[role]);
  }
  return db.$transaction(async tx => {
    const existingProvider = await tx.user.findUnique({ where: { id: DEMO_PROVIDER_USER_ID }, include: { provider: true } });
    if (!existingProvider || existingProvider.role !== "provider" || existingProvider.providerId !== DEMO_PROVIDER_ID
      || existingProvider.provider?.id !== DEMO_PROVIDER_ID) throw new Error("Prepare the seeded provider first");
    const owner = await tx.user.create({ data: { name: "路演业主", role: "owner" } });
    const admin = await tx.user.create({ data: { name: "路演运营", role: "admin" } });
    await tx.ownerCredential.create({ data: { userId: owner.id, login: "roadshow.owner", passwordHash: hashes.owner } });
    await tx.staffCredential.create({ data: { userId: existingProvider.id, login: "roadshow.provider", passwordHash: hashes.provider } });
    await tx.staffCredential.create({ data: { userId: admin.id, login: "roadshow.admin", passwordHash: hashes.admin } });
    return { ownerId: owner.id, providerId: existingProvider.id, adminId: admin.id };
  }, { isolationLevel: "Serializable" });
}
