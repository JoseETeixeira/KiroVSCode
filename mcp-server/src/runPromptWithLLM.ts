import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'url';

const DEFAULT_MODEL = process.env.KIRO_DEFAULT_MODEL ?? 'copilot-gpt-5';
const DEFAULT_ENDPOINT =
  process.env.KIRO_LLM_ENDPOINT ?? 'https://api.githubcopilot.com/v1/chat/completions';
const DEFAULT_MAX_CONTEXT_BYTES = 200_000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PromptContextDescriptor {
  path: string;
  label?: string;
  required?: boolean;
  maxBytes?: number;
}

export interface RunPromptWithLLMOptions {
  promptId: string;
  userMessage: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  contextFiles?: PromptContextDescriptor[];
  workspacePath?: string;
  promptsPath?: string;
  fallbackPromptDirectory?: string;
}

export interface RunPromptWithLLMResult {
  llmResponse: string;
  modelId: string;
  latencyMs: number;
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  rawResponse: unknown;
}

interface CopilotChoice {
  message?: {
    content?: string;
  };
}

interface CopilotUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface CopilotResponse {
  model: string;
  choices: CopilotChoice[];
  usage?: CopilotUsage;
  __latencyMs?: number;
}

export class LLMInvocationError extends Error {
  public readonly status: number | undefined;
  public readonly body: unknown;

  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = 'LLMInvocationError';
  }
}

export async function runPromptWithLLM(
  options: RunPromptWithLLMOptions,
): Promise<RunPromptWithLLMResult> {
  if (!options.userMessage?.trim()) {
    throw new Error('runPromptWithLLM requires a non-empty userMessage');
  }

  const promptContent = await resolvePromptContent(options.promptId, options);
  const contextSections = await buildContextSections(options.contextFiles ?? [], options.workspacePath);

  const finalPromptParts: string[] = [promptContent.trim()];

  if (contextSections.length > 0) {
    finalPromptParts.push(`# WORKSPACE CONTEXT\n${contextSections.join('\n\n')}`);
  }

  finalPromptParts.push(`# USER MESSAGE\n${options.userMessage.trim()}`);

  const finalPrompt = finalPromptParts.join('\n\n');
  const modelId = options.modelId ?? DEFAULT_MODEL;

  const response = await callCopilotLLM({
    prompt: finalPrompt,
    modelId,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  return {
    llmResponse: response.choices[0]?.message?.content ?? '',
    modelId: response.model,
    latencyMs: response.__latencyMs ?? 0,
    tokenUsage: {
      prompt: response.usage?.prompt_tokens ?? 0,
      completion: response.usage?.completion_tokens ?? 0,
      total: response.usage?.total_tokens ?? 0,
    },
    rawResponse: response,
  };
}

async function resolvePromptContent(
  promptId: string,
  options: RunPromptWithLLMOptions,
): Promise<string> {
  const candidates: string[] = [];

  if (options.promptsPath) {
    candidates.push(path.join(options.promptsPath, `${promptId}.prompt.md`));
  }

  if (options.workspacePath) {
    candidates.push(path.join(options.workspacePath, '.github', 'prompts', `${promptId}.prompt.md`));
  }

  if (options.fallbackPromptDirectory) {
    candidates.push(path.join(options.fallbackPromptDirectory, `${promptId}.prompt.md`));
  } else {
    const runtimeDir = path.join(__dirname, '..', '..', 'prompts');
    candidates.push(path.join(runtimeDir, `${promptId}.prompt.md`));
  }

  for (const promptPath of candidates) {
    try {
      const content = await fs.readFile(promptPath, 'utf-8');
      return content;
    } catch {
      continue;
    }
  }

  throw new Error(`Unable to locate prompt template for '${promptId}' in any known directory.`);
}

async function buildContextSections(
  files: PromptContextDescriptor[],
  workspacePath?: string,
): Promise<string[]> {
  const sections: string[] = [];

  for (const descriptor of files) {
    const absolutePath = resolveContextPath(descriptor.path, workspacePath);

    try {
      const raw = await fs.readFile(absolutePath, 'utf-8');
      const maxBytes = descriptor.maxBytes ?? DEFAULT_MAX_CONTEXT_BYTES;
      const content = truncateContent(raw, maxBytes);
      const label = descriptor.label ?? descriptor.path ?? path.basename(absolutePath);
      sections.push(`## ${label}\n\n\`\`\`\n${content}\n\`\`\``);
    } catch (error) {
      if (descriptor.required) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read required context file '${descriptor.path}': ${message}`);
      }

      console.warn(`[runPromptWithLLM] Skipping optional context file ${descriptor.path}:`, error);
    }
  }

  return sections;
}

function resolveContextPath(filePath: string, workspacePath?: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  if (!workspacePath) {
    throw new Error(`Cannot resolve relative context path '${filePath}' without a workspacePath.`);
  }

  return path.join(workspacePath, filePath);
}

function truncateContent(content: string, maxBytes: number): string {
  const buffer = Buffer.from(content, 'utf-8');

  if (buffer.byteLength <= maxBytes) {
    return content;
  }

  const truncated = buffer.subarray(0, maxBytes).toString('utf-8');
  return `${truncated}\n\n[... truncated ${buffer.byteLength - maxBytes} bytes ...]`;
}

interface CopilotInvocation {
  prompt: string;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
}

async function callCopilotLLM(options: CopilotInvocation): Promise<CopilotResponse> {
  const endpoint = DEFAULT_ENDPOINT;
  const token =
    process.env.KIRO_LLM_TOKEN ?? process.env.COPILOT_API_KEY ?? process.env.GITHUB_TOKEN;

  if (!token) {
    throw new LLMInvocationError(
      'Missing KIRO_LLM_TOKEN or COPILOT_API_KEY environment variable for LLM invocation.',
    );
  }

  const payload: Record<string, unknown> = {
    model: options.modelId,
    messages: [
      {
        role: 'user',
        content: options.prompt,
      },
    ],
  };

  if (typeof options.temperature === 'number') {
    payload.temperature = options.temperature;
  }

  if (typeof options.maxTokens === 'number') {
    payload.max_tokens = options.maxTokens;
  }

  const started = performance.now();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const latencyMs = performance.now() - started;

  if (!response.ok) {
    let body: unknown;

    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }

    throw new LLMInvocationError('LLM invocation failed', response.status, body);
  }

  const result = (await response.json()) as CopilotResponse;
  result.__latencyMs = latencyMs;
  return result;
}

