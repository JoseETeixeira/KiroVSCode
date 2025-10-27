import * as vscode from 'vscode';
import { ModeManager } from '../services/modeManager';
import { PromptManager } from '../services/promptManager';
import { TaskContextProvider } from '../views/taskContextProvider';
import { SetupService } from '../services/setupService';

export class ChatParticipant {
    constructor(
        private modeManager: ModeManager,
        private promptManager: PromptManager,
        private taskContextProvider: TaskContextProvider,
        private extensionContext: vscode.ExtensionContext,
        private setupService: SetupService
    ) {}

    register(): vscode.Disposable {
        const participant = vscode.chat.createChatParticipant(
            'kiro-copilot.assistant',
            this.handleChatRequest.bind(this)
        );

        // Set metadata
        participant.iconPath = vscode.Uri.file('resources/kiro-icon.svg');

        return participant;
    }

    /**
     * Main chat request handler - routes to slash commands or mode-specific chat
     */
    private async handleChatRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        // Handle explicit slash commands first
        if (request.command) {
            await this.handleSlashCommand(request, stream);
            return;
        }

        // Auto-apply mode-specific prompts for regular @Kiro invocations
        await this.handleModeSpecificChat(request, context, stream, token);
    }

    /**
     * Handle slash commands (/vibe, /spec, /task)
     */
    private async handleSlashCommand(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream
    ): Promise<void> {
        switch (request.command) {
            case 'vibe':
                await this.switchToVibeMode(stream);
                break;
            case 'spec':
                await this.switchToSpecMode(stream);
                break;
            case 'task':
                await this.handleTaskCommand(request, stream);
                break;
            default:
                stream.markdown(`Unknown command: /${request.command}\n`);
        }
    }

    /**
     * Switch to Vibe Coding mode
     */
    private async switchToVibeMode(stream: vscode.ChatResponseStream): Promise<void> {
        await this.modeManager.setMode('vibe');
        stream.markdown('Switched to **Vibe Coding** mode 🎯\n\n');
        stream.markdown('*Chat first, then build. Explore ideas and iterate as you discover needs.*\n\n');
        stream.markdown('Great for:\n');
        stream.markdown('- Rapid exploration and testing\n');
        stream.markdown('- Building when requirements are unclear\n');
        stream.markdown('- Implementing a task\n');
    }

    /**
     * Switch to Spec mode
     */
    private async switchToSpecMode(stream: vscode.ChatResponseStream): Promise<void> {
        await this.modeManager.setMode('spec');
        stream.markdown('Switched to **Spec** mode 📋\n\n');
        stream.markdown('*Plan first, then build. Create requirements and design before coding starts.*\n\n');
        stream.markdown('Great for:\n');
        stream.markdown('- Structured feature development\n');
        stream.markdown('- Requirements-driven development\n');
        stream.markdown('- Complex features requiring formal specs\n');
    }

    /**
     * Handle mode-specific chat - sets up MCP and delegates to Copilot
     */
    private async handleModeSpecificChat(
        request: vscode.ChatRequest,
        context: vscode.ChatContext, // eslint-disable-line @typescript-eslint/no-unused-vars
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken // eslint-disable-line @typescript-eslint/no-unused-vars
    ): Promise<void> {
        const mode = this.modeManager.getCurrentMode();
        const modeLabel = mode === 'vibe' ? 'Vibe Coding 🎯' : 'Spec 📋';

        stream.markdown(`*${modeLabel} mode active*\n\n`);

        // Check if MCP server is set up
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            stream.markdown('⚠️ No workspace folder open. Please open a workspace to use Kiro.\n');
            return;
        }

        const workspacePath = workspaceFolder.uri.fsPath;

        // Setup MCP server only if not already set up
        if (!this.setupService.isMCPServerSetup(workspacePath)) {
            stream.markdown('🔧 Setting up MCP server (first time)...\n\n');
            const mcpResult = await this.setupService.setupMCPServer(workspacePath);
            if (!mcpResult.success) {
                stream.markdown(`❌ ${mcpResult.message}\n`);
                return;
            }
            stream.markdown(`✓ ${mcpResult.message}\n\n`);
        }

        // Copy prompt files only if not already set up
        if (!this.setupService.arePromptFilesSetup(workspacePath)) {
            stream.markdown('📝 Copying prompt files (first time)...\n\n');
            const promptResult = await this.setupService.copyPromptFiles(workspacePath);
            if (promptResult.success) {
                stream.markdown(`✓ ${promptResult.message}\n\n`);
            } else {
                stream.markdown(`⚠️ ${promptResult.message}\n\n`);
            }
        }

        // Setup MCP config
        const configResult = await this.setupService.setupMCPConfig(workspacePath);
        if (!configResult.success) {
            stream.markdown(`⚠️ ${configResult.message}\n\n`);
        }

        // Build the Copilot command based on mode
        let copilotCommand = '';

        if (mode === 'vibe') {
            copilotCommand = `Use kiro_execute_task with command: "${request.prompt}"`;
        } else {
            copilotCommand = `Use kiro_create_requirements with command: "${request.prompt}"`;
        }

        stream.markdown(`Sending to Copilot with Kiro MCP tools...\n\n`);
        stream.markdown(`Command: \`${copilotCommand}\`\n\n`);

        try {
            // Copy command to clipboard
            await vscode.env.clipboard.writeText(copilotCommand);

            // Open Copilot Chat
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: copilotCommand
            });

            stream.markdown('✓ Kiro command sent to Copilot! The MCP server will inject the appropriate prompt.\n');

        } catch (err) {
            console.error(`[ChatParticipant] Failed to open Copilot:`, err);
            stream.markdown(`❌ Failed to open Copilot: ${err instanceof Error ? err.message : String(err)}\n`);
        }
    }

    /**
     * Handle the /task command
     */
    private async handleTaskCommand(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream
    ): Promise<void> {
        const editor = vscode.window.activeTextEditor;

        if (!editor || !editor.document.fileName.endsWith('tasks.md')) {
            stream.markdown('⚠️ Please open a `tasks.md` file to use the task command.\n');
            return;
        }

        const mode = this.modeManager.getCurrentMode();
        stream.markdown(`Starting task in **${mode === 'vibe' ? 'Vibe Coding' : 'Spec'}** mode...\n\n`);

        // Load mode-specific prompts for task context
        await this.promptManager.getTaskInstructions(
            editor.document.getText(),
            mode
        );

        if (mode === 'spec') {
            stream.markdown('I\'ll guide you through the requirements specification process:\n\n');
            stream.markdown('1. Review project context from `.kiro/steering/` files\n');
            stream.markdown('2. Generate initial `requirements.md` draft\n');
            stream.markdown('3. Request your approval\n');
            stream.markdown('4. Iterate based on your feedback\n\n');
        } else {
            stream.markdown('Let\'s start working on this task. I\'ll help you:\n\n');
            stream.markdown('- Understand the requirements\n');
            stream.markdown('- Explore implementation options\n');
            stream.markdown('- Iterate quickly based on feedback\n\n');
        }
    }
}
