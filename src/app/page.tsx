import Link from "next/link";

const entries = [
  {
    title: "我的装修",
    href: "/owner",
    description: "查看本人需求、施工安排与售后记录。",
    action: "查看我的装修",
  },
  {
    title: "报价对比演示",
    href: "/owner/quotes/demo-demand",
    description: "查看固定模拟报价的明细与待确认费用。",
    action: "查看报价演示",
  },
  {
    title: "服务方需求大厅",
    href: "/provider",
    description: "查看已发布需求，登录后填写报价。",
    action: "进入需求大厅",
  },
  {
    title: "运营看板",
    href: "/admin",
    description: "查看当前可读需求、模拟工单与公开评价汇总；不代表管理员认证。",
    action: "查看运营看板",
  },
];

export default function Home() {
  return (
    <>
      <span className="badge">功能演示 · 含模拟数据</span>
      <h1 className="mt-4">把需求、报价与履约串起来</h1>
      <p>老房适老化改造：需求澄清 → 服务方匹配 → 透明报价 → 施工排期 → 售后工单。</p>
      <p className="rounded-control bg-brand-soft px-3 py-2 text-sm text-brand-hover">
        选择要查看的功能。角色切换仅用于导航，访问范围由登录会话决定。
      </p>
      <nav aria-label="产品功能入口" className="grid gap-4 md:grid-cols-2">
        {entries.map(({ title, href, description, action }) => (
          <section className="card my-0 flex flex-col" key={href}>
            <h2>{title}</h2>
            <p>{description}</p>
            <Link
              href={href}
              className="mt-auto self-start rounded-control py-2 font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {action} <span aria-hidden="true">→</span>
            </Link>
          </section>
        ))}
      </nav>
      <aside aria-label="演示说明" className="mt-6 rounded-control border border-line bg-white p-4 text-sm">
        <p>AI 澄清默认使用模拟内容；演示服务方资料及部分业务数据为模拟数据，来源以各页面标识为准。</p>
        <p className="mb-0">真实 AI 功能仍待完整验证；真实付款、生产服务方和管理员认证尚未接入。</p>
      </aside>
    </>
  );
}
