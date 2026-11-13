import React from "react";
import type { DemandDTO, SourceDTO } from "@/contracts";
import { StatusBadge } from "@/components/StatusBadge";

const labels: Record<SourceDTO, string> = {
  mock: "需求来源：模拟数据（mock）",
  live: "需求来源：实际创建（live）",
};

export function DemandSource({ source }: Pick<DemandDTO, "source">) {
  return <StatusBadge label={source === undefined ? "需求来源：未知（接口未提供）" : labels[source]} />;
}
