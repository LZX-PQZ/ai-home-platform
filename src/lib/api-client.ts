import { z } from "zod";
import { envelope } from "@/contracts";
/** 浏览器端调用相对路径；响应先校验再交给页面，避免不同 AI 悄悄改字段。 */
export async function apiGet<T extends z.ZodTypeAny>(path: string, schema: T) {
 const response = await fetch(path);
 const payload: unknown = await response.json();
 if (!response.ok) throw new Error("接口请求失败，HTTP " + response.status);
 return envelope(schema).parse(payload);
}
