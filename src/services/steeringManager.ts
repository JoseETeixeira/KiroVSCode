import * as vscode from "vscode";
import * as path from "path";
import { FileService } from "./fileService";

/**
 * Manages steering file lifecycle and auto-generation
 * Handles product.md, tech.md, structure.md and custom steering files
 */
export class SteeringManager {
    private static readonly STEERING_DIR = ".kiro/steering";
    private static readonly FOUNDATION_FILES = [
        "product.md",
        "tech.md",
        "structure.md",
    ];

    constructor(private fileService: FileService) {}

    /**
     * Get the steering directory path
     */
    getSteeringDirectory(): string {
        return this.fileService.resolvePath(SteeringManager.STEERING_DIR);
    }

    /**
     * Get path for a specific steering file
     */
    getSteeringFilePath(filename: string): string {
        return path.join(this.getSteeringDirectory(), filename);
    }

    /**
     * Check if steering directory exists
     */
    async steeringDirectoryExists(): Promise<boolean> {
        return await this.fileService.exists(this.getSteeringDirectory());
    }

    /**
     * Ensure steering directory and foundation files exist
     * Creates directory and generates default content if missing
     */
    async ensureSteeringFiles(): Promise<{
        created: string[];
        existing: string[];
    }> {
        const steeringDir = this.getSteeringDirectory();
        const created: string[] = [];
        const existing: string[] = [];

        // Create directory if missing
        if (!(await this.fileService.exists(steeringDir))) {
            await this.fileService.ensureDirectory(steeringDir);
            console.log(`Created steering directory: ${steeringDir}`);
        }

        // Check and create foundation files
        for (const filename of SteeringManager.FOUNDATION_FILES) {
            const filePath = this.getSteeringFilePath(filename);

            if (await this.fileService.exists(filePath)) {
                // Check if file is empty or just whitespace
                const content = await this.fileService.readFile(filePath);
                if (content.trim().length === 0) {
                    // File exists but is empty - regenerate
                    const template = this.getDefaultTemplate(filename);
                    await this.fileService.writeFile(filePath, template);
                    created.push(filename);
                    console.log(`Regenerated empty steering file: ${filename}`);
                } else {
                    existing.push(filename);
                }
            } else {
                // File doesn't exist - create with template
                const template = this.getDefaultTemplate(filename);
                await this.fileService.writeFile(filePath, template);
                created.push(filename);
                console.log(`Created steering file: ${filename}`);
            }
        }

        return { created, existing };
    }

    /**
     * Get default template for a steering file
     * These are minimal templates - AI will enhance them based on workspace analysis
     */
    private getDefaultTemplate(filename: string): string {
        switch (filename) {
            case "product.md":
                return `# Product Overview

## Purpose

[Describe the purpose and goals of this project]

## Key Features

- [Feature 1]
- [Feature 2]
- [Feature 3]

## Target Users

[Describe who will use this product]

## Objectives

1. [Objective 1]
2. [Objective 2]
3. [Objective 3]
`;

            case "tech.md":
                return `# Technology Stack

## Core Technologies

[List main technologies, frameworks, and tools]

## Dependencies

[List key dependencies]

## Architecture

[Describe high-level architecture]

## Development Tools

[List development and build tools]
`;

            case "structure.md":
                return `# Project Structure and Conventions

## Directory Organization

\`\`\`
[Describe directory structure]
\`\`\`

## Naming Conventions

### Files
[Describe file naming conventions]

### Code
[Describe code naming conventions]

## Coding Standards

[Describe coding standards and best practices]
`;

            default:
                return `# ${filename
                    .replace(".md", "")
                    .replace(/[-_]/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}

[Add content here]
`;
        }
    }

    /**
     * List all steering files
     */
    async listSteeringFiles(): Promise<string[]> {
        const steeringDir = this.getSteeringDirectory();

        if (!(await this.fileService.exists(steeringDir))) {
            return [];
        }

        try {
            const files = await this.fileService.readDirectory(steeringDir);
            return files.filter((f) => f.endsWith(".md")).sort();
        } catch (error) {
            console.error("Failed to list steering files:", error);
            return [];
        }
    }

    /**
     * Get all steering file content as a map
     */
    async getAllSteeringContent(): Promise<Map<string, string>> {
        const content = new Map<string, string>();
        const files = await this.listSteeringFiles();

        for (const filename of files) {
            const filePath = this.getSteeringFilePath(filename);
            try {
                const fileContent = await this.fileService.readFile(filePath);
                content.set(filename, fileContent);
            } catch (error) {
                console.warn(
                    `Failed to read steering file ${filename}:`,
                    error
                );
            }
        }

        return content;
    }

    /**
     * Read a specific steering file
     */
    async readSteeringFile(filename: string): Promise<string> {
        const filePath = this.getSteeringFilePath(filename);

        if (!(await this.fileService.exists(filePath))) {
            throw new Error(`Steering file "${filename}" does not exist`);
        }

        return await this.fileService.readFile(filePath);
    }

    /**
     * Write or update a steering file
     */
    async writeSteeringFile(filename: string, content: string): Promise<void> {
        await this.fileService.ensureDirectory(this.getSteeringDirectory());

        const filePath = this.getSteeringFilePath(filename);
        await this.fileService.writeFile(filePath, content);

        console.log(`Updated steering file: ${filename}`);
    }

    /**
     * Delete a steering file
     */
    async deleteSteeringFile(filename: string): Promise<void> {
        const filePath = this.getSteeringFilePath(filename);

        if (!(await this.fileService.exists(filePath))) {
            throw new Error(`Steering file "${filename}" does not exist`);
        }

        await this.fileService.deleteFile(filePath);
        console.log(`Deleted steering file: ${filename}`);
    }

    /**
     * Check if steering files need attention (missing or empty)
     */
    async needsAttention(): Promise<{ missing: string[]; empty: string[] }> {
        const missing: string[] = [];
        const empty: string[] = [];

        for (const filename of SteeringManager.FOUNDATION_FILES) {
            const filePath = this.getSteeringFilePath(filename);

            if (!(await this.fileService.exists(filePath))) {
                missing.push(filename);
            } else {
                const content = await this.fileService.readFile(filePath);
                if (content.trim().length === 0) {
                    empty.push(filename);
                }
            }
        }

        return { missing, empty };
    }

    /**
     * Analyze workspace for steering generation context
     * Returns information that can be used to generate intelligent steering content
     */
    async analyzeWorkspace(): Promise<{
        hasPackageJson: boolean;
        hasReadme: boolean;
        packageJsonContent?: string;
        readmeContent?: string;
        directoryStructure: string[];
    }> {
        const workspaceRoot = this.fileService.getWorkspaceRoot();

        // Check for package.json
        const packageJsonPath = path.join(workspaceRoot, "package.json");
        const hasPackageJson = await this.fileService.exists(packageJsonPath);
        let packageJsonContent: string | undefined;

        if (hasPackageJson) {
            try {
                packageJsonContent = await this.fileService.readFile(
                    packageJsonPath
                );
            } catch (error) {
                console.warn("Failed to read package.json:", error);
            }
        }

        // Check for README
        const readmePatterns = [
            "README.md",
            "README.MD",
            "readme.md",
            "Readme.md",
        ];
        let hasReadme = false;
        let readmeContent: string | undefined;

        for (const pattern of readmePatterns) {
            const readmePath = path.join(workspaceRoot, pattern);
            if (await this.fileService.exists(readmePath)) {
                hasReadme = true;
                try {
                    readmeContent = await this.fileService.readFile(readmePath);
                    break;
                } catch (error) {
                    console.warn(`Failed to read ${pattern}:`, error);
                }
            }
        }

        // Get top-level directory structure
        const directoryStructure: string[] = [];
        try {
            const entries = await this.fileService.readDirectory(workspaceRoot);
            for (const entry of entries) {
                const entryPath = path.join(workspaceRoot, entry);
                const stats = await this.fileService.getStats(entryPath);
                if (
                    stats.isDirectory() &&
                    !entry.startsWith(".") &&
                    entry !== "node_modules"
                ) {
                    directoryStructure.push(entry);
                }
            }
        } catch (error) {
            console.warn("Failed to read directory structure:", error);
        }

        return {
            hasPackageJson,
            hasReadme,
            packageJsonContent,
            readmeContent,
            directoryStructure,
        };
    }

    /**
     * Open a steering file in editor
     */
    async openSteeringFile(
        filename: string,
        viewColumn?: vscode.ViewColumn
    ): Promise<vscode.TextEditor> {
        const filePath = this.getSteeringFilePath(filename);

        if (!(await this.fileService.exists(filePath))) {
            throw new Error(`Steering file "${filename}" does not exist`);
        }

        return await this.fileService.openFile(filePath, viewColumn);
    }

    /**
     * Open all foundation steering files for review
     * Opens files in split view for easy comparison and editing
     */
    async openAllSteeringFilesForReview(): Promise<vscode.TextEditor[]> {
        const editors: vscode.TextEditor[] = [];

        // Ensure files exist first
        await this.ensureSteeringFiles();

        // Open files in sequence with different view columns
        const viewColumns = [
            vscode.ViewColumn.One,
            vscode.ViewColumn.Two,
            vscode.ViewColumn.Three,
        ];

        for (let i = 0; i < SteeringManager.FOUNDATION_FILES.length; i++) {
            const filename = SteeringManager.FOUNDATION_FILES[i];
            const viewColumn = viewColumns[i] || vscode.ViewColumn.Active;

            try {
                const editor = await this.openSteeringFile(
                    filename,
                    viewColumn
                );
                editors.push(editor);
            } catch (error) {
                console.warn(
                    `Failed to open steering file ${filename}:`,
                    error
                );
            }
        }

        return editors;
    }

    /**
     * Get a formatted summary of steering files status
     */
    async getSteeringFilesSummary(): Promise<string> {
        const attention = await this.needsAttention();
        const files = await this.listSteeringFiles();

        let summary = "## Steering Files Status\n\n";

        if (attention.missing.length > 0) {
            summary += `**Missing files:** ${attention.missing.join(", ")}\n\n`;
        }

        if (attention.empty.length > 0) {
            summary += `**Empty files:** ${attention.empty.join(", ")}\n\n`;
        }

        if (attention.missing.length === 0 && attention.empty.length === 0) {
            summary +=
                "✅ All foundation steering files are present and populated\n\n";
        }

        summary += `**Total steering files:** ${files.length}\n`;
        summary += `**Files:** ${files.join(", ")}\n`;

        return summary;
    }

    /**
     * Validate that all foundation files have meaningful content
     * Returns true if all files exist and have more than just template headers
     */
    async validateSteeringContent(): Promise<{
        valid: boolean;
        issues: string[];
    }> {
        const issues: string[] = [];

        for (const filename of SteeringManager.FOUNDATION_FILES) {
            const filePath = this.getSteeringFilePath(filename);

            if (!(await this.fileService.exists(filePath))) {
                issues.push(`${filename} does not exist`);
                continue;
            }

            const content = await this.fileService.readFile(filePath);

            // Check if content is just the template (very short or only headers)
            const lines = content.split("\n").filter((line) => line.trim());
            const meaningfulLines = lines.filter(
                (line) =>
                    !line.startsWith("#") &&
                    !line.startsWith("[") &&
                    line.length > 10
            );

            if (meaningfulLines.length < 3) {
                issues.push(
                    `${filename} appears to have minimal content (only ${meaningfulLines.length} meaningful lines)`
                );
            }
        }

        return {
            valid: issues.length === 0,
            issues,
        };
    }
}
