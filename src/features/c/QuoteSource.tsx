import React from "react";
import type { QuoteDTO, SourceDTO } from "@/contracts";
import { StatusBadge } from "@/components/StatusBadge";

const labels: Record<SourceDTO, string> = {
  mock: "报价来源：模拟标识（mock）",
  live: "报价来源：实时标识（live）",
};

export function QuoteSource({ source }: Pick<QuoteDTO, "source">) {
  return <StatusBadge label={source === undefined ? "报价来源：未知（接口未提供）" : labels[source]} />;
}
