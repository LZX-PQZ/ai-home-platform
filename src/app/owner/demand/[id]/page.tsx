import Link from "next/link";
import { ModulePage } from "@/components/ui/ModulePage";

/**
 * 需求详情占位：ID 来自链接并原样显示，便于验证同一需求 ID 贯穿。
 * GET /api/demand/[id] 尚未建立（D 负责），这里不拿固定 demo 需求冒充该 ID 的真实数据。
 */
export default function Page({ params }: { params: { id: string } }) {
  return (
    <ModulePage
      title="需求详情"
      owner="A"
      description="按需求 ID 查询的接口尚未建立，本页只展示链接带来的 ID，不读取固定样例冒充真实数据。"
    >
      <section className="card">
        <h2>需求 ID</h2>
        <p>
          <code>{params.id}</code>
        </p>
        <p className="text-sm text-slate-600">
          该 ID 由上一页（需求澄清提交成功后的返回，或需求列表）传入。真实详情需要 D 提供
          GET /api/demand/[id]，在此之前本页不会显示任何“已保存”或“已发布”状态。
        </p>
        <p>
          <Link href="/owner/demand/chat">← 返回需求澄清</Link>
          {" · "}
          <Link href="/owner">返回我的装修</Link>
        </p>
      </section>
    </ModulePage>
  );
}
