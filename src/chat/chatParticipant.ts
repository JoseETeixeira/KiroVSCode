import * as path from 'path';
import { ModeManager } from '../services/modeManager';
import { PromptManager } from '../services/promptManager';
import { SetupService } from '../services/setupService';
import {
    IPlatformAdapter,
    Disposable,
    ChatRequest,
    ChatContext,
    ChatResponseStream,
    CancellationToken,
    Uri,
    WorkspaceFolder
} from '../adapters';

/**
 * Chat participant for the Kiro extension.
 * 
 * This class handles the @Kiro chat participant, responding to user messages
 * and slash commands in the IDE's chat interface. It uses the platform adapter
 * for all IDE interactions, enabling cross-platform support.
 * 
 * Supported slash commands:
 * - /vibe - Switch to Vibe Coding mode
 * - /spec - Switch to Spec mode
 * - /task - Start working on a task from tasks.md
 * 
 * @example
 * ```typescript
 * const chatParticipant = new ChatParticipant(
 *     adapter,
 *     modeManager,
 *     promptManager,
 *     setupService
 * );
 * const disposable = chatParticipant.register();
 * ```
 */
export class ChatParticipant {

    /**
     * Creates a new ChatParticipant instance.
     * 
     * @param adapter The platform adapter for IDE interactions
     * @param modeManager The mode manager for switching between vibe and spec modes
     * @param promptManager The prompt manager for loading mode-specific prompts
     * @param setupService The setup service for copying prompt templates
     */
    constructor(
        private readonly adapter: IPlatformAdapter,
        private readonly modeManager: ModeManager,
        private readonly promptManager: PromptManager,
        private readonly setupService: SetupService
    ) {}

    /**
     * Register the chat participant with the IDE.
     * 
     * @returns A disposable that unregisters the participant when disposed
     */
    register(): Disposable {
        const participant = this.adapter.createChatParticipant(
            'kiro-copilot.assistant',
            this.handleChatRequest.bind(this)
        );

        // Set icon using adapter's URI methods
        const extensionContext = this.adapter.getExtensionContext();
        if (extensionContext && extensionContext.extensionUri) {
            const iconUri = this.adapter.joinPath(
                extensionContext.extensionUri,
                'resources',
                'kiro-icon.svg'
            );
            participant.iconPath = iconUri;
        }

        return participant;
    }

    /**
     * Main chat request handler - routes to slash commands or mode-specific chat.
     */
    private async handleChatRequest(
        request: ChatRequest,
        context: ChatContext,
        stream: ChatResponseStream,
        token: CancellationToken
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
     * Handle slash commands (/vibe, /spec, /task).
     */
    private async handleSlashCommand(
        request: ChatRequest,
        stream: ChatResponseStream,
        _token: CancellationToken
    ): Promise<void> {
        void _token; // Explicitly mark as intentionally unused
        
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
     * Switch to Vibe Coding mode.
     */
    private async switchToVibeMode(stream: ChatResponseStream): Promise<void> {
        await this.modeManager.setMode('vibe');
        stream.markdown('Switched to **Vibe Coding** mode 🎯\n\n');
        stream.markdown('*Chat first, then build. Explore ideas and iterate as you discover needs.*\n\n');
        stream.markdown('Great for:\n');
        stream.markdown('- Rapid exploration and testing\n');
        stream.markdown('- Building when requirements are unclear\n');
        stream.markdown('- Implementing a task\n');
    }

    /**
     * Switch to Spec mode.
     */
    private async switchToSpecMode(stream: ChatResponseStream): Promise<void> {
        await this.modeManager.setMode('spec');
        stream.markdown('Switched to **Spec** mode 📋\n\n');
        stream.markdown('*Plan first, then build. Create requirements and design before coding starts.*\n\n');
        stream.markdown('Great for:\n');
        stream.markdown('- Structured feature development\n');
        stream.markdown('- Requirements-driven development\n');
        stream.markdown('- Complex features requiring formal specs\n');
    }

    /**
     * Handle mode-specific chat - sets up context and provides guidance.
     */
    private async handleModeSpecificChat(
        request: ChatRequest,
        _context: ChatContext,
        stream: ChatResponseStream,
        _token: CancellationToken
    ): Promise<void> {
        void _context; // Explicitly mark as intentionally unused
        void _token; // Explicitly mark as intentionally unused

        const mode = this.modeManager.getCurrentMode();
        const modeLabel = mode === 'vibe' ? 'Vibe Coding 🎯' : 'Spec 📋';

        stream.markdown(`*${modeLabel} mode active*\n\n`);

        const workspaceFolders = this.adapter.getWorkspaceFolders();
        const workspaceFolder = workspaceFolders?.[0];
        if (!workspaceFolder) {
            stream.markdown('⚠️ No workspace folder open. Please open a workspace to use Kiro.\n');
            return;
        }

        const promptFileName = mode === 'spec' ? 'requirements.prompt.md' : 'executeTask.prompt.md';
        const promptFilePath = path.join(workspaceFolder.uri.fsPath, '.github', 'prompts', promptFileName);
        const promptUri = this.adapter.createFileUri(promptFilePath);
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
     * Handle the /task command.
     */
    private async handleTaskCommand(
        request: ChatRequest,
        stream: ChatResponseStream
    ): Promise<void> {
        void request; // Explicitly mark as intentionally unused

        const editor = this.adapter.getActiveTextEditor();

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

    /**
     * Ensure the prompt file exists, copying templates if necessary.
     * 
     * @param promptUri The URI of the prompt file
     * @param workspaceFolder The workspace folder to copy templates to
     * @param stream The response stream for status messages
     * @returns true if the prompt file is available
     */
    private async ensurePromptFile(
        promptUri: Uri,
        workspaceFolder: WorkspaceFolder,
        stream: ChatResponseStream
    ): Promise<boolean> {
        try {
            await this.adapter.stat(promptUri);
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
            await this.adapter.stat(promptUri);
            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            stream.markdown(`❌ Prompt file still unavailable: ${message}\n`);
            stream.markdown('Run **Kiro: Setup Project** to regenerate the templates, then try again.\n');
            return false;
        }
    }
}
