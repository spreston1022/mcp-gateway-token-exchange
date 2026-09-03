import type { ZuploContext, ZuploRequest } from "@zuplo/runtime";

const ROLES_CLAIM = "https://zuplo.com/roles";

export default async function resolveCapabilities(
  request: ZuploRequest,
  _context: ZuploContext
) {
  const roles = (request.user?.data as Record<string, unknown> | undefined)?.[
    ROLES_CLAIM
  ] as string[] | undefined;

  return {
    tools: roles?.includes("echo") ? ["echo"] : [],
  };
}
