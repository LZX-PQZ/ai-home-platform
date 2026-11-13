import Link from "next/link";
import { ModulePage } from "@/components/ui/ModulePage";
import { DemandCard } from "@/components/DemandCard";
import { demoDemand } from "@/lib/mock-data";
export default function Page() { return <ModulePage title="我的装修" owner="A" description="示例需求单；A 将在这里接入需求创建和状态流转。"><DemandCard demand={demoDemand}/><Link href="/owner/demand/chat">开始需求澄清 →</Link></ModulePage>; }
