"use client";

import { useState, type ChangeEvent } from "react";
import { Button, C, Card, Note, SectionHead } from "./ui";
import { PHOTO_INSPECTION_HINTS, photoInspectionStatus, type PhotoInspectionPhase } from "./photo-inspection";

/**
 * 施工照片辅助检查入口。
 * /api/inspect 由 D 负责，接口未开放前只收集照片并给出人工复核提示，不伪造 AI 结论。
 */
export function PhotoInspectionPanel({ demandId }: { demandId: string }) {
  const [files, setFiles] = useState<string[]>([]);
  const [phase, setPhase] = useState<PhotoInspectionPhase>("idle");

  const onSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const names = Array.from(event.target.files ?? []).map((file) => file.name);
    setFiles(names);
    setPhase(names.length > 0 ? "selected" : "idle");
  };

  const submit = () => {
    if (files.length > 0) setPhase("unavailable");
  };

  return (
    <Card className="mt-4">
      <SectionHead title="照片辅助检查" aside={<span className={C.meta}>来源：未确认</span>} />
      <p className={`mb-3 ${C.meta}`}>
        选择施工现场照片后可提交辅助检查。照片只能提示疑点，不能替代现场检测或证明施工合格。
      </p>

      <label className="grid gap-1.5 text-[13px] font-medium text-[#16242B]" htmlFor="photo-inspection-files">
        现场照片
        <input
          id="photo-inspection-files"
          type="file"
          accept="image/*"
          multiple
          onChange={onSelect}
          className="block w-full rounded-[10px] border border-[#D7E2E4] bg-white px-3 py-2 text-[13px] file:mr-3 file:rounded-md file:border-0 file:bg-[#E7F3EF] file:px-2.5 file:py-1 file:text-[12px] file:font-medium file:text-[#0C5A47]"
        />
      </label>

      <p className={`mt-2 ${C.meta}`} role="status">{photoInspectionStatus(phase, files.length)}</p>

      {files.length > 0 ? (
        <ul className="mt-2 grid gap-1 text-[12px] text-[#4A5A60]" aria-label="已选择的照片">
          {files.map((name, index) => <li key={`${name}-${index}`} className="truncate">{name}</li>)}
        </ul>
      ) : null}

      <div className="mt-3 grid gap-2 sm:flex sm:items-center">
        <Button variant="secondary" onClick={submit} disabled={files.length === 0}>
          提交辅助检查
        </Button>
        <span className={C.meta}>需求 {demandId} · 当前不会自动确认验收</span>
      </div>

      <Note tone="info" title="人工复核提示">
        <ul className="grid gap-1">
          {PHOTO_INSPECTION_HINTS.map((hint) => <li key={hint}>{hint}。</li>)}
        </ul>
      </Note>

      {phase === "unavailable" ? (
        <div className="mt-3">
          <Note tone="warn">
            照片检查接口尚未开放（501）。本页不会把照片或排期状态改成「已验收」，请由施工负责人现场确认。
          </Note>
        </div>
      ) : null}
    </Card>
  );
}
