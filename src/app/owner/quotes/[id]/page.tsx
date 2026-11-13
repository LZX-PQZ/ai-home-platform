import { ModulePage } from "@/components/ui/ModulePage";
import { QuoteTable } from "@/components/QuoteTable";
import { quotes } from "@/lib/mock-data";
export default function Page() { return <ModulePage title="透明报价" owner="B" description="样例仅对比列明费用；固定数据，不是市场真实报价。"><QuoteTable quotes={quotes}/></ModulePage>; }
