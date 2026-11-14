import React from "react";
import Link from "next/link";
import { AdminDemandOverview } from "@/features/c/AdminDemandOverview";

export default function Page() {
  return <div className="space-y-6">
    <nav aria-label="管理看板功能">
      <Link href="/admin/provider-reviews" className="rounded-md text-sm font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">查看服务方评价汇总</Link>
    </nav>
    <AdminDemandOverview />
  </div>;
}
