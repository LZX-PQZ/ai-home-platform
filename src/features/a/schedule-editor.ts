import {
  ApiClientError,
  apiPost,
  apiPut,
} from "@/lib/api-client";
import {
  Schedule,
  ScheduleCreateInput,
  ScheduleRevisionInput,
  type ScheduleCreateInputDTO,
  type ScheduleDTO,
  type ScheduleRevisionInputDTO,
} from "@/contracts";

export type ScheduleEditorRow = {
  id: string;
  name: string;
  startDay: string;
  durationDays: string;
  dependsOn: string;
};

export type ScheduleEditorParseResult<T> =
  | { ok: true; input: T }
  | { ok: false; error: string };

function dependencies(value: string): string[] {
  return value.split(",").map(item => item.trim()).filter(Boolean);
}

function numeric(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function parseError(): string {
  return "请检查工序编号、名称、开始天数、工期和前置工序；工序编号必须唯一，开始天数不能为负数。";
}

export function rowsFromSchedule(schedule: ScheduleDTO): ScheduleEditorRow[] {
  return schedule.tasks.map(task => ({
    id: task.id,
    name: task.name,
    startDay: String(task.startDay),
    durationDays: String(task.durationDays),
    dependsOn: task.dependsOn.join(", "),
  }));
}

export function canReviseSchedule(schedule: ScheduleDTO): boolean {
  return schedule.tasks.length > 0 && schedule.tasks.every(
    task => task.status === "pending" && task.responsibleProviderId === null,
  );
}

export function parseScheduleCreateRows(
  demandId: string,
  rows: readonly ScheduleEditorRow[],
): ScheduleEditorParseResult<ScheduleCreateInputDTO> {
  const parsed = ScheduleCreateInput.safeParse({
    demandId: demandId.trim(),
    tasks: rows.map(row => ({
      id: row.id.trim(),
      name: row.name.trim(),
      startDay: numeric(row.startDay),
      durationDays: numeric(row.durationDays),
      dependsOn: dependencies(row.dependsOn),
    })),
  });
  return parsed.success ? { ok: true, input: parsed.data } : { ok: false, error: parseError() };
}

export function parseScheduleRevisionRows(
  demandId: string,
  baseVersion: number,
  rows: readonly ScheduleEditorRow[],
): ScheduleEditorParseResult<ScheduleRevisionInputDTO> {
  const parsed = ScheduleRevisionInput.safeParse({
    demandId: demandId.trim(),
    baseVersion,
    confirmed: true,
    tasks: rows.map(row => ({
      id: row.id.trim(),
      name: row.name.trim(),
      startDay: numeric(row.startDay),
      durationDays: numeric(row.durationDays),
      dependsOn: dependencies(row.dependsOn),
    })),
  });
  return parsed.success ? { ok: true, input: parsed.data } : { ok: false, error: parseError() };
}

export async function createSchedule(input: ScheduleCreateInputDTO) {
  return apiPost("/api/schedule", input, Schedule);
}

export async function reviseSchedule(input: ScheduleRevisionInputDTO) {
  return apiPut("/api/schedule", input, Schedule);
}

export function scheduleMutationError(error: unknown): string {
  if (!(error instanceof ApiClientError)) return "排期请求失败，请检查网络后重试。";
  if (error.status === 401) return "请先完成业主登录，再保存排期。";
  if (error.status === 403) return "当前登录身份没有保存这条需求排期的权限。";
  if (error.status === 409) return `${error.message} 请重新读取最新排期后再试。`;
  if (error.status === 501) return "排期写入接口尚未开放（HTTP 501），没有保存成功。";
  if (error.status >= 500 || error.code === "NETWORK_ERROR") return "暂时无法确认排期是否保存，请重新读取后再决定是否重试。";
  return error.message;
}
