import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";

export default function Page() {
  return (
    <section aria-labelledby="provider-orders-title" className="max-w-3xl">
      <h1 id="provider-orders-title">我的接单</h1>
      <p className="text-ink-2">查看自己已确认承接的项目与履约状态。</p>

      <section aria-labelledby="orders-unavailable-title" className="card">
        <StatusBadge label="尚未开放" />
        <h2 id="orders-unavailable-title" className="mt-4">接单查询尚未开放</h2>
        <p>目前无法查询你的接单记录，因此不能确认是否已有接单。此处不会显示订单数量或履约进度。</p>
        <p className="text-sm text-ink-2">数据状态：未读取接单数据，未展示模拟接单。</p>
        <Link
          href="/provider"
          className="inline-flex rounded-lg border border-brand px-4 py-2 font-medium hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          浏览需求大厅
        </Link>
      </section>

      <section aria-labelledby="orders-help-title" className="card">
        <h2 id="orders-help-title">报价与接单</h2>
        <p>你可以先在需求大厅了解已发布需求，进入详情填写并预览报价。提交能否成功，以页面收到的反馈为准。</p>
        <p>提交报价不等于业主接受，也不等于已接单。已承接项目及后续履约安排需经平台核实，请勿仅凭报价预览安排施工。</p>
        <p className="!mb-0 text-sm text-ink-2">顶部角色切换仅用于演示导航，不代表已登录或获得服务方权限。</p>
      </section>
    </section>
  );
}
