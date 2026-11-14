import { z } from "zod";
export const Money = z.number().int().nonnegative().safe();
/** Prisma SQLite Int 的有符号 32 位范围；公共 Money 继续保留安全整数范围，写库前另行校验。 */
export const SQLITE_INT_MIN = -2_147_483_648;
export const SQLITE_INT_MAX = 2_147_483_647;
export const DatabaseInt = z.number().int().min(SQLITE_INT_MIN).max(SQLITE_INT_MAX);
export const DatabaseMoney = DatabaseInt.nonnegative();
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key" as const;
export const IdempotencyKey = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const Id = z.string().min(1);
export const Source = z.enum(["mock", "live"]);
export const DemandInput = z.object({
  description: z.string().trim().min(1).max(4000),
  city: z.string().trim().min(1), areaM2: z.number().finite().positive(),
  budgetMinCents: Money, budgetMaxCents: Money,
  renovationType: z.enum(["elderly", "partial", "repair"]),
  desiredDays: z.number().int().positive(),
}).strict().refine(v => v.budgetMinCents <= v.budgetMaxCents, { message: "预算下限不能大于上限" });
export const Demand = z.object({
  id: Id, description: z.string(), city: z.string(), areaM2: z.number().positive(),
  budgetMinCents: Money, budgetMaxCents: Money,
  renovationType: z.enum(["elderly", "partial", "repair"]),
  desiredDays: z.number().int().positive(),
  status: z.enum(["draft", "published", "contracted", "in_progress", "completed"]),
  source: Source.optional(),
});
export const Provider = z.object({
  id: Id, name: z.string(), city: z.string(),
  kind: z.enum(["construction", "materials", "design", "supervision"]),
  tags: z.array(z.string()), rating: z.number().min(0).max(5),
});
export const UserRole = z.enum(["owner", "provider", "admin"]);
/** 只表示已由服务端认证适配器验证过的会话，不表示客户端角色切换状态。 */
export const VerifiedSession = z.object({
  userId: Id,
  role: UserRole,
  providerId: Id.nullable(),
}).strict();
export const OwnerIdentity = VerifiedSession.extend({ role: z.literal("owner"), providerId: z.null() });
export type OwnerIdentityDTO = z.infer<typeof OwnerIdentity>;
export const OwnerLoginInput = z.object({
  login: z.string().trim().toLowerCase().min(3).max(64).regex(/^[a-z0-9._-]+$/),
  password: z.string().min(15).max(128),
}).strict();
/** 仅本地维护者开通命令使用，不能作为公开注册接口。 */
export const OwnerAccountProvisionInput = OwnerLoginInput.extend({ name: z.string().trim().min(1).max(80) });
export const OwnerSessionState = z.discriminatedUnion("status", [
  z.object({ status: z.literal("signed_out") }).strict(),
  z.object({ status: z.literal("signed_in"), identity: OwnerIdentity, expiresAt: z.string().datetime() }).strict(),
]);
export type OwnerLoginInputDTO = z.infer<typeof OwnerLoginInput>;
export type OwnerSessionStateDTO = z.infer<typeof OwnerSessionState>;
export type OwnerAccountProvisionInputDTO = z.infer<typeof OwnerAccountProvisionInput>;
export const ProviderIdentity = z.object({
  userId: Id,
  role: z.literal("provider"),
  providerId: Id,
}).strict();
export const DEMO_PROVIDER_USER_ID = "demo-provider-account" as const;
export const DEMO_PROVIDER_ID = "provider-a" as const;
export const DemoProviderLoginInput = z.object({ action: z.literal("login_demo") }).strict();
export const DemoProviderSession = z.discriminatedUnion("status", [
  z.object({ status: z.literal("disabled"), demo: z.literal(true) }).strict(),
  z.object({ status: z.literal("signed_out"), demo: z.literal(true) }).strict(),
  z.object({
    status: z.literal("signed_in"), demo: z.literal(true),
    identity: ProviderIdentity.extend({ userId: z.literal(DEMO_PROVIDER_USER_ID), providerId: z.literal(DEMO_PROVIDER_ID) }),
    expiresAt: z.string().datetime(),
  }).strict(),
]);
export type DemoProviderLoginInputDTO = z.infer<typeof DemoProviderLoginInput>;
export type DemoProviderSessionDTO = z.infer<typeof DemoProviderSession>;
export const Match = z.object({ provider: Provider, score: z.number().min(0).max(100), reasons: z.array(z.string()) });
export const QuoteItem = z.object({
  code: Id, name: z.string(), unit: z.enum(["m2", "piece", "job"]),
  quantity: z.number().nonnegative(), unitPriceCents: Money.nullable(), amountCents: Money.nullable(),
  note: z.string(),
});
export const Quote = z.object({
  id: Id, demandId: Id, providerId: Id, items: z.array(QuoteItem),
  // 旧 DTO 可缺省；数据库输出必须显式读取持久化来源，缺省不能解释为 live。
  source: Source.optional(),
  knownTotalCents: Money, pendingItems: z.array(z.string()), estimatedDays: z.number().int().positive(),
  status: z.enum(["draft", "submitted", "accepted", "rejected"]),
});
const QUOTE_SUBMISSION_MAX_ITEMS = 20;
const QUOTE_SUBMISSION_MAX_NAME_LENGTH = 100;
const QUOTE_SUBMISSION_MAX_NOTE_LENGTH = 1000;
const QUOTE_SUBMISSION_MAX_QUANTITY = 1_000_000;

function hasAtMostThreeDecimalPlaces(value: number) {
  const [coefficient, exponentText] = value.toString().toLowerCase().split("e");
  const exponent = exponentText ? Number(exponentText) : 0;
  const decimalDigits = coefficient.split(".")[1]?.length ?? 0;
  return Math.max(0, decimalDigits - exponent) <= 3;
}

export const QuoteSubmissionItemInput = z.object({
  code: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(QUOTE_SUBMISSION_MAX_NAME_LENGTH),
  unit: QuoteItem.shape.unit,
  quantity: z.number().finite().positive().safe()
    .max(QUOTE_SUBMISSION_MAX_QUANTITY)
    .refine(hasAtMostThreeDecimalPlaces, { message: "数量最多保留三位小数" }),
  unitPriceCents: Money.nullable(),
  note: z.string().trim().max(QUOTE_SUBMISSION_MAX_NOTE_LENGTH),
}).strict();

export const QuoteSubmissionInput = z.object({
  demandId: Id.refine(value => value.trim().length > 0),
  items: QuoteSubmissionItemInput.array().min(1).max(QUOTE_SUBMISSION_MAX_ITEMS),
  estimatedDays: z.number().int().positive().safe(),
}).strict().superRefine((value, context) => {
  const codes = new Set<string>();
  value.items.forEach((item, index) => {
    if (codes.has(item.code)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "code"],
        message: "报价明细 code 必须唯一",
      });
    }
    codes.add(item.code);
  });
});
export const ScheduleTask = z.object({
  id: Id, name: z.string(), startDay: z.number().int().nonnegative(),
  durationDays: z.number().int().positive(), dependsOn: z.array(Id),
  responsibleProviderId: Id.nullable(), status: z.enum(["pending", "active", "done", "blocked"]),
});
export const Schedule = z.object({ demandId: Id, version: z.number().int().positive(), tasks: z.array(ScheduleTask) });
export const ScheduleQuery = z.object({
  demandId: Id.refine(value => value.trim().length > 0),
  version: DatabaseInt.positive().optional(),
}).strict();
export const Payment = z.object({
  id: Id, demandId: Id, stage: z.string(), amountCents: Money,
  status: z.enum(["pending", "confirmed_demo"]), simulated: z.literal(true),
});
export const PaymentActionInput = z.object({
  paymentId: Id,
  action: z.literal("confirm_demo"),
}).strict();
export const Ticket = z.object({
  id: Id, demandId: Id, description: z.string(),
  category: z.enum(["quality", "schedule", "payment", "attitude"]),
  responsibleProviderId: Id.nullable(), status: z.enum(["open", "assigned", "resolved"]),
});
export const PHOTO_INSPECTION_DISCLAIMER = "照片只能辅助提示疑点，不能替代现场检测或证明施工合格。";
export const PhotoInspectionImageRef = z.string().trim().min(1).max(2048);
export const PhotoInspectionInput = z.object({
  demandId: Id.refine(value => value.trim().length > 0),
  imageRefs: PhotoInspectionImageRef.array().min(1).max(10),
}).strict().superRefine((value, context) => {
  const refs = new Set<string>();
  value.imageRefs.forEach((imageRef, index) => {
    if (refs.has(imageRef)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imageRefs", index],
        message: "图片引用不能重复",
      });
    }
    refs.add(imageRef);
  });
});
export const PhotoInspectionSeverity = z.enum(["low", "medium", "high"]);
export const PhotoInspectionFinding = z.object({
  imageRef: PhotoInspectionImageRef,
  severity: PhotoInspectionSeverity,
  message: z.string().trim().min(1).max(1000),
}).strict();
export const PhotoInspectionResult = z.object({
  demandId: Id,
  findings: PhotoInspectionFinding.array().max(50),
  reviewedAt: z.string().datetime({ offset: true }).optional(),
  disclaimer: z.literal(PHOTO_INSPECTION_DISCLAIMER),
}).strict();
export const ChatInput = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(30) });
export const ChatResult = z.object({ reply: z.string(), ready: z.boolean(), draft: DemandInput.nullable(), missingFields: z.array(z.string()) });
export const ReviewInput = z.object({ demandId: Id, providerId: Id, rating: z.number().int().min(1).max(5), comment: z.string().max(2000) });
export function envelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ ok: z.literal(true), data: schema, meta: z.object({ source: Source }) });
}
export type SourceDTO = z.infer<typeof Source>;
export type IdempotencyKeyDTO = z.infer<typeof IdempotencyKey>;
export type DemandDTO = z.infer<typeof Demand>;
export type DemandInputDTO = z.infer<typeof DemandInput>;
export type DemandStatus = DemandDTO["status"];
export type ProviderDTO = z.infer<typeof Provider>;
export type UserRoleDTO = z.infer<typeof UserRole>;
export type VerifiedSessionDTO = z.infer<typeof VerifiedSession>;
export type ProviderIdentityDTO = z.infer<typeof ProviderIdentity>;
export type QuoteDTO = z.infer<typeof Quote>;
export type QuoteSubmissionItemInputDTO = z.infer<typeof QuoteSubmissionItemInput>;
export type QuoteSubmissionInputDTO = z.infer<typeof QuoteSubmissionInput>;
export type ScheduleDTO = z.infer<typeof Schedule>;
export type ScheduleQueryDTO = z.infer<typeof ScheduleQuery>;
export type PaymentDTO = z.infer<typeof Payment>;
export type PaymentActionInputDTO = z.infer<typeof PaymentActionInput>;
export type PhotoInspectionInputDTO = z.infer<typeof PhotoInspectionInput>;
export type PhotoInspectionFindingDTO = z.infer<typeof PhotoInspectionFinding>;
export type PhotoInspectionResultDTO = z.infer<typeof PhotoInspectionResult>;
export type ChatInputDTO = z.infer<typeof ChatInput>;
export type ChatResultDTO = z.infer<typeof ChatResult>;
export type ApiFailure = { ok: false; error: { code: string; message: string } };

// PUT replaces all editable fields; status transitions are a separate server concern.
export const DemandUpdateInput = DemandInput;
export const DemandIdParams = z.object({ id: Id.refine(value => value.trim().length > 0) }).strict();
export const QuoteQuery = z.object({ demandId: DemandIdParams.shape.id }).strict();
export type QuoteQueryDTO = z.infer<typeof QuoteQuery>;
export const DemandDeleteResult = z.object({ id: DemandIdParams.shape.id, deleted: z.literal(true) }).strict();
export type DemandUpdateInputDTO = z.infer<typeof DemandUpdateInput>;
export type DemandIdParamsDTO = z.infer<typeof DemandIdParams>;
export type DemandDeleteResultDTO = z.infer<typeof DemandDeleteResult>;
