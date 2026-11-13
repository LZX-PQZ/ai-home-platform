export type PhotoInspectionPhase = "idle" | "selected" | "unavailable";

export const PHOTO_INSPECTION_HINTS = [
  "照片是否被遮挡或反光影响判断",
  "关键细节是否清晰可见",
  "是否需要补拍更近或不同角度的照片",
] as const;

export function photoInspectionStatus(phase: PhotoInspectionPhase, count: number): string {
  if (phase === "unavailable") {
    return "照片检查接口尚未开放（501），当前不会生成分析结论。";
  }
  if (phase === "selected") {
    return `已选择 ${count} 张照片，提交后等待接口返回。`;
  }
  return "尚未选择照片，来源未确认。";
}
