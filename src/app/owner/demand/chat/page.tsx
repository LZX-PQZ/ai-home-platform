import { ModulePage } from "@/components/ui/ModulePage";
import { ChatWindow } from "@/components/ChatWindow";

export default function Page() {
  return (
    <ModulePage
      title="AI 需求澄清"
      owner="A"
      description="对话调用 POST /api/demand/chat（当前为 mock 固定追问）；右侧需求单需人工核对后确认，保存仍由 D 的 POST /api/demand 决定，未开放时会明确提示，不会假装保存成功。"
    >
      <ChatWindow />
    </ModulePage>
  );
}
