import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Represents a file operation performed by the Kiro agent
 */
export interface FileOperation {
    type: "create" | "read" | "update" | "delete" | "createDirectory";
    path: string;
    content?: string;
    timestamp: Date;
    success: boolean;
    error?: string;
}

/**
 * Service for autonomous file operations by the Kiro agent
 * Tracks operation history and provides comprehensive error handling
 */
export class KiroAgentService {
    private operationHistory: FileOperation[] = [];
    private readonly MAX_RETRY_ATTEMPTS = 3;
    private readonly RETRY_DELAY_MS = 100;

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Get the workspace root path
     */
    private getWorkspaceRoot(): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error("No workspace folder is open");
        }
        return workspaceFolder.uri.fsPath;
    }

    /**
     * Resolve a path relative to workspace root
     */
    private resolvePath(filePath: string): string {
        // If path is already absolute and within workspace, use it
        if (path.isAbsolute(filePath)) {
            const workspaceRoot = this.getWorkspaceRoot();
            if (filePath.startsWith(workspaceRoot)) {
                return filePath;
            }
            throw new Error(
                `Absolute path ${filePath} is outside workspace boundaries`
            );
        }
        // Otherwise resolve relative to workspace
        return path.join(this.getWorkspaceRoot(), filePath);
    }

    /**
     * Validate that a path is within workspace boundaries
     */
    private validatePath(filePath: string): void {
        const workspaceRoot = this.getWorkspaceRoot();
        const resolvedPath = path.resolve(filePath);

        if (!resolvedPath.startsWith(workspaceRoot)) {
            throw new Error(`Path ${filePath} is outside workspace boundaries`);
        }

        // Check for directory traversal attempts
        if (filePath.includes("..")) {
            throw new Error(
                `Path ${filePath} contains invalid directory traversal`
            );
        }
    }

    /**
     * Record an operation in history
     */
    private recordOperation(operation: FileOperation): void {
        this.operationHistory.push(operation);
    }

    /**
     * Retry a file operation with exponential backoff
     */
    private async retryOperation<T>(
        operation: () => Promise<T>,
        operationType: string,
        filePath: string
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError =
                    error instanceof Error ? error : new Error(String(error));

                // Don't retry for certain error types
                if (
                    lastError.message.includes("ENOENT") ||
                    lastError.message.includes("EACCES") ||
                    lastError.message.includes("outside workspace")
                ) {
                    throw lastError;
                }

                // Wait before retrying (exponential backoff)
                if (attempt < this.MAX_RETRY_ATTEMPTS) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, this.RETRY_DELAY_MS * attempt)
                    );
                }
            }
        }

        throw new Error(
            `Failed ${operationType} on ${filePath} after ${this.MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message}`
        );
    }

    /**
     * Create a new file with content
     * Automatically creates parent directories if they don't exist
     */
    async createFile(
        filePath: string,
        content: string
    ): Promise<FileOperation> {
        const operation: FileOperation = {
            type: "create",
            path: filePath,
            content,
            timestamp: new Date(),
            success: false,
        };

        try {
            const resolvedPath = this.resolvePath(filePath);
            this.validatePath(resolvedPath);

            // Check if file already exists
            try {
                await fs.access(resolvedPath);
                throw new Error(`File ${filePath} already exists`);
            } catch (error) {
                // File doesn't exist, which is what we want
                if (
                    !(error instanceof Error) ||
                    !error.message.includes("ENOENT")
                ) {
                    throw error;
                }
            }

            await this.retryOperation(
                async () => {
                    // Ensure parent directory exists
                    const dir = path.dirname(resolvedPath);
                    await fs.mkdir(dir, { recursive: true });

                    // Create the file
                    await fs.writeFile(resolvedPath, content, "utf-8");
                },
                "create",
                filePath
            );

            operation.success = true;
        } catch (error) {
            operation.error =
                error instanceof Error ? error.message : String(error);
            operation.success = false;
        }

        this.recordOperation(operation);
        return operation;
    }

    /**
     * Read file content
     */
    async readFile(filePath: string): Promise<string> {
        const operation: FileOperation = {
            type: "read",
            path: filePath,
            timestamp: new Date(),
            success: false,
        };

        try {
            const resolvedPath = this.resolvePath(filePath);
            this.validatePath(resolvedPath);

            const content = await this.retryOperation(
                async () => {
                    try {
                        return await fs.readFile(resolvedPath, "utf-8");
                    } catch (error) {
                        if (
                            error instanceof Error &&
                            error.message.includes("ENOENT")
                        ) {
                            throw new Error(`File not found: ${filePath}`);
                        }
                        if (
                            error instanceof Error &&
                            error.message.includes("EACCES")
                        ) {
                            throw new Error(
                                `Permission denied reading file: ${filePath}`
                            );
                        }
                        throw error;
                    }
                },
                "read",
                filePath
            );

            operation.success = true;
            operation.content = content;
            this.recordOperation(operation);
            return content;
        } catch (error) {
            operation.error =
                error instanceof Error ? error.message : String(error);
            operation.success = false;
            this.recordOperation(operation);
            throw error;
        }
    }

    /**
     * Update an existing file with new content
     * Creates a backup before updating
     */
    async updateFile(
        filePath: string,
        content: string
    ): Promise<FileOperation> {
        const operation: FileOperation = {
            type: "update",
            path: filePath,
            content,
            timestamp: new Date(),
            success: false,
        };

        try {
            const resolvedPath = this.resolvePath(filePath);
            this.validatePath(resolvedPath);

            await this.retryOperation(
                async () => {
                    // Check if file exists
                    try {
                        await fs.access(resolvedPath);
                    } catch (error) {
                        throw new Error(`File not found: ${filePath}`);
                    }

                    // Create backup
                    const backupPath = `${resolvedPath}.backup`;
                    try {
                        const existingContent = await fs.readFile(
                            resolvedPath,
                            "utf-8"
                        );
                        await fs.writeFile(
                            backupPath,
                            existingContent,
                            "utf-8"
                        );
                    } catch (error) {
                        console.warn(
                            `Failed to create backup for ${filePath}:`,
                            error
                        );
                    }

                    // Update the file
                    try {
                        await fs.writeFile(resolvedPath, content, "utf-8");
                    } catch (error) {
                        // Restore from backup if update fails
                        try {
                            const backupContent = await fs.readFile(
                                backupPath,
                                "utf-8"
                            );
                            await fs.writeFile(
                                resolvedPath,
                                backupContent,
                                "utf-8"
                            );
                        } catch (restoreError) {
                            console.error(
                                `Failed to restore backup for ${filePath}:`,
                                restoreError
                            );
                        }
                        throw error;
                    }

                    // Clean up backup on success
                    try {
                        await fs.unlink(backupPath);
                    } catch (error) {
                        console.warn(
                            `Failed to delete backup for ${filePath}:`,
                            error
                        );
                    }
                },
                "update",
                filePath
            );

            operation.success = true;
        } catch (error) {
            operation.error =
                error instanceof Error ? error.message : String(error);
            operation.success = false;
        }

        this.recordOperation(operation);
        return operation;
    }

    /**
     * Delete a file
     * Requires confirmation for safety
     */
    async deleteFile(filePath: string): Promise<FileOperation> {
        const operation: FileOperation = {
            type: "delete",
            path: filePath,
            timestamp: new Date(),
            success: false,
        };

        try {
            const resolvedPath = this.resolvePath(filePath);
            this.validatePath(resolvedPath);

            // Confirm deletion with user
            const confirmation = await vscode.window.showWarningMessage(
                `Are you sure you want to delete ${filePath}?`,
                { modal: true },
                "Delete",
                "Cancel"
            );

            if (confirmation !== "Delete") {
                throw new Error("File deletion cancelled by user");
            }

            await this.retryOperation(
                async () => {
                    try {
                        await fs.unlink(resolvedPath);
                    } catch (error) {
                        if (
                            error instanceof Error &&
                            error.message.includes("ENOENT")
                        ) {
                            throw new Error(`File not found: ${filePath}`);
                        }
                        if (
                            error instanceof Error &&
                            error.message.includes("EACCES")
                        ) {
                            throw new Error(
                                `Permission denied deleting file: ${filePath}`
                            );
                        }
                        throw error;
                    }
                },
                "delete",
                filePath
            );

            operation.success = true;
        } catch (error) {
            operation.error =
                error instanceof Error ? error.message : String(error);
            operation.success = false;
        }

        this.recordOperation(operation);
        return operation;
    }

    /**
     * Create a directory
     * Creates parent directories recursively if needed
     */
    async createDirectory(dirPath: string): Promise<FileOperation> {
        const operation: FileOperation = {
            type: "createDirectory",
            path: dirPath,
            timestamp: new Date(),
            success: false,
        };

        try {
            const resolvedPath = this.resolvePath(dirPath);
            this.validatePath(resolvedPath);

            await this.retryOperation(
                async () => {
                    await fs.mkdir(resolvedPath, { recursive: true });
                },
                "createDirectory",
                dirPath
            );

            operation.success = true;
        } catch (error) {
            operation.error =
                error instanceof Error ? error.message : String(error);
            operation.success = false;
        }

        this.recordOperation(operation);
        return operation;
    }

    /**
     * Get the history of all file operations
     */
    getOperationHistory(): FileOperation[] {
        return [...this.operationHistory];
    }

    /**
     * Clear the operation history
     */
    clearHistory(): void {
        this.operationHistory = [];
    }
}
