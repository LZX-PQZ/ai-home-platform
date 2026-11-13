import type { Prisma, PrismaClient } from "@prisma/client";
import { ProviderIdentity, Quote, type ProviderIdentityDTO, type QuoteDTO } from "@/contracts";
import { findDemand } from "@/lib/demand";
import { prisma } from "@/lib/prisma";
import { requireProviderIdentity, type VerifiedSessionReader } from "@/lib/server-auth";
import { calculateQuoteSubmission } from "@/lib/quote-engine/submission";

/** 服务端适配器必须重新验证会话，并通过本次 tx 核验账户绑定；不能返回预检缓存。 */
export type QuoteTransactionSessionReader = (request: Request, tx: Prisma.TransactionClient) => ReturnType<VerifiedSessionReader>;

export class QuoteWriteRejected extends Error {
  constructor(public readonly status: 401 | 403 | 404 | 409, public readonly code: string, message: string) {
    super(message);
    this.name = "QuoteWriteRejected";
  }
}

/**
 * 尚未接入公开 POST：这是单次原子写入内核，不提供幂等或细粒度需求授权。
 * 路由接通前必须补齐 D 的真实事务会话适配器、授权及持久化幂等协议。
 * 不接收预检的需求快照；抛错让事务回滚，提交完成后才向调用方返回 DTO。
 */
export async function createQuoteAtomically(
  request: Request,
  input: unknown,
  expectedIdentity: ProviderIdentityDTO,
  readSession: QuoteTransactionSessionReader,
  db: Pick<PrismaClient, "$transaction"> = prisma,
): Promise<QuoteDTO> {
  // 在第一个 await 前校验并复制输入，防止调用方在事务等待期间改变报价或身份。
  const submission = calculateQuoteSubmission(input);
  const expected = ProviderIdentity.parse(expectedIdentity);

  return db.$transaction(async (tx) => {
    const current = await requireProviderIdentity(request, (req) => readSession(req, tx));
    if (!current.ok) throw new QuoteWriteRejected(current.status, current.error.code, current.error.message);
    if (current.identity.userId !== expected.userId || current.identity.providerId !== expected.providerId) {
      throw new QuoteWriteRejected(403, "FORBIDDEN", "服务方身份已变化，请重新验证后提交。");
    }

    // 账户角色和服务方存在性也从事务读取；账户与服务方的绑定仍须由 D 的适配器验证。
    const user = await tx.user.findUnique({ where: { id: current.identity.userId } });
    const provider = await tx.serviceProvider.findUnique({ where: { id: current.identity.providerId } });
    if (!user || user.role !== "provider" || !provider) {
      throw new QuoteWriteRejected(403, "FORBIDDEN", "当前账户或服务方已不可用于报价。");
    }

    const demand = await findDemand(submission.demandId, tx);
    if (!demand) throw new QuoteWriteRejected(404, "DEMAND_NOT_FOUND", "这份需求不存在。");
    if (demand.data.id !== submission.demandId) throw new Error("需求查询返回了其他 ID。");
    if (demand.source !== "live" || demand.data.source !== "live") {
      throw new QuoteWriteRejected(409, "DEMO_DEMAND_READ_ONLY", "模拟需求不能接收真实报价。");
    }
    if (demand.data.status !== "published") {
      throw new QuoteWriteRejected(409, "INVALID_STATE", "只有已发布且未签约的需求可以提交报价。");
    }

    const row = await tx.quote.create({ data: {
      demandId: submission.demandId,
      providerId: current.identity.providerId,
      itemsJson: JSON.stringify(submission.items),
      knownTotalCents: submission.knownTotalCents,
      pendingItemsJson: JSON.stringify(submission.pendingItems),
      estimatedDays: submission.estimatedDays,
      status: "submitted",
    } });
    // 输出校验属于事务的一部分：无效回执也必须导致回滚。
    return Quote.parse({
      id: row.id, demandId: row.demandId, providerId: row.providerId,
      items: JSON.parse(row.itemsJson), knownTotalCents: row.knownTotalCents,
      pendingItems: JSON.parse(row.pendingItemsJson), estimatedDays: row.estimatedDays, status: row.status,
    });
  }, { isolationLevel: "Serializable" });
}
