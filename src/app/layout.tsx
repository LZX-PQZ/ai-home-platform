import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = { title: "AI 家装履约平台 · 开发骨架", description: "四人 AI 协作开发起点" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><nav><Link href="/">家装履约平台</Link><Link href="/owner">业主端 · A</Link><Link href="/owner/matches/demo-demand">匹配 · B</Link><Link href="/owner/quotes/demo-demand">报价 · B</Link><Link href="/provider">服务方 · C</Link><Link href="/admin">管理端 · C</Link></nav><main>{children}</main></body></html>;
}
