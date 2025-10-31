import * as vscode from "vscode";
import * as path from "path";
import { ModeManager } from "../services/modeManager";
import { WorkflowOrchestrator } from "../workflows/workflowOrchestrator";
import { KiroAgentService } from "../services/kiroAgentService";
import { MessageHandler } from "../services/messageHandler";
import { TaskCompletionTracker } from "../services/taskCompletionTracker";

export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    fileReferences?: FileReference[];
    codeBlocks?: CodeBlock[];
    fileOperations?: FileOperation[];
}

export interface FileReference {
    path: string;
    type: "file" | "folder";
    exists: boolean;
}

export interface CodeBlock {
    language: string;
    code: string;
    filePath?: string;
}

export interface FileOperation {
    type: "create" | "read" | "update" | "delete";
    path: string;
    content?: string;
    timestamp: Date;
    success: boolean;
    error?: string;
}

export type CodingMode = "vibe" | "spec";

// Message protocol types
export type WebviewToExtensionMessage =
    | { type: "userMessage"; content: string }
    | { type: "modeChange"; mode: CodingMode }
    | { type: "clearChat" }
    | { type: "stopGeneration" }
    | { type: "applyCode"; code: string; filePath?: string }
    | { type: "copyCode"; code: string }
    | { type: "insertCode"; code: string }
    | { type: "openFile"; path: string }
    | { type: "requestMode" }
    | { type: "requestFileList"; query: string }
    | { type: "approvalResponse"; response: string }
    | { type: "loadMoreMessages" };

export interface AutocompleteItem {
    path: string;
    type: "file" | "folder";
    icon: string;
}

export interface ApprovalRequest {
    id: string;
    stepName: string;
    message: string;
    options: string[];
}

export interface TaskCompletionNotification {
    taskNumber: number;
    filePath: string;
    timestamp: Date;
}

export type ExtensionToWebviewMessage =
    | { type: "addMessage"; message: ChatMessage }
    | { type: "streamChunk"; text: string }
    | { type: "streamComplete" }
    | { type: "modeUpdated"; mode: CodingMode }
    | { type: "fileOperation"; operation: FileOperation }
    | { type: "workflowProgress"; progress: WorkflowProgress }
    | { type: "error"; message: string }
    | { type: "clearMessages" }
    | { type: "fileList"; items: AutocompleteItem[] }
    | { type: "approvalRequest"; request: ApprovalRequest }
    | { type: "taskCompleted"; notification: TaskCompletionNotification }
    | { type: "loadMoreMessages"; messages: ChatMessage[]; hasMore: boolean };

export interface WorkflowProgress {
    workflowName: string;
    currentStep: number;
    totalSteps: number;
    currentStepName: string;
    status: "in-progress" | "completed" | "failed" | "waiting-approval";
    message?: string;
}

export class ChatPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "kiro-copilot.chatPanel";

    private _view?: vscode.WebviewView;
    private _chatHistory: ChatMessage[] = [];
    private _displayedMessageCount: number = 0;
    private readonly _messagesPerPage: number = 50;

    private _pendingFileOperations: FileOperation[] = [];
    private _messageHandler: MessageHandler;
    private _pendingApprovalResolve?: (response: string) => void;
    private _taskCompletionTracker?: TaskCompletionTracker;
    private _currentCancellationTokenSource?: vscode.CancellationTokenSource;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext,
        private readonly _modeManager: ModeManager,
        private readonly _workflowOrchestrator: WorkflowOrchestrator,
        private readonly _kiroAgentService?: KiroAgentService
    ) {
        this._messageHandler = new MessageHandler(
            this._modeManager,
            this._workflowOrchestrator
        );

        // Set up workflow event listeners
        this._setupWorkflowListeners();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView
    ): void | Thenable<void> {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Load chat history from workspace state
        this._loadChatHistory();

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            async (message: WebviewToExtensionMessage) => {
                await this._handleWebviewMessage(message);
            }
        );

        // Send initial mode to webview
        this._sendModeUpdate();

        // Listen for external mode changes
        this._setupModeChangeListener();
    }

    private async _handleWebviewMessage(
        message: WebviewToExtensionMessage
    ): Promise<void> {
        switch (message.type) {
            case "userMessage":
                await this._handleUserMessage(message.content);
                break;

            case "modeChange":
                await this._handleModeChange(message.mode);
                break;

            case "clearChat":
                await this._handleClearChat();
                break;

            case "stopGeneration":
                await this._handleStopGeneration();
                break;

            case "applyCode":
                await this._handleApplyCode(message.code, message.filePath);
                break;

            case "copyCode":
                await this._handleCopyCode(message.code);
                break;

            case "insertCode":
                await this._handleInsertCode(message.code);
                break;

            case "openFile":
                await this._handleOpenFile(message.path);
                break;

            case "requestMode":
                this._sendModeUpdate();
                break;

            case "requestFileList":
                await this._handleFileListRequest(message.query);
                break;

            case "approvalResponse":
                await this._handleApprovalResponse(message.response);
                break;

            case "loadMoreMessages":
                await this._handleLoadMoreMessages();
                break;
        }
    }

    private async _handleUserMessage(content: string): Promise<void> {
        // Parse file references from message
        const parsed = await this._messageHandler.parseUserMessage(content);

        // Create user message with file references
        const userMessage: ChatMessage = {
            id: this._generateMessageId(),
            role: "user",
            content,
            timestamp: new Date(),
            fileReferences: parsed.fileReferences,
        };

        // Add to history and send to webview
        this._chatHistory.push(userMessage);
        await this._sendMessage(userMessage);

        // Save history
        this._saveChatHistory();

        // Process message through workflow orchestrator
        try {
            // Check if a workflow is currently running
            if (this._workflowOrchestrator.isWorkflowRunning()) {
                // Show current workflow progress
                const progress =
                    this._workflowOrchestrator.getCurrentProgress();
                if (progress) {
                    await this.showWorkflowProgress(progress);
                }

                // Inform user that workflow is in progress
                const infoMessage: ChatMessage = {
                    id: this._generateMessageId(),
                    role: "system",
                    content: `A workflow is currently in progress: ${progress?.workflowName} (Step ${progress?.currentStep}/${progress?.totalSteps}). Please wait for it to complete or cancel it before starting a new task.`,
                    timestamp: new Date(),
                };
                this._chatHistory.push(infoMessage);
                await this._sendMessage(infoMessage);
                this._saveChatHistory();
                return;
            }

            // Create cancellation token for this request
            this._currentCancellationTokenSource =
                new vscode.CancellationTokenSource();
            const cancellationToken =
                this._currentCancellationTokenSource.token;

            // Route message through MessageHandler which will use WorkflowOrchestrator
            const responseStream = await this._messageHandler.handleUserMessage(
                content,
                this._chatHistory,
                parsed.fileReferences
            );

            // Create assistant message for streaming
            const assistantMessageId = this._generateMessageId();
            let fullResponse = "";
            let wasCancelled = false;

            try {
                // Stream response chunks
                for await (const chunk of responseStream) {
                    // Check if cancelled
                    if (cancellationToken.isCancellationRequested) {
                        wasCancelled = true;
                        break;
                    }

                    fullResponse += chunk;
                    await this.streamResponse(chunk, false);
                }
            } catch (error) {
                console.error("Error during streaming:", error);
                wasCancelled = true;
            } finally {
                // Clean up cancellation token
                if (this._currentCancellationTokenSource) {
                    this._currentCancellationTokenSource.dispose();
                    this._currentCancellationTokenSource = undefined;
                }
            }

            // Complete streaming
            await this.streamResponse("", true);

            // Create complete assistant message
            const assistantMessage: ChatMessage = {
                id: assistantMessageId,
                role: "assistant",
                content: wasCancelled
                    ? fullResponse + "\n\n_[Generation interrupted by user]_"
                    : fullResponse,
                timestamp: new Date(),
            };

            // Add to history
            this._chatHistory.push(assistantMessage);

            // Attach any pending file operations to the message
            const operations = this.getPendingFileOperations();
            if (operations.length > 0) {
                await this.addFileOperationsToLastMessage(operations);
            }

            this._saveChatHistory();
        } catch (error) {
            console.error("Error processing user message:", error);

            const errorMessage: ChatMessage = {
                id: this._generateMessageId(),
                role: "assistant",
                content: `I encountered an error processing your message: ${
                    error instanceof Error ? error.message : String(error)
                }`,
                timestamp: new Date(),
            };

            this._chatHistory.push(errorMessage);
            await this._sendMessage(errorMessage);
            this._saveChatHistory();
        }
    }

    private async _handleModeChange(mode: CodingMode): Promise<void> {
        const previousMode = this._modeManager.getCurrentMode();

        // Only change if different
        if (previousMode === mode) {
            return;
        }

        await this._modeManager.setMode(mode);

        // Send update to webview
        this._sendModeUpdate();

        // Add system message to chat about mode change
        const systemMessage: ChatMessage = {
            id: this._generateMessageId(),
            role: "system",
            content: `Switched to ${
                mode === "vibe" ? "Vibe Coding" : "Spec"
            } mode. ${this._modeManager.getModeDescription(mode)}`,
            timestamp: new Date(),
        };

        this._chatHistory.push(systemMessage);
        await this._sendMessage(systemMessage);
        this._saveChatHistory();

        // Show notification
        vscode.window.showInformationMessage(
            `Switched to ${mode === "vibe" ? "Vibe Coding" : "Spec"} mode`
        );
    }

    private async _handleClearChat(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            "Are you sure you want to clear the chat history?",
            "Clear",
            "Cancel"
        );

        if (confirm === "Clear") {
            this._chatHistory = [];
            this._displayedMessageCount = 0;
            this._saveChatHistory();
            await this._postMessage({ type: "clearMessages" });

            // Send welcome message after clearing
            const welcomeMessage: ChatMessage = {
                id: this._generateMessageId(),
                role: "system",
                content: `Welcome to Kiro! I'm your AI coding assistant. You're currently in **${
                    this._modeManager.getCurrentMode() === "vibe"
                        ? "Vibe Coding"
                        : "Spec"
                }** mode.\n\n${this._modeManager.getModeDescription(
                    this._modeManager.getCurrentMode()
                )}\n\nHow can I help you today?`,
                timestamp: new Date(),
            };

            this._chatHistory.push(welcomeMessage);
            await this._sendMessage(welcomeMessage);
            this._saveChatHistory();

            vscode.window.showInformationMessage("Chat history cleared");
        }
    }

    private async _handleStopGeneration(): Promise<void> {
        // Cancel the current cancellation token if exists
        if (this._currentCancellationTokenSource) {
            this._currentCancellationTokenSource.cancel();
            this._currentCancellationTokenSource.dispose();
            this._currentCancellationTokenSource = undefined;

            // Send interruption indicator to webview
            await this._postMessage({ type: "streamComplete" });

            const systemMessage: ChatMessage = {
                id: this._generateMessageId(),
                role: "system",
                content: "⚠️ Generation stopped by user",
                timestamp: new Date(),
            };

            this._chatHistory.push(systemMessage);
            await this._sendMessage(systemMessage);
            this._saveChatHistory();

            vscode.window.showInformationMessage("Generation stopped");
        }

        // Cancel any running workflow
        if (this._workflowOrchestrator.isWorkflowRunning()) {
            await this._workflowOrchestrator.cancelWorkflow();

            const systemMessage: ChatMessage = {
                id: this._generateMessageId(),
                role: "system",
                content: "Workflow cancelled by user",
                timestamp: new Date(),
            };

            this._chatHistory.push(systemMessage);
            await this._sendMessage(systemMessage);
            this._saveChatHistory();

            vscode.window.showInformationMessage("Workflow cancelled");
        }
    }

    private async _handleApplyCode(
        code: string,
        filePath?: string
    ): Promise<void> {
        if (!filePath) {
            vscode.window.showErrorMessage("No file path specified");
            return;
        }

        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage("No workspace folder open");
                return;
            }

            const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
            const uri = vscode.Uri.file(fullPath);

            await vscode.workspace.fs.writeFile(uri, Buffer.from(code, "utf8"));

            vscode.window.showInformationMessage(`Code applied to ${filePath}`);
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to apply code: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    private async _handleCopyCode(code: string): Promise<void> {
        await vscode.env.clipboard.writeText(code);
        vscode.window.showInformationMessage("Code copied to clipboard");
    }

    private async _handleInsertCode(code: string): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor");
            return;
        }

        await editor.edit((editBuilder) => {
            editBuilder.insert(editor.selection.active, code);
        });

        vscode.window.showInformationMessage("Code inserted at cursor");
    }

    private async _handleOpenFile(filePath: string): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage("No workspace folder open");
                return;
            }

            const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
            const uri = vscode.Uri.file(fullPath);

            await vscode.window.showTextDocument(uri);
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to open file: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    private async _handleFileListRequest(query: string): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            await this._postMessage({ type: "fileList", items: [] });
            return;
        }

        try {
            // Search for files and folders matching the query
            const items = await this._searchWorkspaceFiles(query);
            await this._postMessage({ type: "fileList", items });
        } catch (error) {
            console.error("Failed to search workspace files:", error);
            await this._postMessage({ type: "fileList", items: [] });
        }
    }

    private async _searchWorkspaceFiles(
        query: string
    ): Promise<AutocompleteItem[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        // Use VS Code's file search API
        const pattern = query ? `**/*${query}*` : "**/*";
        const maxResults = 50;

        try {
            const files = await vscode.workspace.findFiles(
                pattern,
                "**/node_modules/**",
                maxResults
            );

            const items: AutocompleteItem[] = [];

            for (const file of files) {
                const relativePath = vscode.workspace.asRelativePath(file);

                // Check if it's a file or directory
                try {
                    const stat = await vscode.workspace.fs.stat(file);
                    const isDirectory = stat.type === vscode.FileType.Directory;

                    items.push({
                        path: relativePath,
                        type: isDirectory ? "folder" : "file",
                        icon: isDirectory
                            ? "codicon-folder"
                            : this._getFileIcon(relativePath),
                    });
                } catch (error) {
                    // Skip if we can't stat the file
                    continue;
                }
            }

            // Sort by relevance (exact matches first, then alphabetically)
            items.sort((a, b) => {
                const aLower = a.path.toLowerCase();
                const bLower = b.path.toLowerCase();
                const queryLower = query.toLowerCase();

                // Exact match
                if (aLower === queryLower) return -1;
                if (bLower === queryLower) return 1;

                // Starts with query
                if (
                    aLower.startsWith(queryLower) &&
                    !bLower.startsWith(queryLower)
                )
                    return -1;
                if (
                    bLower.startsWith(queryLower) &&
                    !aLower.startsWith(queryLower)
                )
                    return 1;

                // Alphabetical
                return aLower.localeCompare(bLower);
            });

            return items.slice(0, 20); // Limit to 20 results
        } catch (error) {
            console.error("Error searching files:", error);
            return [];
        }
    }

    private _getFileIcon(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();

        // Map common extensions to codicons
        const iconMap: { [key: string]: string } = {
            ".ts": "codicon-file-code",
            ".js": "codicon-file-code",
            ".tsx": "codicon-file-code",
            ".jsx": "codicon-file-code",
            ".json": "codicon-json",
            ".md": "codicon-markdown",
            ".css": "codicon-file-code",
            ".html": "codicon-file-code",
            ".py": "codicon-file-code",
            ".java": "codicon-file-code",
            ".c": "codicon-file-code",
            ".cpp": "codicon-file-code",
            ".go": "codicon-file-code",
            ".rs": "codicon-file-code",
        };

        return iconMap[ext] || "codicon-file";
    }

    public async sendMessage(message: ChatMessage): Promise<void> {
        this._chatHistory.push(message);
        await this._sendMessage(message);
        this._saveChatHistory();
    }

    public async streamResponse(
        text: string,
        isComplete: boolean
    ): Promise<void> {
        await this._postMessage({ type: "streamChunk", text });
        if (isComplete) {
            await this._postMessage({ type: "streamComplete" });
        }
    }

    public async updateMode(mode: CodingMode): Promise<void> {
        await this._postMessage({ type: "modeUpdated", mode });
    }

    public async showFileOperation(operation: FileOperation): Promise<void> {
        // Add to pending operations
        this._pendingFileOperations.push(operation);

        // Send to webview immediately for real-time updates
        await this._postMessage({ type: "fileOperation", operation });
    }

    public async showWorkflowProgress(
        progress: WorkflowProgress
    ): Promise<void> {
        await this._postMessage({ type: "workflowProgress", progress });
    }

    /**
     * Set the task completion tracker instance
     */
    public setTaskCompletionTracker(tracker: TaskCompletionTracker): void {
        this._taskCompletionTracker = tracker;
    }

    /**
     * Notify about task completion
     */
    public async notifyTaskCompletion(
        taskNumber: number,
        filePath: string
    ): Promise<void> {
        const notification: TaskCompletionNotification = {
            taskNumber,
            filePath,
            timestamp: new Date(),
        };

        // Send notification to webview
        await this._postMessage({
            type: "taskCompleted",
            notification,
        });

        const systemMessage: ChatMessage = {
            id: this._generateMessageId(),
            role: "system",
            content: `✓ Task ${taskNumber} marked as complete in ${filePath}`,
            timestamp: new Date(),
        };

        this._chatHistory.push(systemMessage);
        await this._sendMessage(systemMessage);
        this._saveChatHistory();
    }

    /**
     * Get pending file operations and clear the list
     */
    public getPendingFileOperations(): FileOperation[] {
        const operations = [...this._pendingFileOperations];
        this._pendingFileOperations = [];
        return operations;
    }

    /**
     * Clear pending file operations without returning them
     */
    public clearPendingFileOperations(): void {
        this._pendingFileOperations = [];
    }

    /**
     * Add file operations to the most recent assistant message
     */
    public async addFileOperationsToLastMessage(
        operations: FileOperation[]
    ): Promise<void> {
        if (operations.length === 0) {
            return;
        }

        // Find the last assistant message
        for (let i = this._chatHistory.length - 1; i >= 0; i--) {
            if (this._chatHistory[i].role === "assistant") {
                // Add operations to the message
                if (!this._chatHistory[i].fileOperations) {
                    this._chatHistory[i].fileOperations = [];
                }
                this._chatHistory[i].fileOperations!.push(...operations);

                // Save updated history
                this._saveChatHistory();
                break;
            }
        }
    }

    private async _sendMessage(message: ChatMessage): Promise<void> {
        await this._postMessage({ type: "addMessage", message });
    }

    private _sendModeUpdate(): void {
        const mode = this._modeManager.getCurrentMode();
        this._postMessage({ type: "modeUpdated", mode });
    }

    private _setupModeChangeListener(): void {
        // Listen for configuration changes to detect mode changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("kiroCopilot.mode")) {
                this._sendModeUpdate();
            }
        });
    }

    private _setupWorkflowListeners(): void {
        // Listen for workflow progress updates
        this._workflowOrchestrator.onProgress(async (progress) => {
            await this.showWorkflowProgress(progress);

            // Add system message for major workflow events
            if (
                progress.status === "completed" ||
                progress.status === "failed"
            ) {
                const systemMessage: ChatMessage = {
                    id: this._generateMessageId(),
                    role: "system",
                    content:
                        progress.status === "completed"
                            ? `✓ Workflow completed: ${progress.workflowName}`
                            : `✗ Workflow failed: ${
                                  progress.message || "Unknown error"
                              }`,
                    timestamp: new Date(),
                };

                this._chatHistory.push(systemMessage);
                await this._sendMessage(systemMessage);
                this._saveChatHistory();

                // If workflow completed successfully and we have a task tracker, analyze for completion
                if (
                    progress.status === "completed" &&
                    this._taskCompletionTracker
                ) {
                    // Check if there's an active task being tracked
                    if (this._taskCompletionTracker.hasActiveTask()) {
                        // Analyze the last assistant message for completion indicators
                        const lastAssistantMessage = this._chatHistory
                            .slice()
                            .reverse()
                            .find((msg) => msg.role === "assistant");

                        if (lastAssistantMessage) {
                            await this._taskCompletionTracker.analyzeAndMarkComplete(
                                lastAssistantMessage.content
                            );
                        }
                    }
                }
            }
        });

        // Listen for approval requests
        this._workflowOrchestrator.onApprovalRequired(async (request) => {
            // Create approval request with unique ID
            const approvalRequest: ApprovalRequest = {
                id: this._generateMessageId(),
                stepName: request.stepName,
                message: request.message,
                options: request.options,
            };

            // Send approval request to webview
            await this._postMessage({
                type: "approvalRequest",
                request: approvalRequest,
            });

            // Wait for user response from webview
            return new Promise<string>((resolve) => {
                this._pendingApprovalResolve = resolve;

                // Set timeout for approval (5 minutes)
                setTimeout(() => {
                    if (this._pendingApprovalResolve) {
                        this._pendingApprovalResolve("Reject");
                        this._pendingApprovalResolve = undefined;
                    }
                }, 5 * 60 * 1000);
            });
        });
    }

    private async _handleApprovalResponse(response: string): Promise<void> {
        if (this._pendingApprovalResolve) {
            this._pendingApprovalResolve(response);
            this._pendingApprovalResolve = undefined;

            // Add system message about approval decision
            const systemMessage: ChatMessage = {
                id: this._generateMessageId(),
                role: "system",
                content: `User ${response.toLowerCase()}d the workflow step.`,
                timestamp: new Date(),
            };

            this._chatHistory.push(systemMessage);
            await this._sendMessage(systemMessage);
            this._saveChatHistory();
        }
    }

    private async _postMessage(
        message: ExtensionToWebviewMessage
    ): Promise<void> {
        if (this._view) {
            await this._view.webview.postMessage(message);
        }
    }

    private _loadChatHistory(): void {
        const history = this._context.workspaceState.get<ChatMessage[]>(
            "kiro.chatHistory",
            []
        );
        this._chatHistory = history;

        // Load initial batch of messages (most recent)
        this._displayedMessageCount = 0;
        this._loadInitialMessages();
    }

    private _loadInitialMessages(): void {
        // Load the most recent messages up to _messagesPerPage
        const startIndex = Math.max(
            0,
            this._chatHistory.length - this._messagesPerPage
        );
        const messagesToLoad = this._chatHistory.slice(startIndex);

        this._displayedMessageCount = messagesToLoad.length;

        // Send messages to webview
        for (const message of messagesToLoad) {
            this._sendMessage(message);
        }

        // Notify webview if there are more messages to load
        const hasMore = startIndex > 0;
        if (hasMore) {
            this._postMessage({
                type: "loadMoreMessages",
                messages: [],
                hasMore: true,
            });
        }
    }

    private async _handleLoadMoreMessages(): Promise<void> {
        // Calculate how many messages are not yet displayed
        const remainingMessages =
            this._chatHistory.length - this._displayedMessageCount;

        if (remainingMessages <= 0) {
            // No more messages to load
            await this._postMessage({
                type: "loadMoreMessages",
                messages: [],
                hasMore: false,
            });
            return;
        }

        // Load the next batch
        const endIndex = this._chatHistory.length - this._displayedMessageCount;
        const startIndex = Math.max(0, endIndex - this._messagesPerPage);
        const messagesToLoad = this._chatHistory.slice(startIndex, endIndex);

        this._displayedMessageCount += messagesToLoad.length;

        // Check if there are still more messages
        const hasMore = startIndex > 0;

        // Send messages to webview
        await this._postMessage({
            type: "loadMoreMessages",
            messages: messagesToLoad,
            hasMore,
        });
    }

    private _saveChatHistory(): void {
        // Limit history to 500 messages
        if (this._chatHistory.length > 500) {
            this._chatHistory = this._chatHistory.slice(-500);
        }

        this._context.workspaceState.update(
            "kiro.chatHistory",
            this._chatHistory
        );
    }

    private _generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "out",
                "webview",
                "chatPanel.js"
            )
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "out",
                "webview",
                "chatPanel.css"
            )
        );

        const nonce = this._getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Kiro Chat</title>
</head>
<body>
    <div id="chat-container">
        <div id="chat-header">
            <div id="mode-selector">
                <button id="mode-button" class="mode-button">
                    <span id="mode-icon" class="codicon codicon-rocket"></span>
                    <span id="mode-text">Vibe</span>
                    <span class="codicon codicon-chevron-down"></span>
                </button>
                <div id="mode-dropdown" class="mode-dropdown hidden">
                    <div class="mode-option" data-mode="vibe">
                        <span class="codicon codicon-rocket"></span>
                        <div class="mode-info">
                            <div class="mode-name">Vibe Coding</div>
                            <div class="mode-description">Chat first, then build</div>
                        </div>
                    </div>
                    <div class="mode-option" data-mode="spec">
                        <span class="codicon codicon-notebook"></span>
                        <div class="mode-info">
                            <div class="mode-name">Spec</div>
                            <div class="mode-description">Plan first, then build</div>
                        </div>
                    </div>
                </div>
            </div>
            <button id="clear-chat-button" class="icon-button" title="Clear Chat">
                <span class="codicon codicon-clear-all"></span>
            </button>
        </div>

        <div id="messages-container">
            <div id="messages"></div>
        </div>

        <div id="input-container">
            <div class="input-wrapper">
                <textarea id="message-input" placeholder="Type a message... #File #Folder" rows="1" maxlength="10000"></textarea>
                <button id="send-button" class="icon-button" title="Send message (Enter)">
                    <span class="codicon codicon-send"></span>
                </button>
                <button id="stop-button" class="icon-button hidden" title="Stop generation">
                    <span class="codicon codicon-debug-stop"></span>
                </button>
            </div>
            <div class="input-hint">
                <span class="input-hint-text">Press Enter to send, Shift+Enter for new line</span>
                <span class="character-count" id="character-count"></span>
            </div>
        </div>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    private _getNonce(): string {
        let text = "";
        const possible =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(
                Math.floor(Math.random() * possible.length)
            );
        }
        return text;
    }
}
