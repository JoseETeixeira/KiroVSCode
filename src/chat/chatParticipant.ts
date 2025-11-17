import * as vscode from 'vscode';
import * as path from 'path';
import { ModeManager } from '../services/modeManager';
import { PromptManager } from '../services/promptManager';
import { TaskContextProvider } from '../views/taskContextProvider';
import { SetupService } from '../services/setupService';
import { AutonomyPolicyService, AutonomyAction, AutonomyPolicy } from '../services/autonomyPolicyService';
import { IntentPayload } from '../services/intentService';

export class ChatParticipant {
    constructor(
        private modeManager: ModeManager,
        private promptManager: PromptManager,
        private taskContextProvider: TaskContextProvider,
        private extensionContext: vscode.ExtensionContext,
        private setupService: SetupService,
        private autonomyPolicyService: AutonomyPolicyService
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
            case 'intent':
                await this.handleIntentCommand(request, stream);
                break;
            default:
                stream.markdown(`Unknown command: /${request.command}\n`);
        }
    }

    private async handleIntentCommand(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream
    ): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            stream.markdown('⚠️ Cannot process `/intent` because no workspace is open.\n');
            return;
        }

        const rawPayload = request.prompt?.trim();
        if (!rawPayload) {
            stream.markdown('⚠️ `/intent` requires a JSON payload.\n');
            return;
        }

        let payload: IntentPayload;
        try {
            payload = JSON.parse(rawPayload);
        } catch (error) {
            stream.markdown('❌ Unable to parse intent payload. Provide valid JSON.\n');
            return;
        }

        stream.markdown('**Intent Status**\n');
        stream.markdown('- `queued` Validating payload...\n');

        const validation = await this.validateIntentPayload(payload, workspaceFolder, stream);
        if (!validation) {
            return;
        }

        const workspaceReady = await this.ensureWorkspaceReady(workspaceFolder.uri.fsPath, stream);
        if (!workspaceReady) {
            stream.markdown('- `failed` Workspace setup did not complete.\n');
            return;
        }

        const autonomyState = payload.consentToken
            ? 'Autonomy: active (consent token present).'
            : 'Autonomy: manual fallback (no consent token).';
        stream.markdown(`${autonomyState}\n`);

        const command = this.buildIntentCommand(validation.action, payload);
        stream.markdown('- `dispatching` Forwarding intent to Copilot...\n');

        try {
            await vscode.env.clipboard.writeText(command);
            await vscode.commands.executeCommand('workbench.action.chat.open', { query: command });
            stream.markdown('- `dispatched` MCP tools received the intent. Monitor Copilot for progress.\n');
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            stream.markdown(`- \`failed\` Unable to contact Copilot: ${message}\n`);
        }
    }

    private async validateIntentPayload(
        payload: IntentPayload,
        workspaceFolder: vscode.WorkspaceFolder,
        stream: vscode.ChatResponseStream
    ): Promise<{ policy: AutonomyPolicy; action: AutonomyAction } | undefined> {
        if (!payload.actionId || !payload.userMessage) {
            stream.markdown('❌ Intent payload missing required fields `actionId` or `userMessage`.\n');
            return undefined;
        }

        const policyResult = await this.autonomyPolicyService.getPolicy(workspaceFolder);
        if (!policyResult.policy) {
            stream.markdown(`❌ ${policyResult.error ?? 'Autonomy policy unavailable.'}\n`);
            stream.markdown('Run **Kiro: Setup Project** to sync prompts and manifest files.\n');
            return undefined;
        }

        const policy = policyResult.policy;
        if (payload.policyVersion && payload.policyVersion !== policy.version) {
            stream.markdown(
                `❌ Intent policy version (${payload.policyVersion}) mismatches workspace manifest (${policy.version}). Run setup again.\n`
            );
            return undefined;
        }

        if (payload.instructionsVersion && payload.instructionsVersion !== policy.version) {
            stream.markdown(
                `❌ Instructions version (${payload.instructionsVersion}) mismatches manifest (${policy.version}). Rerun setup to refresh instructions.\n`
            );
            return undefined;
        }

        const action = policy.actions.find(a => a.id === payload.actionId);
        if (!action) {
            stream.markdown(`❌ Action '${payload.actionId}' is not defined in autonomy manifest version ${policy.version}.\n`);
            return undefined;
        }

        const requirementsOk = await this.ensureIntentRequirements(workspaceFolder, action, payload, stream);
        if (!requirementsOk) {
            return undefined;
        }

        stream.markdown('- `running` Intent validated.\n');
        return { policy, action };
    }

    private async ensureIntentRequirements(
        workspaceFolder: vscode.WorkspaceFolder,
        action: AutonomyAction,
        payload: IntentPayload,
        stream: vscode.ChatResponseStream
    ): Promise<boolean> {
        if (!action.requiresFiles || action.requiresFiles.length === 0) {
            return true;
        }

        const missingPaths: string[] = [];
        for (const requirement of action.requiresFiles) {
            let relativePath = requirement;
            if (requirement.includes('<slug>')) {
                if (!payload.specSlug) {
                    stream.markdown('❌ Intent payload missing `specSlug` required for this action.\n');
                    return false;
                }
                relativePath = requirement.replace('<slug>', payload.specSlug);
            }

            const targetPath = path.join(workspaceFolder.uri.fsPath, relativePath);
            const exists = await this.pathExists(vscode.Uri.file(targetPath));
            if (!exists) {
                missingPaths.push(relativePath);
            }
        }

        if (missingPaths.length > 0) {
            stream.markdown('❌ Required files are missing for this intent:\n');
            missingPaths.forEach(missing => stream.markdown(`- ${missing}\n`));
            stream.markdown('Run **Kiro: Setup Project** or regenerate the spec artifacts, then try again.\n');
            return false;
        }

        return true;
    }

    private buildIntentCommand(action: AutonomyAction, payload: IntentPayload): string {
        const lines: string[] = [
            `Intent action: ${payload.actionId}`,
            `Policy version: ${payload.policyVersion ?? 'unknown'}`,
            `Instructions version: ${payload.instructionsVersion ?? 'unknown'}`,
            `Activation source: ${payload.activationSource}`,
            `User message: ${payload.userMessage}`
        ];

        if (payload.specSlug) {
            lines.splice(1, 0, `Spec slug: ${payload.specSlug}`);
        }
        if (typeof payload.taskId === 'number') {
            lines.splice(2, 0, `Task ID: ${payload.taskId}${payload.taskLabel ? ` (${payload.taskLabel})` : ''}`);
        }
        if (payload.metadata) {
            lines.push(`Metadata: ${JSON.stringify(payload.metadata)}`);
        }

        const summary = lines.join('\n').replace(/"/g, '\\"');
        return `Use ${action.tool} with command: "${summary}"`;
    }

    private async pathExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
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
        const workspaceReady = await this.ensureWorkspaceReady(workspacePath, stream);
        if (!workspaceReady) {
            return;
        }

        // Build the Copilot command based on mode
        let copilotCommand = '';

        if (mode === 'vibe') {
            copilotCommand = `Use kiro_execute_task with command: "${request.prompt}"`;
        } else {
            copilotCommand = `Use kiro_execute_task with command: "${request.prompt}"`;
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

    private async ensureWorkspaceReady(
        workspacePath: string,
        stream: vscode.ChatResponseStream
    ): Promise<boolean> {
        if (!this.setupService.isMCPServerSetup(workspacePath)) {
            stream.markdown('🔧 Setting up MCP server (first time)...\n\n');
            const mcpResult = await this.setupService.setupMCPServer(workspacePath);
            if (!mcpResult.success) {
                stream.markdown(`❌ ${mcpResult.message}\n`);
                return false;
            }
            stream.markdown(`✓ ${mcpResult.message}\n\n`);
        }

        if (!this.setupService.arePromptFilesSetup(workspacePath)) {
            stream.markdown('📝 Copying prompt files (first time)...\n\n');
            const promptResult = await this.setupService.copyPromptFiles(workspacePath);
            if (promptResult.success) {
                stream.markdown(`✓ ${promptResult.message}\n\n`);
            } else {
                stream.markdown(`⚠️ ${promptResult.message}\n\n`);
            }
        }

        const configResult = await this.setupService.setupMCPConfig(workspacePath);
        if (!configResult.success) {
            stream.markdown(`⚠️ ${configResult.message}\n\n`);
        }

        return true;
    }
}
