import { Demand, Provider, Quote, Schedule, Payment, Ticket } from "@/contracts";
export const demoDemand = Demand.parse({
 id: "demo-demand", description: "60 平米老房适老化改造，重点解决浴室防滑和通行便利。", city: "深圳",
 areaM2: 60, budgetMinCents: 3000000, budgetMaxCents: 5000000, renovationType: "elderly", desiredDays: 30, status: "published",
});
export const providers = Provider.array().parse([
 { id:"provider-a", name:"安心施工工作室（模拟）", city:"深圳", kind:"construction", tags:["适老化","局部改造"], rating:4.8 },
 { id:"provider-b", name:"宜家改造工作室（模拟）", city:"深圳", kind:"construction", tags:["适老化","维修"], rating:4.6 },
 { id:"provider-c", name:"明材供应商（模拟）", city:"深圳", kind:"materials", tags:["地砖","防滑"], rating:4.7 },
 { id:"provider-d", name:"简居设计工作室（模拟）", city:"深圳", kind:"design", tags:["适老化"], rating:4.5 },
 { id:"provider-e", name:"放心监理（模拟）", city:"深圳", kind:"supervision", tags:["验收"], rating:4.9 },
 { id:"provider-f", name:"邻城施工队（模拟）", city:"广州", kind:"construction", tags:["局部改造"], rating:4.7 },
]);
export const quotes = Quote.array().parse([
 { id:"quote-a", demandId:"demo-demand", providerId:"provider-a", estimatedDays:25, status:"submitted",
 items:[{code:"bathroom",name:"浴室改造套餐",unit:"job",quantity:1,unitPriceCents:1200000,amountCents:1200000,note:"模拟，实际范围需现场确认"},{code:"haul",name:"垃圾清运",unit:"job",quantity:1,unitPriceCents:null,amountCents:null,note:"待商家补充"}],knownTotalCents:1200000,pendingItems:["垃圾清运"] },
 { id:"quote-b", demandId:"demo-demand", providerId:"provider-b", estimatedDays:28, status:"submitted",
 items:[{code:"bathroom",name:"浴室改造套餐",unit:"job",quantity:1,unitPriceCents:1250000,amountCents:1250000,note:"模拟，实际范围需现场确认"},{code:"haul",name:"垃圾清运",unit:"job",quantity:1,unitPriceCents:50000,amountCents:50000,note:"含清运"}],knownTotalCents:1300000,pendingItems:[] },
]);
export const schedule = Schedule.parse({demandId:"demo-demand",version:1,tasks:[
 {id:"inspect",name:"现场勘查",startDay:0,durationDays:1,dependsOn:[],responsibleProviderId:"provider-a",status:"done"},
 {id:"demolition",name:"拆除",startDay:1,durationDays:2,dependsOn:["inspect"],responsibleProviderId:"provider-a",status:"active"},
 {id:"repair",name:"基层处理",startDay:3,durationDays:3,dependsOn:["demolition"],responsibleProviderId:"provider-a",status:"pending"},
]});
export const payments = Payment.array().parse([{id:"payment-demo",demandId:"demo-demand",stage:"签约节点",amountCents:390000,status:"pending",simulated:true}]);
export const tickets = Ticket.array().parse([{id:"ticket-demo",demandId:"demo-demand",description:"拆除后发现墙面潮湿，需要现场复核并调整施工安排（模拟）。",category:"quality",responsibleProviderId:"provider-a",status:"assigned"}]);
