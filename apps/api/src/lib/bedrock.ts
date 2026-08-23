import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

// Bedrock's Converse API is provider-agnostic — same request/response shape
// for Claude, Llama, Cohere, Mistral, Titan, and Nova. We use it so swapping
// `BEDROCK_MODEL_*` between providers (e.g. Anthropic ↔ Meta) is a pure
// config change with no code path differences.

let _client: BedrockRuntimeClient | null = null;

function client() {
  if (!_client) {
    _client = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION ?? process.env.AWS_REGION ?? "us-east-1",
    });
  }
  return _client;
}

export interface InvokeModelArgs {
  modelId: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

export interface InvokeModelResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  raw: unknown;
}

/**
 * Invoke any Bedrock chat-capable model. Provider-agnostic via the Converse API.
 */
export async function invokeModel(args: InvokeModelArgs): Promise<InvokeModelResult> {
  const res = await client().send(
    new ConverseCommand({
      modelId: args.modelId,
      messages: [{ role: "user", content: [{ text: args.prompt }] }],
      system: args.system ? [{ text: args.system }] : undefined,
      inferenceConfig: {
        maxTokens: args.maxTokens ?? 1024,
        temperature: args.temperature ?? 0.4,
      },
    })
  );

  const text = res.output?.message?.content?.[0]?.text ?? "";

  return {
    text,
    inputTokens: res.usage?.inputTokens,
    outputTokens: res.usage?.outputTokens,
    raw: res,
  };
}

const DEFAULT_MODEL = "us.meta.llama4-scout-17b-instruct-v1:0";

export function modelDraft() {
  return process.env.BEDROCK_MODEL_DRAFT ?? DEFAULT_MODEL;
}

export function modelClassify() {
  return process.env.BEDROCK_MODEL_CLASSIFY ?? DEFAULT_MODEL;
}

export function modelBlog() {
  // Long-form persona-voice drafting wants a stronger model than the SMS
  // one-liners — point BEDROCK_MODEL_BLOG at a Claude profile when available.
  return process.env.BEDROCK_MODEL_BLOG ?? modelDraft();
}
