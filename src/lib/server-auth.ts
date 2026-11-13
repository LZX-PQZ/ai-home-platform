import { ProviderIdentity, VerifiedSession, type ProviderIdentityDTO, type VerifiedSessionDTO } from "@/contracts";

/**
 * 认证适配器必须在服务端验证会话签名、过期时间和数据隔离后再返回此对象。
 * 不读取请求体、角色切换状态或客户端自带的 providerId。
 */
export type VerifiedSessionReader = (request: Request) => unknown | Promise<unknown>;

export type ProviderIdentityFailure = {
  ok: false;
  status: 401 | 403;
  error: {
    code: "UNAUTHENTICATED" | "FORBIDDEN";
    message: string;
  };
};

export type ProviderIdentityResult =
  | { ok: true; identity: ProviderIdentityDTO }
  | ProviderIdentityFailure;

/** 当前项目尚未接入真实认证；默认不产生任何演示身份。 */
export const noVerifiedSession: VerifiedSessionReader = async () => null;

export async function readVerifiedSession(
  request: Request,
  readSession: VerifiedSessionReader = noVerifiedSession,
): Promise<VerifiedSessionDTO | null> {
  try {
    const candidate = await readSession(request);
    const parsed = VerifiedSession.safeParse(candidate);
    return parsed.success ? parsed.data : null;
  } catch {
    // 认证适配器异常时不得继续使用未验证身份或客户端字段。
    return null;
  }
}

/**
 * 报价等服务方接口统一从这里取得 providerId。
 * 默认 reader 返回 401；接入真实认证时只替换服务端 reader，不改变调用方契约。
 */
export async function requireProviderIdentity(
  request: Request,
  readSession: VerifiedSessionReader = noVerifiedSession,
): Promise<ProviderIdentityResult> {
  const session = await readVerifiedSession(request, readSession);
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: { code: "UNAUTHENTICATED", message: "请先完成服务方登录。" },
    };
  }
  if (session.role !== "provider" || session.providerId === null) {
    return {
      ok: false,
      status: 403,
      error: { code: "FORBIDDEN", message: "当前身份没有服务方报价权限。" },
    };
  }
  return {
    ok: true,
    identity: ProviderIdentity.parse({
      userId: session.userId,
      role: "provider",
      providerId: session.providerId,
    }),
  };
}

export function providerIdentityFailureResponse(result: ProviderIdentityFailure) {
  return Response.json({ ok: false, error: result.error }, { status: result.status });
}
