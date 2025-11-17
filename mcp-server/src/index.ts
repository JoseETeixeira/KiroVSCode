#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequest,
  CallToolRequestSchema,
  CallToolResult,
  ListToolsResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  PromptContextDescriptor,
  runPromptWithLLM,
  RunPromptWithLLMResult,
  LLMInvocationError,
} from './runPromptWithLLM.js';

type KiroMode = 'vibe' | 'spec';
type PromptType = 'executeTask' | 'requirements';
type IntentStage = 'queued' | 'running' | 'completed' | 'failed';

interface KiroServerConfig {
  mode: KiroMode;
  workspacePath?: string;
  promptsPath?: string;
}

interface TextContent {
  type: 'text';
  text: string;
  [key: string]: unknown;
}

type ToolResponse = CallToolResult & {
  content: TextContent[];
};

interface StatusPayload {
  stage: IntentStage;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
  specSlug?: string;
  tool?: string;
}

class KiroMCPServer {
  private readonly server: Server;
  private readonly config: KiroServerConfig = { mode: 'vibe' };

  constructor() {
    const args = process.argv.slice(2);

    const workspaceIndex = args.indexOf('--workspace');
    if (workspaceIndex !== -1 && args[workspaceIndex + 1]) {
      this.config.workspacePath = args[workspaceIndex + 1];
      console.error(`[Kiro MCP] Workspace path: ${this.config.workspacePath}`);
    }

    const promptsIndex = args.indexOf('--prompts');
    if (promptsIndex !== -1 && args[promptsIndex + 1]) {
      this.config.promptsPath = args[promptsIndex + 1];
      console.error(`[Kiro MCP] Prompts path: ${this.config.promptsPath}`);
    }

    this.server = new Server(
      {
        name: 'kiro-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async (): Promise<ListToolsResult> => ({
        tools: [
          {
            name: 'kiro_execute_task',
            description:
              "Execute a task using Kiro's executeTask workflow (Vibe mode). Loads the executeTask prompt with mandatory context gathering, reads design.md, requirements.md, and .kiro/steering/ files, then implements the task.",
            inputSchema: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description:
                    'The task command to execute (e.g., "implement feature X", "execute task 12", "fix bug in file.ts")',
                },
              },
              required: ['command'],
            },
          },
          {
            name: 'kiro_create_requirements',
            description:
              "Create or refine requirements using Kiro's requirements workflow (Spec mode). Loads the requirements prompt to guide structured feature planning and requirements documentation.",
            inputSchema: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description:
                    'The requirements command (e.g., "create requirements for feature X", "refine requirements", "add requirement for Y")',
                },
              },
              required: ['command'],
            },
          },
          {
            name: 'kiro_set_mode',
            description:
              'Switch between Kiro modes: "vibe" (executeTask workflow) or "spec" (requirements workflow)',
            inputSchema: {
              type: 'object',
              properties: {
                mode: {
                  type: 'string',
                  enum: ['vibe', 'spec'],
                  description: 'The mode to switch to',
                },
              },
              required: ['mode'],
            },
          },
          {
            name: 'kiro_get_current_mode',
            description: 'Get the current Kiro mode and its description',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      }),
    );

    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: CallToolRequest): Promise<ToolResponse> => {
        const { name } = request.params;
        const toolArgs = (request.params.arguments ?? {}) as Record<string, unknown>;

        try {
          switch (name) {
            case 'kiro_execute_task':
              return await this.handleExecuteTask(
                typeof toolArgs.command === 'string' ? toolArgs.command : undefined,
              );
            case 'kiro_create_requirements':
              return await this.handleCreateRequirements(
                typeof toolArgs.command === 'string' ? toolArgs.command : undefined,
              );
            case 'kiro_set_mode':
              return await this.handleSetMode(toolArgs.mode);
            case 'kiro_get_current_mode':
              return await this.handleGetCurrentMode();
            default:
              throw new Error(`Unknown tool: ${name}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  }

  private async handleExecuteTask(command?: string): Promise<ToolResponse> {
    if (!command?.trim()) {
      throw new Error('The kiro_execute_task tool requires a non-empty command argument.');
    }
    console.error(`[Kiro MCP] Executing task via MCP helper.`);

    const content: TextContent[] = [];
    const specSlug = this.extractSpecSlug(command);
    const actionId = 'executeTask.next';
    content.push(
      this.createStatusContent('queued', 'Preparing executeTask prompt.', {
        tool: 'kiro_execute_task',
        specSlug,
        details: { actionId },
      }),
    );
    content.push(
      this.createStatusContent('running', 'Invoking Copilot LLM with executeTask template.', {
        tool: 'kiro_execute_task',
        specSlug,
        details: { actionId },
      }),
    );

    try {
      const llmResult = await this.invokePrompt('executeTask', command, specSlug);
      content.push(
        this.createStatusContent('completed', 'executeTask finished.', {
          tool: 'kiro_execute_task',
          specSlug,
          details: this.buildSuccessDetails(llmResult, { actionId }),
        }),
      );

      return { content };
    } catch (error) {
      content.push(
        this.createStatusContent('failed', 'executeTask failed.', {
          tool: 'kiro_execute_task',
          specSlug,
          details: this.buildErrorDetails(error, { actionId }),
        }),
      );
      return {
        content,
        isError: true,
      };
    }
  }

  private async handleCreateRequirements(command?: string): Promise<ToolResponse> {
    if (!command?.trim()) {
      throw new Error('The kiro_create_requirements tool requires a non-empty command argument.');
    }
    console.error('[Kiro MCP] Creating requirements via MCP helper.');

    const content: TextContent[] = [];
    const specSlug = this.extractSpecSlug(command);
    const actionId = 'createRequirements';
    content.push(
      this.createStatusContent('queued', 'Preparing requirements prompt.', {
        tool: 'kiro_create_requirements',
        specSlug,
        details: { actionId },
      }),
    );
    content.push(
      this.createStatusContent('running', 'Invoking Copilot LLM with requirements template.', {
        tool: 'kiro_create_requirements',
        specSlug,
        details: { actionId },
      }),
    );

    try {
      const llmResult = await this.invokePrompt('requirements', command, specSlug);
      content.push(
        this.createStatusContent('completed', 'requirements workflow finished.', {
          tool: 'kiro_create_requirements',
          specSlug,
          details: this.buildSuccessDetails(llmResult, { actionId }),
        }),
      );

      return { content };
    } catch (error) {
      content.push(
        this.createStatusContent('failed', 'requirements workflow failed.', {
          tool: 'kiro_create_requirements',
          specSlug,
          details: this.buildErrorDetails(error, { actionId }),
        }),
      );
      return {
        content,
        isError: true,
      };
    }
  }

  private async handleSetMode(mode?: unknown): Promise<ToolResponse> {
    if (mode !== 'vibe' && mode !== 'spec') {
      throw new Error('The kiro_set_mode tool requires the mode argument to be either "vibe" or "spec".');
    }

    this.config.mode = mode;
    const modeLabel = mode === 'vibe' ? 'Vibe Coding' : 'Spec Planning';
    const promptType = mode === 'vibe' ? 'executeTask' : 'requirements';

    return {
      content: [
        {
          type: 'text',
          text: `Switched to **${modeLabel}** mode. Future operations will use the ${promptType} workflow.`,
        },
      ],
    };
  }

  private async handleGetCurrentMode(): Promise<ToolResponse> {
    const modeLabel = this.config.mode === 'vibe' ? 'Vibe Coding' : 'Spec Planning';
    const description =
      this.config.mode === 'vibe'
        ? 'Chat first, then build. Explore ideas and iterate as you discover needs.'
        : 'Plan first, then build. Create requirements and design before coding starts.';

    return {
      content: [
        {
          type: 'text',
          text: `Current mode: **${modeLabel}**\n\n${description}`,
        },
      ],
    };
  }

  private createStatusContent(
    stage: IntentStage,
    message: string,
    options?: { details?: Record<string, unknown>; specSlug?: string; tool?: string },
  ): TextContent {
    const payload: StatusPayload = {
      stage,
      message,
      timestamp: new Date().toISOString(),
      ...(options?.details ? { details: options.details } : {}),
      ...(options?.specSlug ? { specSlug: options.specSlug } : {}),
      ...(options?.tool ? { tool: options.tool } : {}),
    };
    void this.publishStatus(payload);
    return {
      type: 'text',
      text: ['```json', JSON.stringify(payload, null, 2), '```'].join('\n'),
    };
  }

  private buildSuccessDetails(
    result: RunPromptWithLLMResult,
    extra?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      modelId: result.modelId,
      llmResponse: result.llmResponse,
      tokenUsage: result.tokenUsage,
      latencyMs: result.latencyMs,
      ...(extra ?? {}),
    };
  }

  private buildErrorDetails(error: unknown, extra?: Record<string, unknown>): Record<string, unknown> {
    if (error instanceof LLMInvocationError) {
      return {
        errorType: 'LLMInvocationError',
        message: error.message,
        status: error.status,
        body: error.body,
        ...(extra ?? {}),
      };
    }

    if (error instanceof Error) {
      return {
        errorType: error.name,
        message: error.message,
        ...(extra ?? {}),
      };
    }

    return {
      errorType: 'UnknownError',
      message: String(error),
      ...(extra ?? {}),
    };
  }

  private async invokePrompt(
    promptId: PromptType,
    command: string,
    specSlug?: string,
  ): Promise<RunPromptWithLLMResult> {
    const contextFiles = this.buildContextDescriptors(specSlug);

    return runPromptWithLLM({
      promptId,
      userMessage: command,
      workspacePath: this.config.workspacePath,
      promptsPath: this.config.promptsPath,
      contextFiles,
    });
  }

  private buildContextDescriptors(specSlug?: string): PromptContextDescriptor[] {
    if (!this.config.workspacePath) {
      return [];
    }

    const descriptors: PromptContextDescriptor[] = [...this.buildBaseContextDescriptors()];

    if (specSlug) {
      descriptors.push(
        {
          path: `.kiro/specs/${specSlug}/requirements.md`,
          label: `${specSlug} requirements.md`,
          required: false,
        },
        {
          path: `.kiro/specs/${specSlug}/design.md`,
          label: `${specSlug} design.md`,
          required: false,
        },
        {
          path: `.kiro/specs/${specSlug}/tasks.md`,
          label: `${specSlug} tasks.md`,
          required: false,
        },
      );
    }

    return descriptors;
  }

  private buildBaseContextDescriptors(): PromptContextDescriptor[] {
    return [
      {
        path: '.kiro/steering/product.md',
        label: 'Steering product.md',
        required: true,
      },
      {
        path: '.kiro/steering/structure.md',
        label: 'Steering structure.md',
        required: true,
      },
      {
        path: '.kiro/steering/tech.md',
        label: 'Steering tech.md',
        required: true,
      },
    ];
  }

  private extractSpecSlug(command: string): string | undefined {
    const patterns = [
      /\*\*Spec:\*\*\s*([^\n\r]+)/i,
      /Spec:\s*([^\n\r]+)/i,
    ];

    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match?.[1]) {
        const sanitized = match[1].trim().replace(/[`*]/g, '').split(/\s+/)[0];
        const slug = sanitized.replace(/[^a-z0-9-_]/gi, '').toLowerCase();
        if (slug.length > 0) {
          return slug;
        }
      }
    }

    return undefined;
  }

  public async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Kiro MCP Server running on stdio');
  }

  private async publishStatus(payload: StatusPayload): Promise<void> {
    if (!this.config.workspacePath) {
      return;
    }

    try {
      const runtimeDir = path.join(this.config.workspacePath, '.kiro', 'runtime');
      await fs.mkdir(runtimeDir, { recursive: true });
      const statusPath = path.join(runtimeDir, 'intent-status.jsonl');
      await fs.appendFile(statusPath, `${JSON.stringify(payload)}\n`, 'utf-8');
    } catch (error) {
      console.warn('[Kiro MCP] Failed to publish intent status payload', error);
    }
  }
}

const server = new KiroMCPServer();

server.run().catch((error) => {
  console.error('[Kiro MCP] Fatal error', error);
  process.exit(1);
});
