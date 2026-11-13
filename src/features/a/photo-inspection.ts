import { z } from "zod";
import { apiPost } from "@/lib/api-client";
import type { SourceDTO } from "@/contracts";

export type PhotoInspectionPhase = "idle" | "selected" | "submitting" | "ready" | "unavailable" | "failed";

export type PhotoInspectionResponse = {
  data: unknown;
  source: SourceDTO;
};

export const PHOTO_INSPECTION_HINTS = [
  "照片是否被遮挡或反光影响判断",
  "关键细节是否清晰可见",
  "是否需要补拍更近或不同角度的照片",
] as const;

export function photoInspectionStatus(phase: PhotoInspectionPhase, count: number): string {
  if (phase === "submitting") {
    return "正在提交照片，等待接口返回…";
  }
  if (phase === "ready") {
    return "接口已返回辅助检查结果，请结合现场情况人工复核。";
  }
  if (phase === "unavailable") {
    return "照片检查接口尚未开放（501），当前不会生成分析结论。";
  }
  if (phase === "failed") {
    return "照片检查未完成，请检查错误信息后重试。";
  }
  if (phase === "selected") {
    return `已选择 ${count} 张照片，提交后等待接口返回。`;
  }
  return "尚未选择照片，来源未确认。";
}

export function inspectionSourceLabel(source: SourceDTO): string {
  return source === "mock" ? "mock（模拟数据）" : "live";
}

export function formatInspectionResult(data: unknown): string {
  if (typeof data === "string") return data;
  if (data === undefined) return "接口返回了空结果。";
  try {
    return JSON.stringify(data, null, 2) ?? "接口返回了空结果。";
  } catch {
    return "接口返回了无法展示的结果。";
  }
}

/** 通过 D 提供的共享客户端调用预留接口；响应字段待 D 冻结前保持原样。 */
export function submitPhotoInspection(demandId: string, imageRefs: string[]): Promise<PhotoInspectionResponse> {
  return apiPost("/api/inspect", { demandId, imageRefs }, z.unknown());
}
