/** D：仅模拟付款状态；严禁对外宣称真实资金托管。 */
export function confirmDemoPayment(status: "pending" | "confirmed_demo") {
 if(status!=="pending") throw new Error("该演示节点已确认");
 return "confirmed_demo" as const;
}
