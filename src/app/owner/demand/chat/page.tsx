import { ModulePage } from "@/components/ui/ModulePage";
import { ChatWindow } from "@/components/ChatWindow";

export default function Page() {
  return (
    <ModulePage
      title="AI 需求澄清"
      owner="A"
      description="通过对话逐步整理装修需求；结果来源会明确标注，请核对后再提交。"
    >
      <ChatWindow />
    </ModulePage>
  );
}
