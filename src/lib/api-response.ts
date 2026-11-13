import { NextResponse } from "next/server";
export function mockResponse<T>(data:T) { return NextResponse.json({ok:true,data,meta:{source:"mock" as const}}); }
export function notImplemented() { return NextResponse.json({ok:false,error:{code:"NOT_IMPLEMENTED",message:"这是开工骨架，此操作尚未实现。"}},{status:501}); }
