import { environment, type ZuploContext, type ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, context: ZuploContext) {
  return {
    resource: environment.UPSTREAM_ECHO_MCP_URL,
    authorization_servers: [`https://${environment.AUTH0_DOMAIN}/`],
  };
}
