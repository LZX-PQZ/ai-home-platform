import { ModulePage } from "@/components/ui/ModulePage";
import { GanttChart } from "@/components/GanttChart";
import { schedule } from "@/lib/mock-data";
export default function Page() { return <ModulePage title="施工进度" owner="A" description="当前仅展示固定任务列表；动态排期、变更确认与验收待实现。"><GanttChart schedule={schedule}/></ModulePage>; }
