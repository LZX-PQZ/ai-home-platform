import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { InspectionUploadResult, envelope } from "../src/contracts";
import { createOwnerAccount } from "../src/lib/owner-account";

/** Synthetic accounts/photos in the explicitly configured local smoke database. No intercepted HTTP. */
export async function smokeInspectionImages(base: string) {
  assert.ok(process.env.DATABASE_URL?.trim(), "Set DATABASE_URL to a seeded test database");
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Smoke fixtures require a loopback test server");
  const db = new PrismaClient();
  const owners: string[] = [];
  const password = randomBytes(24).toString("hex");
  const prefix = `image-smoke-${randomBytes(6).toString("hex")}`;
  const http = async (path: string, method = "GET", cookie = "", body?: unknown) => {
    const response = await fetch(base + path, { method, headers: { Origin: new URL(base).origin, Cookie: cookie,
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }) });
    const payload = await response.json();
    return { response, payload };
  };
  try {
    for (const suffix of ["one", "two"]) {
      owners.push((await createOwnerAccount({ login: `${prefix}-${suffix}`, name: "Synthetic photo smoke", password }, db)).userId);
    }
    const login = async (suffix: string) => {
      const result = await http("/api/auth/owner", "POST", "", { login: `${prefix}-${suffix}`, password });
      assert.equal(result.response.status, 200); return result.response.headers.get("set-cookie")!.split(";")[0];
    };
    const cookie = await login("one"); const otherCookie = await login("two");
    const create = async (credential: string) => {
      const result = await http("/api/demand", "POST", credential, { description: "Synthetic photo smoke demand", city: "Test", areaM2: 20,
        budgetMinCents: 0, budgetMaxCents: 10000, renovationType: "repair", desiredDays: 10 });
      assert.equal(result.response.status, 201); return result.payload.data.id as string;
    };
    const demandId = await create(cookie); const otherDemandId = await create(otherCookie); const altDemandId = await create(cookie);
    const jpeg = await sharp({ create: { width: 12, height: 24, channels: 3, background: "#304080" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const form = (id = demandId) => {
      const value = new FormData(); value.set("demandId", id);
      value.append("images", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "synthetic-private-filename.jpg"); return value;
    };
    const stored = await http("/api/inspect/images", "POST", cookie, form()); assert.equal(stored.response.status, 201);
    assert.equal(stored.response.headers.get("cache-control"), "private, no-store"); assert.match(stored.response.headers.get("vary") ?? "", /Cookie/i);
    const result = envelope(InspectionUploadResult).parse(stored.payload);
    assert.equal(result.meta.source, "live"); assert.equal(result.data.demandId, demandId);
    assert.equal(result.data.images[0].width, 24); assert.equal(result.data.images[0].height, 12);
    assert.doesNotMatch(JSON.stringify(result), /synthetic-private-filename|ownerId|bytes/);
    const imageRef = result.data.images[0].imageRef;
    const persisted = await db.inspectionImage.findUniqueOrThrow({ where: { id: imageRef } });
    assert.equal(persisted.ownerId, owners[0]); assert.equal(persisted.demandId, demandId);
    const metadata = await sharp(persisted.bytes).metadata(); assert.equal(metadata.exif, undefined); assert.equal(metadata.orientation, undefined);
    const inspection = await http("/api/inspect", "POST", cookie, { demandId, imageRefs: [imageRef] });
    assert.equal(inspection.response.status, 501); assert.equal(inspection.payload.error.code, "NOT_IMPLEMENTED");
    assert.equal("data" in inspection.payload, false); assert.equal("meta" in inspection.payload, false);
    for (const [target, credential, ref, code] of [[demandId, otherCookie, imageRef, "DEMAND_NOT_FOUND"],
      [otherDemandId, otherCookie, imageRef, "IMAGE_NOT_FOUND"], [altDemandId, cookie, imageRef, "IMAGE_NOT_FOUND"],
      [demandId, cookie, "filename.jpg", "IMAGE_NOT_FOUND"]]) {
      const denied = await http("/api/inspect", "POST", credential, { demandId: target, imageRefs: [ref] });
      assert.equal(denied.response.status, 404); assert.equal(denied.payload.error.code, code);
    }
    assert.equal((await http("/api/inspect/images", "POST", otherCookie, form())).response.status, 404);
    const duplicate = form(); duplicate.append("images", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "same.jpg");
    assert.equal((await http("/api/inspect/images", "POST", cookie, duplicate)).response.status, 400);
    assert.equal(await db.inspectionImage.count({ where: { demandId } }), 1);
    const otherRefs: string[] = [];
    for (let i = 0; i < 2; i++) {
      const uploaded = await http("/api/inspect/images", "POST", otherCookie, form(otherDemandId));
      assert.equal(uploaded.response.status, 201);
      otherRefs.push(envelope(InspectionUploadResult).parse(uploaded.payload).data.images[0].imageRef);
    }
    const retained = await db.inspectionImage.findUniqueOrThrow({ where: { id: otherRefs[1] } });
    await db.inspectionImage.update({ where: { id: otherRefs[0] }, data: { expiresAt: new Date(0) } });
    await db.inspectionImage.update({ where: { id: imageRef }, data: { expiresAt: new Date(0) } });
    const expired = await http("/api/inspect", "POST", cookie, { demandId, imageRefs: [imageRef] });
    assert.equal(expired.response.status, 404); assert.equal(expired.payload.error.code, "IMAGE_NOT_FOUND");
    assert.equal((await http("/api/inspect/images", "POST", cookie, form())).response.status, 201);
    assert.equal(await db.inspectionImage.count({ where: { id: imageRef } }), 0);
    assert.equal(await db.inspectionImage.count({ where: { id: otherRefs[0] } }), 0);
    assert.deepEqual(await db.inspectionImage.findUniqueOrThrow({ where: { id: otherRefs[1] } }), retained);
    const activeOther = await http("/api/inspect", "POST", otherCookie, { demandId: otherDemandId, imageRefs: [otherRefs[1]] });
    assert.equal(activeOther.response.status, 501); assert.equal(activeOther.payload.error.code, "NOT_IMPLEMENTED");
    const removedOther = await http("/api/inspect", "POST", otherCookie, { demandId: otherDemandId, imageRefs: [otherRefs[0]] });
    assert.equal(removedOther.response.status, 404); assert.equal(removedOther.payload.error.code, "IMAGE_NOT_FOUND");
    assert.equal((await http("/api/auth/owner", "DELETE", cookie)).response.status, 200);
    assert.equal((await http("/api/inspect/images", "POST", cookie, form())).response.status, 401);
    assert.equal((await http("/api/inspect", "POST", cookie, { demandId, imageRefs: [imageRef] })).response.status, 401);
    assert.equal((await http("/api/auth/owner", "DELETE", otherCookie)).response.status, 200);
    console.log("照片生产 HTTP 链路通过：真实登录/上传/去元数据/live、有效引用 501、跨归属与过期拒绝、跨业主过期清理且保留有效照片、重复批次回滚、注销后拒绝。");
  } finally {
    try {
      if (owners.length) {
        await db.demandOrder.deleteMany({ where: { ownerId: { in: owners } } });
        await db.user.deleteMany({ where: { id: { in: owners } } });
      }
    } finally { await db.$disconnect(); }
  }
}
