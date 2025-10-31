import * as vscode from "vscode";
import { ModeManager } from "../services/modeManager";
import { PromptManager } from "../services/promptManager";
import { TaskContextProvider } from "../views/taskContextProvider";
import { SetupService } from "../services/setupService";
import { ChatSessionManager } from "../services/chatSessionManager";
import type { WorkflowOrchestrator } from "../workflows/workflowOrchestrator";
import { KiroMarkdownFormatter } from "../styles/kiroTheme";

export class ChatParticipant {
    private sessionManager: ChatSessionManager;

    constructor(
        private modeManager: ModeManager,
        private promptManager: PromptManager,
        private taskContextProvider: TaskContextProvider, // eslint-disable-line @typescript-eslint/no-unused-vars
        private extensionContext: vscode.ExtensionContext,
        private setupService: SetupService,
        private workflowOrchestrator?: WorkflowOrchestrator
    ) {
        this.sessionManager = new ChatSessionManager(extensionContext);
    }

    register(): vscode.Disposable {
        const participant = vscode.chat.createChatParticipant(
            "kiro-copilot.assistant",
            this.handleChatRequest.bind(this)
        );

        // Set metadata
        participant.iconPath = vscode.Uri.file("resources/kiro-icon.svg");

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
        // Check if this is the first interaction (no previous messages in context)
        const isFirstInteraction = context.history.length === 0;

        // Handle explicit slash commands first
        if (request.command) {
            await this.handleSlashCommand(request, stream);
            return;
        }

        // Show mode selection prompt on first interaction if no mode is explicitly set
        if (isFirstInteraction && !this.hasUserSetMode()) {
            await this.showModeSelectionPrompt(stream);
            // Still process the request after showing the prompt
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
            case "vibe":
                await this.switchToVibeMode(stream);
                break;
            case "spec":
                await this.switchToSpecMode(stream);
                break;
            case "task":
                await this.handleTaskCommand(request, stream);
                break;
            default:
                stream.markdown(`Unknown command: /${request.command}\n`);
        }
    }

    /**
     * Show mode selection prompt on first interaction
     */
    private async showModeSelectionPrompt(
        stream: vscode.ChatResponseStream
    ): Promise<void> {
        const currentMode = this.modeManager.getCurrentMode();

        stream.markdown(KiroMarkdownFormatter.header("Let's build", "🚀"));
        stream.markdown("Plan, search, or build anything\n\n");
        stream.markdown(KiroMarkdownFormatter.divider());

        stream.markdown(
            KiroMarkdownFormatter.header("Choose your coding mode:")
        );

        // Vibe mode option
        stream.markdown(
            `**${KiroMarkdownFormatter.modeBadge(
                "vibe",
                currentMode === "vibe"
            )}** ${currentMode === "vibe" ? "(current)" : ""}\n\n`
        );
        stream.markdown(
            "*Chat first, then build. Explore ideas and iterate as you discover needs.*\n\n"
        );
        stream.markdown("Great for:\n");
        stream.markdown(
            KiroMarkdownFormatter.listItem("Rapid exploration and testing", "✓")
        );
        stream.markdown(
            KiroMarkdownFormatter.listItem(
                "Building when requirements are unclear",
                "✓"
            )
        );
        stream.markdown(
            KiroMarkdownFormatter.listItem("Implementing a task", "✓")
        );
        stream.markdown("\n");
        stream.markdown(
            KiroMarkdownFormatter.inlineCode("/vibe") +
                " to switch to this mode\n\n"
        );

        stream.markdown(KiroMarkdownFormatter.divider());

        // Spec mode option
        stream.markdown(
            `**${KiroMarkdownFormatter.modeBadge(
                "spec",
                currentMode === "spec"
            )}** ${currentMode === "spec" ? "(current)" : ""}\n\n`
        );
        stream.markdown(
            "*Plan first, then build. Create requirements and design before coding starts.*\n\n"
        );
        stream.markdown("Great for:\n");
        stream.markdown(
            KiroMarkdownFormatter.listItem("Thinking through features", "✓")
        );
        stream.markdown(
            KiroMarkdownFormatter.listItem("Projects needing planning", "✓")
        );
        stream.markdown(
            KiroMarkdownFormatter.listItem("Building in a structured way", "✓")
        );
        stream.markdown("\n");
        stream.markdown(
            KiroMarkdownFormatter.inlineCode("/spec") +
                " to switch to this mode\n\n"
        );

        stream.markdown(KiroMarkdownFormatter.divider());
        stream.markdown(
            `**Current mode:** ${KiroMarkdownFormatter.modeBadge(
                currentMode,
                true
            )}\n\n`
        );
        stream.markdown(
            KiroMarkdownFormatter.callout(
                "You can switch modes anytime using /vibe or /spec commands.",
                "info"
            )
        );
    }

    /**
     * Check if user has explicitly set a mode (not using default)
     */
    private hasUserSetMode(): boolean {
        // Check if mode was explicitly set by user (stored in workspace state)
        const hasSetMode = this.extensionContext.workspaceState.get(
            "kiro.hasUserSetMode",
            false
        );
        return hasSetMode;
    }

    /**
     * Mark that user has explicitly set a mode
     */
    private async markModeAsUserSet(): Promise<void> {
        await this.extensionContext.workspaceState.update(
            "kiro.hasUserSetMode",
            true
        );
    }

    /**
     * Switch to Vibe Coding mode
     */
    private async switchToVibeMode(
        stream: vscode.ChatResponseStream
    ): Promise<void> {
        await this.modeManager.setMode("vibe");
        await this.markModeAsUserSet();

        stream.markdown(
            KiroMarkdownFormatter.header("Switched to Vibe Coding mode", "🎯")
        );
        stream.markdown(
            "*Chat first, then build. Explore ideas and iterate as you discover needs.*\n\n"
        );
        stream.markdown("Great for:\n");
        stream.markdown(
            KiroMarkdownFormatter.listItem("Rapid exploration and testing", "✓")
        );
        stream.markdown(
            KiroMarkdownFormatter.listItem(
                "Building when requirements are unclear",
                "✓"
            )
        );
        stream.markdown(
            KiroMarkdownFormatter.listItem("Implementing a task", "✓")
        );
        stream.markdown("\n");

        // Preserve chat history notification
        stream.markdown(
            KiroMarkdownFormatter.callout(
                "Your chat history has been preserved and will continue in Vibe mode.",
                "info"
            )
        );
    }

    /**
     * Switch to Spec mode
     */
    private async switchToSpecMode(
        stream: vscode.ChatResponseStream
    ): Promise<void> {
        await this.modeManager.setMode("spec");
        await this.markModeAsUserSet();

        stream.markdown(
            KiroMarkdownFormatter.header("Switched to Spec mode", "📋")
        );
        stream.markdown(
            "*Plan first, then build. Create requirements and design before coding starts.*\n\n"
        );
        stream.markdown("Great for:\n");
        stream.markdown(
            KiroMarkdownFormatter.listItem(
                "Structured feature development",
                "✓"
            )
        );
        stream.markdown(
            KiroMarkdownFormatter.listItem(
                "Requirements-driven development",
                "✓"
            )
        );
        stream.markdown(
            KiroMarkdownFormatter.listItem(
                "Complex features requiring formal specs",
                "✓"
            )
        );
        stream.markdown("\n");

        // Preserve chat history notification
        stream.markdown(
            KiroMarkdownFormatter.callout(
                "Your chat history has been preserved and will continue in Spec mode.",
                "info"
            )
        );
    }

    /**
     * Handle mode-specific chat - routes through workflow orchestrator
     */
    private async handleModeSpecificChat(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        const mode = this.modeManager.getCurrentMode();
        const modeIcon = mode === "vibe" ? "🎯" : "📋";
        const modeName = mode === "vibe" ? "Vibe Coding" : "Spec";

        // Display current mode status prominently
        stream.markdown(
            KiroMarkdownFormatter.header(`${modeName} Mode`, modeIcon)
        );
        stream.markdown(`*${this.modeManager.getModeDescription(mode)}*\n\n`);
        stream.markdown(KiroMarkdownFormatter.divider());

        // Get or create chat session
        const session = this.sessionManager.getOrCreateActiveSession(mode);

        // Add user message to session history
        this.sessionManager.addMessage(session.id, "user", request.prompt);

        // Check if workflow orchestrator is available
        if (!this.workflowOrchestrator) {
            stream.markdown(
                "⚠️ Workflow orchestrator not initialized. Please restart the extension.\n"
            );
            return;
        }

        // Display workflow progress if a workflow is running
        if (this.workflowOrchestrator.isWorkflowRunning()) {
            this.displayWorkflowProgress(stream, false);
            stream.markdown("\n---\n\n");

            // If workflow is running, route message through workflow context
            await this.handleWorkflowMessage(request, context, stream, token);
            return;
        }

        // Check if MCP server is set up
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            stream.markdown(
                "⚠️ No workspace folder open. Please open a workspace to use Kiro.\n"
            );
            return;
        }

        const workspacePath = workspaceFolder.uri.fsPath;

        // Setup MCP server only if not already set up
        if (!this.setupService.isMCPServerSetup(workspacePath)) {
            stream.markdown("🔧 Setting up MCP server (first time)...\n\n");
            const mcpResult = await this.setupService.setupMCPServer(
                workspacePath
            );
            if (!mcpResult.success) {
                stream.markdown(`❌ ${mcpResult.message}\n`);
                return;
            }
            stream.markdown(`✓ ${mcpResult.message}\n\n`);
        }

        // Copy prompt files only if not already set up
        if (!this.setupService.arePromptFilesSetup(workspacePath)) {
            stream.markdown("📝 Copying prompt files (first time)...\n\n");
            const promptResult = await this.setupService.copyPromptFiles(
                workspacePath
            );
            if (promptResult.success) {
                stream.markdown(`✓ ${promptResult.message}\n\n`);
            } else {
                stream.markdown(`⚠️ ${promptResult.message}\n\n`);
            }
        }

        // Setup MCP config
        const configResult = await this.setupService.setupMCPConfig(
            workspacePath
        );
        if (!configResult.success) {
            stream.markdown(`⚠️ ${configResult.message}\n\n`);
        }

        // Route through workflow orchestrator
        await this.routeThroughWorkflow(request, stream, token, session.id);
    }

    /**
     * Route user message through appropriate workflow based on mode
     */
    private async routeThroughWorkflow(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken,
        sessionId: string
    ): Promise<void> {
        const mode = this.modeManager.getCurrentMode();

        // Register progress callback to display updates in chat
        this.workflowOrchestrator!.onProgress((progress) => {
            if (!token.isCancellationRequested) {
                this.displayProgressUpdate(progress, stream);
            }
        });

        // Register approval callback to handle approval gates in chat
        this.workflowOrchestrator!.onApprovalRequired(
            async (approvalRequest) => {
                return await this.handleApprovalInChat(approvalRequest, stream);
            }
        );

        try {
            // Extract spec name from request if in spec mode
            let specName: string | undefined;
            if (mode === "spec") {
                // Try to extract spec name from prompt or use a default
                const specNameMatch = request.prompt.match(
                    /(?:spec|feature|project):\s*([a-z0-9-]+)/i
                );
                if (specNameMatch) {
                    specName = specNameMatch[1];
                } else {
                    // Prompt user for spec name
                    specName = await vscode.window.showInputBox({
                        prompt: "Enter a name for this spec (use kebab-case)",
                        placeHolder: "my-feature-name",
                        validateInput: (value) => {
                            if (!value || !/^[a-z0-9-]+$/.test(value)) {
                                return "Spec name must be in kebab-case (lowercase letters, numbers, and hyphens only)";
                            }
                            return null;
                        },
                    });

                    if (!specName) {
                        stream.markdown(
                            "⚠️ Spec name is required for Spec mode. Workflow cancelled.\n"
                        );
                        return;
                    }
                }
            }

            // Start workflow
            stream.markdown(
                `Starting ${mode === "vibe" ? "Vibe" : "Spec"} workflow...\n\n`
            );

            await this.workflowOrchestrator!.startWorkflow(
                mode,
                request.prompt,
                specName,
                sessionId
            );

            // Build the Kiro tool invocation based on mode and workflow state
            const workflowState = this.workflowOrchestrator!.getWorkflowState();

            let toolName = "";
            let toolCommand = "";

            if (mode === "vibe") {
                toolName = "kiro_execute_task";
                toolCommand = request.prompt;
            } else {
                // In spec mode, use the appropriate MCP tool based on current step
                const currentStepId =
                    workflowState.workflow?.steps[workflowState.currentStep]
                        ?.id;
                if (currentStepId === "requirements") {
                    toolName = "kiro_create_requirements";
                    toolCommand = request.prompt;
                } else if (currentStepId === "design") {
                    toolName = "kiro_create_design";
                    toolCommand = `spec: "${specName}"`;
                } else if (currentStepId === "create-tasks") {
                    toolName = "kiro_create_tasks";
                    toolCommand = `spec: "${specName}"`;
                } else {
                    toolName = "kiro_execute_task";
                    toolCommand = request.prompt;
                }
            }

            stream.markdown(`\n⟳ Invoking Kiro MCP tool: **${toolName}**\n\n`);

            // Invoke the Kiro MCP tool directly through the language model
            await this.invokeKiroTool(
                toolName,
                toolCommand,
                specName,
                request,
                stream,
                token
            );

            // Add assistant response to session history
            this.sessionManager.addMessage(
                sessionId,
                "assistant",
                `Invoked ${toolName} for ${mode} workflow`
            );
        } catch (error) {
            console.error(
                "[ChatParticipant] Error routing through workflow:",
                error
            );
            stream.markdown(
                `❌ Error: ${
                    error instanceof Error ? error.message : String(error)
                }\n`
            );

            // Add error to session history
            this.sessionManager.addMessage(
                sessionId,
                "assistant",
                `Error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Handle messages when a workflow is already running
     */
    private async handleWorkflowMessage(
        request: vscode.ChatRequest,
        context: vscode.ChatContext, // eslint-disable-line @typescript-eslint/no-unused-vars
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken // eslint-disable-line @typescript-eslint/no-unused-vars
    ): Promise<void> {
        const workflowState = this.workflowOrchestrator!.getWorkflowState();

        stream.markdown(
            `Continuing workflow: **${workflowState.workflow?.name}**\n\n`
        );

        // Check if message is an approval response
        const lowerPrompt = request.prompt.toLowerCase();
        if (
            lowerPrompt.includes("approve") ||
            lowerPrompt.includes("yes") ||
            lowerPrompt.includes("continue") ||
            lowerPrompt.includes("proceed")
        ) {
            stream.markdown("✓ Approval received. Continuing workflow...\n\n");
            // The workflow orchestrator will handle the approval
            return;
        }

        if (
            lowerPrompt.includes("reject") ||
            lowerPrompt.includes("no") ||
            lowerPrompt.includes("cancel") ||
            lowerPrompt.includes("stop")
        ) {
            stream.markdown("⚠️ Workflow cancelled by user.\n");
            await this.workflowOrchestrator!.cancelWorkflow();
            return;
        }

        // Otherwise, treat as feedback or modification request
        stream.markdown(
            "I'll incorporate your feedback into the current workflow step.\n\n"
        );

        // Route to Copilot with context
        const copilotCommand = `Continue with user feedback: "${request.prompt}"`;

        await vscode.env.clipboard.writeText(copilotCommand);
        await vscode.commands.executeCommand("workbench.action.chat.open", {
            query: copilotCommand,
        });
    }

    /**
     * Display a progress update in the chat stream
     */
    private displayProgressUpdate(
        progress: import("../workflows/workflowOrchestrator").WorkflowProgress,
        stream: vscode.ChatResponseStream
    ): void {
        const statusIcon = {
            "in-progress": "⟳",
            completed: "✓",
            failed: "❌",
            "waiting-approval": "⏸️",
        }[progress.status];

        stream.markdown(
            `${statusIcon} **Step ${progress.currentStep + 1}/${
                progress.totalSteps
            }**: ${progress.currentStepName}\n`
        );

        if (progress.message) {
            stream.markdown(`   ${progress.message}\n`);
        }

        stream.markdown("\n");
    }

    /**
     * Handle approval request in chat
     */
    private async handleApprovalInChat(
        approvalRequest: import("../workflows/workflowOrchestrator").ApprovalRequest,
        stream: vscode.ChatResponseStream
    ): Promise<string> {
        stream.markdown(`\n---\n\n`);
        stream.markdown(`⏸️ **Approval Required**\n\n`);
        stream.markdown(`${approvalRequest.message}\n\n`);
        stream.markdown(`Options: ${approvalRequest.options.join(", ")}\n\n`);
        stream.markdown(
            `Please respond with your choice in the next message.\n`
        );

        // Use VS Code UI for approval (fallback)
        const choice = await vscode.window.showInformationMessage(
            approvalRequest.message,
            { modal: true },
            ...approvalRequest.options
        );

        return choice || "Reject";
    }

    /**
     * Handle the /task command
     */
    private async handleTaskCommand(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream
    ): Promise<void> {
        const editor = vscode.window.activeTextEditor;

        if (!editor || !editor.document.fileName.endsWith("tasks.md")) {
            stream.markdown(
                "⚠️ Please open a `tasks.md` file to use the task command.\n"
            );
            return;
        }

        const mode = this.modeManager.getCurrentMode();
        stream.markdown(
            `Starting task in **${
                mode === "vibe" ? "Vibe Coding" : "Spec"
            }** mode...\n\n`
        );

        // Load mode-specific prompts for task context
        await this.promptManager.getTaskInstructions(
            editor.document.getText(),
            mode
        );

        if (mode === "spec") {
            stream.markdown(
                "I'll guide you through the requirements specification process:\n\n"
            );
            stream.markdown(
                "1. Review project context from `.kiro/steering/` files\n"
            );
            stream.markdown("2. Generate initial `requirements.md` draft\n");
            stream.markdown("3. Request your approval\n");
            stream.markdown("4. Iterate based on your feedback\n\n");
        } else {
            stream.markdown(
                "Let's start working on this task. I'll help you:\n\n"
            );
            stream.markdown("- Understand the requirements\n");
            stream.markdown("- Explore implementation options\n");
            stream.markdown("- Iterate quickly based on feedback\n\n");
        }
    }

    /**
     * Display workflow progress in the chat stream
     * @param stream Chat response stream
     * @param showDetails Whether to show detailed logs
     */
    private displayWorkflowProgress(
        stream: vscode.ChatResponseStream,
        showDetails: boolean = false
    ): void {
        if (!this.workflowOrchestrator) {
            return;
        }

        try {
            this.workflowOrchestrator.renderProgressToStream(
                stream,
                showDetails
            );
        } catch (error) {
            console.error(
                "[ChatParticipant] Failed to display workflow progress:",
                error
            );
        }
    }

    /**
     * Get the workflow orchestrator instance (for external access)
     */
    getWorkflowOrchestrator(): WorkflowOrchestrator | undefined {
        return this.workflowOrchestrator;
    }

    /**
     * Set the workflow orchestrator instance (for dependency injection)
     */
    setWorkflowOrchestrator(orchestrator: WorkflowOrchestrator): void {
        this.workflowOrchestrator = orchestrator;
    }

    /**
     * Get the session manager instance
     */
    getSessionManager(): ChatSessionManager {
        return this.sessionManager;
    }

    /**
     * Complete current chat session
     */
    completeCurrentSession(): void {
        const activeSession = this.sessionManager.getActiveSession();
        if (activeSession) {
            this.sessionManager.completeSession(activeSession.id);
        }
    }

    /**
     * Restore workflow from session
     */
    async restoreSessionWorkflow(sessionId: string): Promise<boolean> {
        const workflowState =
            this.sessionManager.restoreWorkflowState(sessionId);

        if (!workflowState || !this.workflowOrchestrator) {
            return false;
        }

        try {
            // Resume workflow in orchestrator
            await this.workflowOrchestrator.resumeWorkflow();
            return true;
        } catch (error) {
            console.error(
                "[ChatParticipant] Failed to restore workflow:",
                error
            );
            return false;
        }
    }

    /**
     * Invoke a Kiro MCP tool through the language model
     */
    private async invokeKiroTool(
        toolName: string,
        command: string,
        specName: string | undefined,
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            // Get available language models
            const models = await vscode.lm.selectChatModels({
                vendor: "copilot",
                family: "gpt-4o",
            });

            if (models.length === 0) {
                stream.markdown(
                    "❌ No Copilot language model available. Please ensure GitHub Copilot is enabled.\n"
                );
                return;
            }

            const model = models[0];

            // Prepare the tool invocation message
            const toolInvocationPrompt = this.buildToolInvocationPrompt(
                toolName,
                command,
                specName
            );

            // Create messages for the language model
            const messages = [
                vscode.LanguageModelChatMessage.User(toolInvocationPrompt),
            ];

            // Make the request with the Kiro tool available
            const chatRequest = await model.sendRequest(
                messages,
                {
                    justification:
                        "Kiro assistant invoking MCP tools for spec-driven development",
                },
                token
            );

            // Stream the response
            for await (const fragment of chatRequest.text) {
                if (token.isCancellationRequested) {
                    break;
                }
                stream.markdown(fragment);
            }

            stream.markdown("\n");
        } catch (error) {
            console.error("[ChatParticipant] Error invoking Kiro tool:", error);
            stream.markdown(
                `❌ Failed to invoke ${toolName}: ${
                    error instanceof Error ? error.message : String(error)
                }\n`
            );
        }
    }

    /**
     * Build the prompt for tool invocation
     */
    private buildToolInvocationPrompt(
        toolName: string,
        command: string,
        specName: string | undefined
    ): string {
        let prompt = `You are the Kiro AI assistant. Execute the following MCP tool:\n\n`;
        prompt += `Tool: ${toolName}\n`;
        prompt += `Command: ${command}\n`;

        if (specName) {
            prompt += `Spec: ${specName}\n`;
        }

        prompt += `\nPlease invoke the ${toolName} MCP tool with the above parameters. `;
        prompt += `The MCP server will provide the necessary context and workflow prompts.`;

        return prompt;
    }
}

