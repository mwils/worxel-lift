import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

let _client: BedrockRuntimeClient | null = null;

function client() {
  if (!_client) {
    _client = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? "us-east-1",
    });
  }
  return _client;
}

export interface InvokeClaudeArgs {
  modelId: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export interface InvokeClaudeResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  raw: unknown;
}

/**
 * Invoke a Claude model on Bedrock using the messages API.
 * Returns the plain text content of the assistant turn.
 */
export async function invokeClaude(args: InvokeClaudeArgs): Promise<InvokeClaudeResult> {
  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: args.maxTokens ?? 1024,
    temperature: args.temperature ?? 0.4,
    system: args.system,
    messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }],
  };

  const res = await client().send(
    new InvokeModelCommand({
      modelId: args.modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    })
  );

  const json = JSON.parse(new TextDecoder().decode(res.body));
  const text =
    Array.isArray(json.content) && json.content[0]?.text
      ? (json.content[0].text as string)
      : "";

  return {
    text,
    inputTokens: json.usage?.input_tokens,
    outputTokens: json.usage?.output_tokens,
    raw: json,
  };
}

export function modelDraft() {
  return process.env.BEDROCK_MODEL_DRAFT ?? "us.anthropic.claude-haiku-4-5-20251001-v1:0";
}

export function modelClassify() {
  return process.env.BEDROCK_MODEL_CLASSIFY ?? "us.anthropic.claude-haiku-4-5-20251001-v1:0";
}
