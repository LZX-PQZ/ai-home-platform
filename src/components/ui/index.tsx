import React, { type ReactNode } from "react";

/** D 维护的跨角色共享 UI 出口；A/B/C 通过这里复用，避免跨 features 导入。 */

/** 色板：与 app-preview 原型一致，墨绿主色 + 暖橙强调 + 中性灰 */
export const T = {
  brand: "#0F6E56",
  brandHover: "#0C5A47",
  brandSoft: "#E7F3EF",
  accent: "#C2681C",
  accentSoft: "#FDF0E2",
  ink: "#16242B",
  ink2: "#4A5A60",
  muted: "#7A8A90",
  line: "#E2E9EB",
  surface: "#FFFFFF",
  canvas: "#F3F6F7",
  danger: "#B42318",
  dangerSoft: "#FEF3F2",
  warn: "#8A5A06",
  warnSoft: "#FEF6E7",
} as const;

/* ---------- 类名常量：其他三位可直接复用 ---------- */
export const C = {
  card: "rounded-[14px] border border-[#E2E9EB] bg-white p-5 shadow-[0_1px_2px_rgba(22,36,43,0.04)]",
  cardFlush: "rounded-[14px] border border-[#E2E9EB] bg-white shadow-[0_1px_2px_rgba(22,36,43,0.04)]",
  sectionTitle: "text-[15px] font-semibold text-[#16242B]",
  pageTitle: "text-[26px] font-bold tracking-tight text-[#16242B]",
  pageSub: "text-[13.5px] leading-relaxed text-[#4A5A60]",
  meta: "text-[12px] text-[#7A8A90]",

  btnBase:
    "inline-flex items-center justify-center gap-1.5 rounded-[10px] px-4 py-2 text-[13.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45",
  btnPrimary: "bg-[#0F6E56] text-white hover:bg-[#0C5A47]",
  btnSecondary:
    "border border-[#E2E9EB] bg-white text-[#16242B] hover:border-[#0F6E56] hover:text-[#0F6E56]",
  btnGhost: "text-[#0F6E56] hover:bg-[#E7F3EF]",
  btnDanger: "border border-[#EAC7C3] bg-white text-[#B42318] hover:bg-[#FEF3F2]",
  btnSm: "px-3 py-1.5 text-[12.5px]",

  pill: "inline-flex items-center rounded-full border border-[#E2E9EB] bg-white px-3 py-1 text-[12px] text-[#4A5A60] hover:border-[#0F6E56] hover:text-[#0F6E56]",

  badge: "inline-flex items-center gap-1 rounded-[7px] px-2 py-0.5 text-[11.5px] font-medium",
  badgeBrand: "bg-[#E7F3EF] text-[#0C5A47]",
  badgeAccent: "bg-[#FDF0E2] text-[#8A5A06]",
  badgeNeutral: "bg-[#F0F3F4] text-[#4A5A60]",
  badgeDanger: "bg-[#FEF3F2] text-[#B42318]",

  label: "grid gap-1.5 text-[12.5px]",
  labelText: "font-medium text-[#4A5A60]",
  input:
    "w-full rounded-[9px] border border-[#E2E9EB] bg-white px-3 py-2 text-[13.5px] text-[#16242B] outline-none placeholder:text-[#A8B4B8] focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/[0.12]",

  note: "rounded-[10px] px-3 py-2.5 text-[12.5px] leading-relaxed",
  noteWarn: "bg-[#FEF6E7] text-[#8A5A06]",
  noteInfo: "bg-[#F0F3F4] text-[#4A5A60]",
  noteDanger: "bg-[#FEF3F2] text-[#B42318]",
  noteOk: "bg-[#E7F3EF] text-[#0C5A47]",
} as const;

/* ---------- 基础组件 ---------- */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`${C.card} ${className}`}>{children}</section>;
}

export function SectionHead({
  title,
  aside,
}: {
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className={`!mb-0 ${C.sectionTitle}`}>{title}</h2>
      {aside}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "brand" | "accent" | "neutral" | "danger";
}) {
  const map = {
    brand: C.badgeBrand,
    accent: C.badgeAccent,
    neutral: C.badgeNeutral,
    danger: C.badgeDanger,
  } as const;
  return <span className={`${C.badge} ${map[tone]}`}>{children}</span>;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: "md" | "sm";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const map: Record<ButtonVariant, string> = {
    primary: C.btnPrimary,
    secondary: C.btnSecondary,
    ghost: C.btnGhost,
    danger: C.btnDanger,
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${C.btnBase} ${map[variant]} ${size === "sm" ? C.btnSm : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={C.label}>
      <span className={C.labelText}>
        {label}
        {hint ? <span className="ml-1 font-normal text-[#A8B4B8]">（{hint}）</span> : null}
      </span>
      {children}
    </label>
  );
}

export function Note({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  title?: string;
  children: ReactNode;
}) {
  const map = {
    info: C.noteInfo,
    warn: C.noteWarn,
    danger: C.noteDanger,
    ok: C.noteOk,
  } as const;
  return (
    <div className={`${C.note} ${map[tone]}`} role={tone === "danger" ? "alert" : "status"}>
      {title ? <p className="!mb-1 font-semibold">{title}</p> : null}
      <div className="[&>p:last-child]:!mb-0">{children}</div>
    </div>
  );
}

/** 空状态：一句话说明 + 一个动作，避免出现纯空白区域 */
export function Empty({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-2 rounded-[12px] border border-dashed border-[#E2E9EB] bg-[#FAFCFC] px-4 py-8 text-center">
      <p className="!mb-0 text-[13.5px] font-medium text-[#4A5A60]">{title}</p>
      {hint ? <p className={`!mb-0 ${C.meta}`}>{hint}</p> : null}
      {action}
    </div>
  );
}
