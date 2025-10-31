import * as vscode from "vscode";
import * as fs from "fs/promises";
import { Stats } from "fs";
import * as path from "path";

/**
 * Centralized file I/O service for all file operations
 * Provides consistent error handling and workspace-aware file operations
 */
export class FileService {
    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Get the workspace root path
     */
    getWorkspaceRoot(): string {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error("No workspace folder is open");
        }
        return workspaceFolder.uri.fsPath;
    }

    /**
     * Resolve a path relative to workspace root
     */
    resolvePath(...pathSegments: string[]): string {
        return path.join(this.getWorkspaceRoot(), ...pathSegments);
    }

    /**
     * Check if a file or directory exists
     */
    async exists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Read file content as string
     */
    async readFile(filePath: string): Promise<string> {
        try {
            return await fs.readFile(filePath, "utf-8");
        } catch (error) {
            throw new Error(
                `Failed to read file ${filePath}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Write content to file (creates directories if needed)
     */
    async writeFile(filePath: string, content: string): Promise<void> {
        try {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            await this.ensureDirectory(dir);

            await fs.writeFile(filePath, content, "utf-8");
        } catch (error) {
            throw new Error(
                `Failed to write file ${filePath}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Append content to file
     */
    async appendFile(filePath: string, content: string): Promise<void> {
        try {
            await fs.appendFile(filePath, content, "utf-8");
        } catch (error) {
            throw new Error(
                `Failed to append to file ${filePath}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Delete a file
     */
    async deleteFile(filePath: string): Promise<void> {
        try {
            await fs.unlink(filePath);
        } catch (error) {
            throw new Error(
                `Failed to delete file ${filePath}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Create directory (recursive)
     */
    async ensureDirectory(dirPath: string): Promise<void> {
        try {
            await fs.mkdir(dirPath, { recursive: true });
        } catch (error) {
            throw new Error(
                `Failed to create directory ${dirPath}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Read directory contents
     */
    async readDirectory(dirPath: string): Promise<string[]> {
        try {
            return await fs.readdir(dirPath);
        } catch (error) {
            throw new Error(
                `Failed to read directory ${dirPath}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Get file stats
     */
    async getStats(filePath: string): Promise<Stats> {
        try {
            return await fs.stat(filePath);
        } catch (error) {
            throw new Error(
                `Failed to get stats for ${filePath}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Copy file
     */
    async copyFile(src: string, dest: string): Promise<void> {
        try {
            const destDir = path.dirname(dest);
            await this.ensureDirectory(destDir);
            await fs.copyFile(src, dest);
        } catch (error) {
            throw new Error(
                `Failed to copy file from ${src} to ${dest}: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Find files matching a pattern in a directory
     */
    async findFiles(
        dirPath: string,
        pattern: RegExp,
        maxDepth: number = 3
    ): Promise<string[]> {
        const results: string[] = [];

        async function search(
            currentPath: string,
            depth: number
        ): Promise<void> {
            if (depth > maxDepth) {
                return;
            }

            try {
                const entries = await fs.readdir(currentPath, {
                    withFileTypes: true,
                });

                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry.name);

                    if (entry.isDirectory()) {
                        // Skip node_modules and .git
                        if (
                            entry.name !== "node_modules" &&
                            entry.name !== ".git"
                        ) {
                            await search(fullPath, depth + 1);
                        }
                    } else if (entry.isFile() && pattern.test(entry.name)) {
                        results.push(fullPath);
                    }
                }
            } catch (error) {
                // Silently skip directories we can't read
                console.warn(`Cannot read directory ${currentPath}:`, error);
            }
        }

        await search(dirPath, 0);
        return results;
    }

    /**
     * Open file in editor
     */
    async openFile(
        filePath: string,
        viewColumn?: vscode.ViewColumn
    ): Promise<vscode.TextEditor> {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        return await vscode.window.showTextDocument(document, viewColumn);
    }

    /**
     * Get relative path from workspace root
     */
    getRelativePath(absolutePath: string): string {
        return path.relative(this.getWorkspaceRoot(), absolutePath);
    }
}
