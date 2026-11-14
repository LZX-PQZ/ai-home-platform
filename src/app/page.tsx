import Link from "next/link";
import { C, FulfillmentRuler } from "@/components/ui";
import { demoDemand } from "@/lib/mock-data";

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

const renovationLabel = { elderly: "老房适老化改造", partial: "局部改造", repair: "维修" } as const;
const yuan = (cents: number) => `¥${(cents / 100).toLocaleString("zh-CN")}`;

export default function Home() {
  const demand = demoDemand;
  return (
    <>
      <section className="pt-4 md:pt-8">
        <h1 className="!mb-4 text-[30px] leading-[1.25] [text-wrap:balance] md:text-hero">老房改造，每一步都有据可查</h1>
        <p className="max-w-[30em] text-[18px] text-ink-2">
          说出你家的情况，平台帮你整理成需求单、比对报价，按节点确认后再付款。
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/owner/demand/chat" className={`${C.btnBase} ${C.btnPrimary}`}>描述我家的情况</Link>
          <Link href="/owner/quotes/demo-demand" className={`${C.btnBase} ${C.btnSecondary}`}>看报价对比演示</Link>
        </div>
      </section>

      <section aria-labelledby="demo-project" className="mt-10 rounded-panel border border-line bg-white px-5 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="demo-project" className="!mb-0">{demand.city} {demand.areaM2}㎡ {renovationLabel[demand.renovationType]}</h2>
            <p className="!mb-0 mt-1 text-[14px] text-ink-3">
              {demand.description}
              <br />
              <span className="num">预算 {yuan(demand.budgetMinCents)}–{yuan(demand.budgetMaxCents)}，期望工期 {demand.desiredDays} 天</span>
            </p>
          </div>
          <span className={`${C.badge} ${C.badgeNeutral}`}>模拟数据</span>
        </div>
        <div className="mt-6">
          <FulfillmentRuler status={demand.status} />
        </div>
        <Link href={`/owner/demand/${demand.id}`} className="mt-5 inline-block text-[15px] font-medium">查看这条演示需求</Link>
      </section>

      <nav aria-label="产品功能入口" className="mt-12 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {entries.map(({ title, href, description, action }) => (
          <section key={href} className="flex flex-col border-t-2 border-line pt-4">
            <h3 className="mb-1 text-brand">{title}</h3>
            <p className="!mb-3 text-[15px] text-ink-2">{description}</p>
            <Link href={href} className="mt-auto self-start text-[15px] font-medium">{action}</Link>
          </section>
        ))}
      </nav>

      <aside aria-label="演示说明" className="mt-8 grid gap-1 border-t border-line pt-5 text-[13px] text-ink-3">
        <p className="!mb-0">功能演示，含模拟数据。角色切换会打开对应页面，不会自动登录；访问范围由登录会话决定。</p>
        <p className="!mb-0">AI 澄清默认使用模拟内容；演示服务方资料及部分业务数据为模拟数据，来源以各页面标识为准。</p>
        <p className="!mb-0">真实 AI 功能仍待完整验证；真实付款、生产服务方和管理员认证尚未接入。</p>
      </aside>
    </>
  );
}
