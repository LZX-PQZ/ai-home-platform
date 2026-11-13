import Link from "next/link";
export default function Home() {
  return <><span className="badge">开工骨架 · 模拟数据 · 尚未接入真实 AI</span><h1>把需求、报价与履约串起来</h1><p>老房适老化改造：需求澄清 → 服务方匹配 → 透明报价 → 施工排期 → 售后工单。</p><p className="rounded-control bg-brand-soft px-3 py-2 text-sm text-brand-hover">本页为组内开发工作台，产品入口见右上身份切换。</p><div className="grid gap-4 md:grid-cols-2">{[
    ["A", "业主端与需求澄清", "/owner", "聊天、需求详情、施工进度、付款展示"],
    ["B", "匹配与报价", "/owner/quotes/demo-demand", "匹配规则、费用对齐、报价解释"],
    ["C", "服务方与管理端", "/provider", "需求大厅、接单、看板、售后工单"],
    ["D", "后端与集成", "/api/health", "数据库、AI 封装、公共契约、持续集成"]
  ].map(([role,title,href,body])=><section className="card" key={role}><h2>{role} · {title}</h2><p>{body}</p><Link href={href}>打开模块 →</Link></section>)}</div><p>每位成员先阅读 README 和自己的 docs/tasks 文件。当前页面用于验证目录与数据契约，不代表业务已完成。</p></>;
}
