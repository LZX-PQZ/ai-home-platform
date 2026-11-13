import { z } from "zod";
export const Money = z.number().int().nonnegative().safe();
export const Id = z.string().min(1);
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
});
export const Provider = z.object({
  id: Id, name: z.string(), city: z.string(),
  kind: z.enum(["construction", "materials", "design", "supervision"]),
  tags: z.array(z.string()), rating: z.number().min(0).max(5),
});
export const Match = z.object({ provider: Provider, score: z.number().min(0).max(100), reasons: z.array(z.string()) });
export const QuoteItem = z.object({
  code: Id, name: z.string(), unit: z.enum(["m2", "piece", "job"]),
  quantity: z.number().nonnegative(), unitPriceCents: Money.nullable(), amountCents: Money.nullable(),
  note: z.string(),
});
export const Quote = z.object({
  id: Id, demandId: Id, providerId: Id, items: z.array(QuoteItem),
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
export const Payment = z.object({
  id: Id, demandId: Id, stage: z.string(), amountCents: Money,
  status: z.enum(["pending", "confirmed_demo"]), simulated: z.literal(true),
});
export const Ticket = z.object({
  id: Id, demandId: Id, description: z.string(),
  category: z.enum(["quality", "schedule", "payment", "attitude"]),
  responsibleProviderId: Id.nullable(), status: z.enum(["open", "assigned", "resolved"]),
});
export const ChatInput = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(30) });
export const ChatResult = z.object({ reply: z.string(), ready: z.boolean(), draft: DemandInput.nullable(), missingFields: z.array(z.string()) });
export const ReviewInput = z.object({ demandId: Id, providerId: Id, rating: z.number().int().min(1).max(5), comment: z.string().max(2000) });
export function envelope<T extends z.ZodTypeAny>(schema: T) {
  return z.object({ ok: z.literal(true), data: schema, meta: z.object({ source: z.enum(["mock", "live"]) }) });
}
export type DemandDTO = z.infer<typeof Demand>;
export type DemandInputDTO = z.infer<typeof DemandInput>;
export type DemandStatus = DemandDTO["status"];
export type ProviderDTO = z.infer<typeof Provider>;
export type QuoteDTO = z.infer<typeof Quote>;
export type QuoteSubmissionItemInputDTO = z.infer<typeof QuoteSubmissionItemInput>;
export type QuoteSubmissionInputDTO = z.infer<typeof QuoteSubmissionInput>;
export type ScheduleDTO = z.infer<typeof Schedule>;
export type ChatInputDTO = z.infer<typeof ChatInput>;
export type ChatResultDTO = z.infer<typeof ChatResult>;
export type ApiFailure = { ok: false; error: { code: string; message: string } };

// PUT replaces all editable fields; status transitions are a separate server concern.
export const DemandUpdateInput = DemandInput;
export const DemandIdParams = z.object({ id: Id.refine(value => value.trim().length > 0) }).strict();
export const DemandDeleteResult = z.object({ id: DemandIdParams.shape.id, deleted: z.literal(true) }).strict();
export type DemandUpdateInputDTO = z.infer<typeof DemandUpdateInput>;
export type DemandIdParamsDTO = z.infer<typeof DemandIdParams>;
export type DemandDeleteResultDTO = z.infer<typeof DemandDeleteResult>;
