import * as vscode from 'vscode';
import * as path from 'path';
import { ModeManager } from '../services/modeManager';
import { PromptManager } from '../services/promptManager';
import { SetupService } from '../services/setupService';

export class ChatParticipant {

    constructor(
        private modeManager: ModeManager,
        private promptManager: PromptManager,
        private extensionContext: vscode.ExtensionContext,
        private setupService: SetupService
    ) {}

    register(): vscode.Disposable {
        const participant = vscode.chat.createChatParticipant(
            'kiro-copilot.assistant',
            this.handleChatRequest.bind(this)
        );

        // Set metadata
        const iconUri = vscode.Uri.joinPath(this.extensionContext.extensionUri, 'resources', 'kiro-icon.svg');
        participant.iconPath = iconUri;

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
            await this.handleSlashCommand(request, stream, token);
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
        stream: vscode.ChatResponseStream,
        token?: vscode.CancellationToken // eslint-disable-line @typescript-eslint/no-unused-vars
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

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            stream.markdown('⚠️ No workspace folder open. Please open a workspace to use Kiro.\n');
            return;
        }

        const promptFileName = mode === 'spec' ? 'requirements.prompt.md' : 'executeTask.prompt.md';
        const promptFilePath = path.join(workspaceFolder.uri.fsPath, '.github', 'prompts', promptFileName);
        const promptUri = vscode.Uri.file(promptFilePath);
        const relativePromptPath = path.relative(workspaceFolder.uri.fsPath, promptFilePath);

        const promptReady = await this.ensurePromptFile(promptUri, workspaceFolder, stream);
        if (!promptReady) {
            return;
        }

        stream.markdown('Manual workflow only. Follow the prompt template referenced below and drive the conversation yourself.\n');
        stream.markdown(`- Prompt file: \`${relativePromptPath}\`\n`);
        stream.markdown(`- Suggested context command: \`#File ${relativePromptPath}\` to pull it into chat\n`);
        stream.markdown(`- Next step: work through each section of ${promptFileName} while discussing your task\n\n`);

        const trimmedPrompt = request.prompt?.trim();
        if (trimmedPrompt) {
            stream.markdown('Include this request when you follow the template:\n');
            stream.markdown('```text\n');
            stream.markdown(`${trimmedPrompt}\n`);
            stream.markdown('```\n');
        } else {
            stream.markdown('Share the task details in chat, then follow the template steps one by one.\n');
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

    private async ensurePromptFile(
        promptUri: vscode.Uri,
        workspaceFolder: vscode.WorkspaceFolder,
        stream: vscode.ChatResponseStream
    ): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(promptUri);
            return true;
        } catch {
            stream.markdown('📝 Prompt file missing. Syncing templates...\n');
            const result = await this.setupService.copyPromptFiles(workspaceFolder.uri.fsPath);
            if (!result.success) {
                stream.markdown(`❌ ${result.message}\n`);
                return false;
            }
        }

        try {
            await vscode.workspace.fs.stat(promptUri);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            stream.markdown(`❌ Prompt file still unavailable: ${message}\n`);
            stream.markdown('Run **Kiro: Setup Project** to regenerate the templates, then try again.\n');
            return false;
        }
    }
}
