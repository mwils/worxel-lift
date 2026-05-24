import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

export function ok(body: unknown, init?: { headers?: Record<string, string> }): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 200,
    headers: { ...DEFAULT_HEADERS, ...init?.headers },
    body: JSON.stringify(body),
  };
}

export function created(body: unknown): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 201, headers: DEFAULT_HEADERS, body: JSON.stringify(body) };
}

export function noContent(): APIGatewayProxyStructuredResultV2 {
  return { statusCode: 204, body: "" };
}

export function badRequest(message: string, details?: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 400,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ error: { code: "bad_request", message, details } }),
  };
}

export function unauthorized(message = "Unauthorized"): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 401,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ error: { code: "unauthorized", message } }),
  };
}

export function forbidden(message = "Forbidden"): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 403,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ error: { code: "forbidden", message } }),
  };
}

export function notFound(message = "Not found"): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 404,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ error: { code: "not_found", message } }),
  };
}

export function conflict(message: string, details?: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 409,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ error: { code: "conflict", message, details } }),
  };
}

export function serverError(message: string, details?: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 500,
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ error: { code: "server_error", message, details } }),
  };
}
