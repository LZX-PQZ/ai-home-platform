import { ChatWindow } from "@/components/ChatWindow";
import { DataDisclosure, Note, PageHeader } from "@/features/a/ui";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="AI 需求澄清"
        subtitle="用几句家常话说清房子的情况和想改的地方，AI 会整理成一份结构化需求单；确认之前每一项都可以改。"
      />

      <DataDisclosure what="对话" />

      <div className="mb-4">
        <Note tone="info">
          对话调用 POST /api/demand/chat。当前该接口仍是模拟固定追问，不会调用真实模型，也不会替您补全没提过的信息；
          右侧需求单需要人工核对后确认，保存由 POST /api/demand 决定，返回失败时页面会如实提示，不会假装保存成功。
        </Note>
      </div>

      <ChatWindow />
    </div>
  );
}
