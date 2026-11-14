import { notFound } from "next/navigation";
import { StaffRole } from "@/contracts";
import { StaffLogin } from "@/components/ui/StaffLogin";

export default function LoginPage({ params }: { params: { role: string } }) {
  const parsed = StaffRole.safeParse(params.role);
  if (!parsed.success) notFound();
  return <section className="mx-auto max-w-[1080px] space-y-3 px-6 py-10">
    <h1 className="text-2xl font-bold">{parsed.data === "provider" ? "服务方" : "平台运营"}登录</h1>
    <p>请输入对应账号和密码，登录后进入工作页面。</p>
    <div className="max-w-md rounded-card border border-line bg-white p-5"><StaffLogin role={parsed.data} /></div>
    <p className="text-sm text-ink-2">路演中的模拟数据会单独标注。登录账号不代表相关业务数据均为真实。</p>
  </section>;
}
