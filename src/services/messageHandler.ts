import * as vscode from "vscode";
import { ModeManager } from "./modeManager";
import { WorkflowOrchestrator } from "../workflows/workflowOrchestrator";

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

/**
 * MessageHandler is responsible for parsing user messages, detecting file references,
 * extracting code blocks from responses, and formatting content for display.
 */
export class MessageHandler {
    constructor(
        private modeManager: ModeManager,
        private workflowOrchestrator: WorkflowOrchestrator
    ) {}

    /**
     * Parse user message and extract file references
     * Supports #File and #Folder syntax
     */
    parseFileReferences(message: string): FileReference[] {
        const references: FileReference[] = [];

        // Match #File:path/to/file or #Folder:path/to/folder
        // Also match #path/to/file or #path/to/folder (without explicit type)
        const filePattern = /#(?:File|file):([^\s#]+)/g;
        const folderPattern = /#(?:Folder|folder):([^\s#]+)/g;
        const genericPattern = /#([^\s#:]+(?:\/[^\s#:]+)*)/g;

        // Extract explicit file references
        let match;
        while ((match = filePattern.exec(message)) !== null) {
            const path = match[1].trim();
            if (path) {
                references.push({
                    path,
                    type: "file",
                    exists: false, // Will be checked later
                });
            }
        }

        // Extract explicit folder references
        while ((match = folderPattern.exec(message)) !== null) {
            const path = match[1].trim();
            if (path) {
                references.push({
                    path,
                    type: "folder",
                    exists: false, // Will be checked later
                });
            }
        }

        // Extract generic references (try to determine type)
        const explicitPaths = new Set(references.map((r) => r.path));
        while ((match = genericPattern.exec(message)) !== null) {
            const path = match[1].trim();

            // Skip if already captured as explicit reference
            if (path && !explicitPaths.has(path)) {
                // Heuristic: if path has extension, treat as file, otherwise folder
                const hasExtension = /\.[a-zA-Z0-9]+$/.test(path);
                references.push({
                    path,
                    type: hasExtension ? "file" : "folder",
                    exists: false, // Will be checked later
                });
            }
        }

        return references;
    }

    /**
     * Check if file references exist in the workspace
     */
    async validateFileReferences(
        references: FileReference[]
    ): Promise<FileReference[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return references;
        }

        const validatedReferences: FileReference[] = [];

        for (const ref of references) {
            try {
                const uri = vscode.Uri.joinPath(workspaceFolder.uri, ref.path);
                const stat = await vscode.workspace.fs.stat(uri);

                validatedReferences.push({
                    ...ref,
                    exists: true,
                    // Update type based on actual file system
                    type:
                        stat.type === vscode.FileType.Directory
                            ? "folder"
                            : "file",
                });
            } catch (error) {
                // File doesn't exist
                validatedReferences.push({
                    ...ref,
                    exists: false,
                });
            }
        }

        return validatedReferences;
    }

    /**
     * Extract code blocks from markdown content
     * Returns array of code blocks with language and optional file path
     */
    extractCodeBlocks(content: string): CodeBlock[] {
        const codeBlocks: CodeBlock[] = [];

        // Match markdown code blocks: ```language\ncode\n```
        const codeBlockPattern = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;

        let match;
        while ((match = codeBlockPattern.exec(content)) !== null) {
            const language = match[1] || "plaintext";
            const code = match[2].trim();

            if (code) {
                // Try to detect file path from context
                // Look for file path in the text before the code block
                const beforeBlock = content.substring(0, match.index);
                const filePath = this.detectFilePathInContext(beforeBlock);

                codeBlocks.push({
                    language,
                    code,
                    filePath: filePath || undefined,
                });
            }
        }

        return codeBlocks;
    }

    /**
     * Detect file path in surrounding context
     * Looks for patterns like "file: path/to/file.ts" or "path/to/file.ts:"
     */
    private detectFilePathInContext(context: string): string | null {
        // Get last few lines before code block
        const lines = context.split("\n").slice(-5);
        const recentContext = lines.join("\n");

        // Match common file path patterns
        const patterns = [
            /(?:file|File):\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/i,
            /([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+):/,
            /`([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)`/,
        ];

        for (const pattern of patterns) {
            const match = recentContext.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Format response content for display
     * Ensures proper markdown formatting and structure
     */
    formatResponse(content: string): string {
        // Trim excessive whitespace
        let formatted = content.trim();

        // Ensure code blocks have proper spacing
        formatted = formatted.replace(/```/g, "\n```\n");

        // Remove excessive blank lines (more than 2 consecutive)
        formatted = formatted.replace(/\n{3,}/g, "\n\n");

        // Ensure lists have proper spacing
        formatted = formatted.replace(/\n-\s/g, "\n\n- ");
        formatted = formatted.replace(/\n\d+\.\s/g, "\n\n1. ");

        return formatted.trim();
    }

    /**
     * Parse user message and prepare it for processing
     * Extracts file references and validates them
     */
    async parseUserMessage(message: string): Promise<{
        content: string;
        fileReferences: FileReference[];
    }> {
        // Extract file references
        const references = this.parseFileReferences(message);

        // Validate references
        const validatedReferences = await this.validateFileReferences(
            references
        );

        return {
            content: message,
            fileReferences: validatedReferences,
        };
    }

    /**
     * Process assistant response and extract structured data
     * Extracts code blocks and formats content
     */
    processAssistantResponse(content: string): {
        formattedContent: string;
        codeBlocks: CodeBlock[];
    } {
        // Extract code blocks
        const codeBlocks = this.extractCodeBlocks(content);

        // Format content
        const formattedContent = this.formatResponse(content);

        return {
            formattedContent,
            codeBlocks,
        };
    }

    /**
     * Handle user message and route to appropriate workflow
     * This is the main entry point for message processing
     */
    async handleUserMessage(
        message: string,
        _chatHistory: ChatMessage[],
        _fileReferences?: FileReference[]
    ): Promise<AsyncIterableIterator<string>> {
        // Get current mode
        const mode = this.modeManager.getCurrentMode();

        // Detect if this is a spec creation request
        const isSpecRequest = this.detectSpecRequest(message);

        if (mode === "spec" && isSpecRequest) {
            // Extract spec name from message
            const specName = this.extractSpecName(message);

            if (specName) {
                // Start spec workflow
                await this.workflowOrchestrator.startWorkflow(
                    "spec",
                    message,
                    specName
                );

                return this.createWorkflowResponse(
                    `Starting Spec workflow for "${specName}"...\n\nI'll guide you through creating requirements, design, and tasks for this feature.`
                );
            } else {
                return this.createWorkflowResponse(
                    "To create a spec, please provide a feature name. For example: 'Create a spec for user authentication' or 'Build a feature called data-export'."
                );
            }
        } else if (mode === "vibe") {
            // Start vibe workflow
            await this.workflowOrchestrator.startWorkflow("vibe", message);

            return this.createWorkflowResponse(
                `Processing your request in Vibe mode...\n\nI'll help you explore and implement this iteratively.`
            );
        } else {
            // General chat response (spec mode but not a spec request)
            return this.createWorkflowResponse(
                `I'm ready to help in Spec mode.\n\nTo create a spec, describe the feature you want to build. For example: "Create a spec for user authentication"`
            );
        }
    }

    /**
     * Detect if the message is requesting spec creation
     */
    private detectSpecRequest(message: string): boolean {
        const specKeywords = [
            /create\s+(?:a\s+)?spec/i,
            /build\s+(?:a\s+)?feature/i,
            /new\s+feature/i,
            /implement\s+(?:a\s+)?feature/i,
            /design\s+(?:a\s+)?feature/i,
            /spec\s+for/i,
        ];

        return specKeywords.some((pattern) => pattern.test(message));
    }

    /**
     * Extract spec name from message
     * Looks for patterns like "create a spec for X" or "build feature called X"
     */
    private extractSpecName(message: string): string | null {
        const patterns = [
            /(?:spec|feature)\s+(?:for|called|named)\s+["']?([a-zA-Z0-9\s-]+)["']?/i,
            /create\s+["']?([a-zA-Z0-9\s-]+)["']?\s+(?:spec|feature)/i,
            /build\s+["']?([a-zA-Z0-9\s-]+)["']?\s+feature/i,
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                // Convert to kebab-case
                return match[1]
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                    .replace(/[^a-z0-9-]/g, "");
            }
        }

        return null;
    }

    /**
     * Create a workflow response as an async iterator
     */
    private async *createWorkflowResponse(
        text: string
    ): AsyncIterableIterator<string> {
        // Simulate streaming by yielding chunks
        const words = text.split(" ");
        for (const word of words) {
            yield word + " ";
            await new Promise((resolve) => setTimeout(resolve, 30));
        }
    }
}
