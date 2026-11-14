import type { Metadata } from "next";
import { RoleNavigation } from "@/components/RoleNavigation";
import { DemoProviderLogin } from "@/components/ui/DemoProviderLogin";
import "./globals.css";
export const metadata: Metadata = { title: "智装 · AI 家装履约平台", description: "AI 家装履约撮合平台" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><RoleNavigation /><DemoProviderLogin /><main>{children}</main></body></html>;
}
