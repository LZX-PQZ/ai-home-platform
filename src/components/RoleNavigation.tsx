"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const roles = {
  owner: {
    label: "业主",
    links: [
      ["我的装修", "/owner"],
      ["需求澄清", "/owner/demand/chat"],
      ["服务方匹配", "/owner/matches/demo-demand"],
      ["报价对比", "/owner/quotes/demo-demand"],
    ],
  },
  provider: {
    label: "服务方",
    links: [
      ["需求大厅", "/provider"],
      ["我的订单", "/provider/orders"],
    ],
  },
  operator: {
    label: "平台运营",
    links: [
      ["运营看板", "/admin"],
      ["售后工单", "/admin/tickets"],
    ],
  },
} as const;

type Role = keyof typeof roles;

function roleForPath(pathname: string): Role {
  if (pathname.startsWith("/provider")) return "provider";
  if (pathname.startsWith("/admin")) return "operator";
  return "owner";
}

export function RoleNavigation() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>("owner");

  useEffect(() => {
    setRole(roleForPath(pathname));
  }, [pathname]);

  const current = roles[role];
  return (
    <header className="border-b border-line bg-white px-6 py-4">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4">
        <Link href="/" className="text-[17px] font-bold tracking-tight text-ink hover:text-brand">
          智装 · AI 家装履约平台
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
            <span>身份切换</span>
            <select
              aria-label="身份切换"
              className="rounded-input border border-line bg-white px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              value={role}
              onChange={(event) => setRole(event.target.value as Role)}
            >
              {Object.entries(roles).map(([value, item]) => (
                <option key={value} value={value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-[12px] font-medium text-brand-hover">
            当前身份：{current.label}
          </span>
        </div>
      </div>
      <nav className="mx-auto mt-3 flex max-w-[1080px] flex-wrap items-center gap-x-5 gap-y-2" aria-label="产品导航">
        {current.links.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? "font-semibold text-brand" : "text-ink-2 hover:text-brand"}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

