import { ChatWindow } from "@/components/ChatWindow";
import { LinkButton, PageHeader } from "@/features/a/ui";

export default function Page() {
  return (
    <>
      <PageHeader
        title="AI 需求澄清"
        subtitle="通过对话逐步整理装修需求；模拟结果会明确标注，请核对后再提交。"
        aside={<LinkButton href="/owner" variant="secondary">返回业主首页</LinkButton>}
      />
      <ChatWindow />
    </>
  );
}
