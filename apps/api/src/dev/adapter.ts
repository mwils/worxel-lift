import type { Request, Response } from "express";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";

/**
 * Wrap an API Gateway v2 Lambda handler so it can be mounted as Express middleware.
 * Translates Express req → APIGatewayProxyEventV2, handler result → Express response.
 */
export function toExpress(handler: APIGatewayProxyHandlerV2) {
  return async (req: Request, res: Response) => {
    const cookieHeader = req.headers.cookie ?? "";
    const event: APIGatewayProxyEventV2 = {
      version: "2.0",
      routeKey: `${req.method} ${req.path}`,
      rawPath: req.path,
      rawQueryString: req.url.split("?")[1] ?? "",
      cookies: cookieHeader ? cookieHeader.split(/;\s*/) : [],
      headers: req.headers as Record<string, string>,
      queryStringParameters: req.query as Record<string, string>,
      pathParameters: req.params as Record<string, string>,
      requestContext: {
        accountId: "local",
        apiId: "local",
        domainName: "localhost",
        domainPrefix: "local",
        http: {
          method: req.method,
          path: req.path,
          protocol: "HTTP/1.1",
          sourceIp: req.ip ?? "127.0.0.1",
          userAgent: req.headers["user-agent"] ?? "",
        },
        requestId: Math.random().toString(36).slice(2),
        routeKey: `${req.method} ${req.path}`,
        stage: "dev",
        time: new Date().toISOString(),
        timeEpoch: Date.now(),
      },
      body: typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? null),
      isBase64Encoded: false,
    };

    try {
      const result = (await handler(event, {} as any, () => {})) as
        | APIGatewayProxyStructuredResultV2
        | string
        | undefined;

      if (!result) {
        res.status(500).send({ error: { code: "no_result", message: "Handler returned undefined" } });
        return;
      }

      if (typeof result === "string") {
        res.status(200).send(result);
        return;
      }

      res.status(result.statusCode ?? 200);
      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          if (v !== undefined) res.setHeader(k, v as string);
        }
      }
      if (result.cookies) {
        for (const c of result.cookies) res.append("Set-Cookie", c);
      }
      res.send(result.body ?? "");
    } catch (err) {
      console.error("[dev-server] handler threw", err);
      res.status(500).send({
        error: { code: "server_error", message: (err as Error).message },
      });
    }
  };
}
