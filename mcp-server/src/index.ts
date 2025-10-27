#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface KiroConfig {
  mode: 'vibe' | 'spec';
  promptsPath?: string;
  workspacePath?: string;
}

class KiroMCPServer {
  private server: Server;
  private config: KiroConfig = { mode: 'vibe' };

  constructor() {
    // Parse command line arguments for workspace path
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
      }
    );

    this.setupToolHandlers();

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'kiro_execute_task',
          description: 'Execute a task using Kiro\'s executeTask workflow (Vibe mode). Loads the executeTask prompt with mandatory context gathering, reads design.md, requirements.md, and .kiro/steering/ files, then implements the task.',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The task command to execute (e.g., "implement feature X", "execute task 12", "fix bug in file.ts")',
              },
            },
            required: ['command'],
          },
        } as Tool,
        {
          name: 'kiro_create_requirements',
          description: 'Create or refine requirements using Kiro\'s requirements workflow (Spec mode). Loads the requirements prompt to guide structured feature planning and requirements documentation.',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The requirements command (e.g., "create requirements for feature X", "refine requirements", "add requirement for Y")',
              },
            },
            required: ['command'],
          },
        } as Tool,
        {
          name: 'kiro_set_mode',
          description: 'Switch between Kiro modes: "vibe" (executeTask workflow) or "spec" (requirements workflow)',
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
        } as Tool,
        {
          name: 'kiro_get_current_mode',
          description: 'Get the current Kiro mode and its description',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        } as Tool,
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'kiro_execute_task':
            return await this.handleExecuteTask(args?.command as string);

          case 'kiro_create_requirements':
            return await this.handleCreateRequirements(args?.command as string);

          case 'kiro_set_mode':
            return await this.handleSetMode(args?.mode as 'vibe' | 'spec');

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
    });
  }

  private async loadPrompt(promptType: 'executeTask' | 'requirements'): Promise<string> {
    try {
      // Try to find prompts in multiple locations
      const possiblePaths = [
        // In the extension directory (when running as part of extension)
        path.join(__dirname, '..', '..', '..', 'prompts', `${promptType}.prompt.md`),
        // In the workspace (if configured)
        this.config.promptsPath ? path.join(this.config.promptsPath, `${promptType}.prompt.md`) : null,
        // In user's Code/User/prompts directory
        path.join(process.env.APPDATA || process.env.HOME || '', 'Code', 'User', 'prompts', `${promptType}.prompt.md`),
      ].filter(Boolean) as string[];

      for (const promptPath of possiblePaths) {
        try {
          const content = await fs.readFile(promptPath, 'utf-8');
          console.error(`[Kiro MCP] Loaded prompt from: ${promptPath}`);
          return content;
        } catch {
          // Try next path
          continue;
        }
      }

      throw new Error(`Could not find ${promptType}.prompt.md in any known location`);
    } catch (error) {
      throw new Error(`Failed to load ${promptType} prompt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleExecuteTask(command: string) {
    console.error(`[Kiro MCP] Executing task: ${command}`);

    const executeTaskPrompt = await this.loadPrompt('executeTask');

    const fullPrompt = `${executeTaskPrompt}

---

# USER COMMAND (EXECUTE NOW)

${command}

**IMPORTANT**: You are receiving this through the Kiro MCP server, which has already loaded the executeTask workflow instructions above. Begin execution immediately by following the workflow:

1. Read the tasks.md file to identify the target task
2. Read ALL context files (design.md, requirements.md, .kiro/steering/)
3. Summarize what you learned from each document
4. Explain how the task relates to the design
5. Execute the task by modifying the codebase
6. Mark the task as complete in tasks.md

Do NOT ask for permission or clarification. Start executing now.`;

    return {
      content: [
        {
          type: 'text',
          text: fullPrompt,
        },
      ],
    };
  }

  private async handleCreateRequirements(command: string) {
    console.error(`[Kiro MCP] Creating requirements: ${command}`);

    const requirementsPrompt = await this.loadPrompt('requirements');

    const fullPrompt = `${requirementsPrompt}

---

# USER COMMAND

${command}

**IMPORTANT**: You are receiving this through the Kiro MCP server, which has already loaded the requirements workflow instructions above. Begin the requirements process immediately by following the workflow defined in the prompt.`;

    return {
      content: [
        {
          type: 'text',
          text: fullPrompt,
        },
      ],
    };
  }

  private async handleSetMode(mode: 'vibe' | 'spec') {
    this.config.mode = mode;
    const modeLabel = mode === 'vibe' ? 'Vibe Coding 🎯' : 'Spec 📋';
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

  private async handleGetCurrentMode() {
    const modeLabel = this.config.mode === 'vibe' ? 'Vibe Coding 🎯' : 'Spec 📋';
    const description = this.config.mode === 'vibe'
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Kiro MCP Server running on stdio');
  }
}

const server = new KiroMCPServer();
server.run().catch(console.error);
