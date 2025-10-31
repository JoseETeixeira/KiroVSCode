import * as vscode from "vscode";
import * as path from "path";
import { FileService } from "./fileService";

export interface SpecInfo {
    name: string;
    path: string;
    stage: "requirements" | "design" | "tasks";
    hasRequirements: boolean;
    hasDesign: boolean;
    hasTasks: boolean;
}

export interface SpecDocument {
    specName: string;
    stage: "requirements" | "design" | "tasks";
    filePath: string;
    content: string;
}

/**
 * Manages spec lifecycle: creation, reading, updating specs
 * Handles requirements.md, design.md, and tasks.md files
 */
export class SpecManager {
    private static readonly SPECS_DIR = ".kiro/specs";

    constructor(private fileService: FileService) {}

    /**
     * Get the specs directory path
     */
    getSpecsDirectory(): string {
        return this.fileService.resolvePath(SpecManager.SPECS_DIR);
    }

    /**
     * Get path for a specific spec
     */
    getSpecPath(specName: string): string {
        return path.join(this.getSpecsDirectory(), specName);
    }

    /**
     * Get path for a specific spec document
     */
    getSpecDocumentPath(
        specName: string,
        stage: "requirements" | "design" | "tasks"
    ): string {
        return path.join(this.getSpecPath(specName), `${stage}.md`);
    }

    /**
     * Check if specs directory exists
     */
    async specsDirectoryExists(): Promise<boolean> {
        return await this.fileService.exists(this.getSpecsDirectory());
    }

    /**
     * Ensure specs directory exists
     */
    async ensureSpecsDirectory(): Promise<void> {
        await this.fileService.ensureDirectory(this.getSpecsDirectory());
    }

    /**
     * List all specs in the workspace
     */
    async listSpecs(): Promise<string[]> {
        const specsDir = this.getSpecsDirectory();

        if (!(await this.fileService.exists(specsDir))) {
            return [];
        }

        try {
            const entries = await this.fileService.readDirectory(specsDir);
            const specs: string[] = [];

            for (const entry of entries) {
                const entryPath = path.join(specsDir, entry);
                const stats = await this.fileService.getStats(entryPath);

                if (stats.isDirectory()) {
                    specs.push(entry);
                }
            }

            return specs.sort();
        } catch (error) {
            console.error("Failed to list specs:", error);
            return [];
        }
    }

    /**
     * Get detailed information about a spec
     */
    async getSpecInfo(specName: string): Promise<SpecInfo | null> {
        const specPath = this.getSpecPath(specName);

        if (!(await this.fileService.exists(specPath))) {
            return null;
        }

        const hasRequirements = await this.fileService.exists(
            this.getSpecDocumentPath(specName, "requirements")
        );
        const hasDesign = await this.fileService.exists(
            this.getSpecDocumentPath(specName, "design")
        );
        const hasTasks = await this.fileService.exists(
            this.getSpecDocumentPath(specName, "tasks")
        );

        // Determine current stage based on what exists
        let stage: "requirements" | "design" | "tasks" = "requirements";
        if (hasTasks) {
            stage = "tasks";
        } else if (hasDesign) {
            stage = "design";
        }

        return {
            name: specName,
            path: specPath,
            stage,
            hasRequirements,
            hasDesign,
            hasTasks,
        };
    }

    /**
     * Get spec info from a document URI
     */
    async getSpecInfoFromUri(uri: vscode.Uri): Promise<SpecInfo | null> {
        const filePath = uri.fsPath;
        const relativePath = this.fileService.getRelativePath(filePath);

        // Check if file is in .kiro/specs/
        if (!relativePath.startsWith(SpecManager.SPECS_DIR)) {
            return null;
        }

        // Extract spec name and stage
        const match = relativePath.match(
            /\.kiro[\/\\]specs[\/\\]([^\/\\]+)[\/\\](requirements|design|tasks)\.md$/
        );
        if (!match) {
            return null;
        }

        const [, specName, stage] = match;
        return await this.getSpecInfo(specName);
    }

    /**
     * Create a new spec with initial structure
     */
    async createSpec(specName: string): Promise<void> {
        const specPath = this.getSpecPath(specName);

        if (await this.fileService.exists(specPath)) {
            throw new Error(`Spec "${specName}" already exists`);
        }

        await this.fileService.ensureDirectory(specPath);
        console.log(`Created spec directory: ${specPath}`);
    }

    /**
     * Create requirements document
     */
    async createRequirements(specName: string, content: string): Promise<void> {
        await this.ensureSpecExists(specName);

        const filePath = this.getSpecDocumentPath(specName, "requirements");
        await this.fileService.writeFile(filePath, content);

        console.log(`Created requirements for spec: ${specName}`);
    }

    /**
     * Create design document
     */
    async createDesign(specName: string, content: string): Promise<void> {
        await this.ensureSpecExists(specName);

        const filePath = this.getSpecDocumentPath(specName, "design");
        await this.fileService.writeFile(filePath, content);

        console.log(`Created design for spec: ${specName}`);
    }

    /**
     * Create tasks document
     */
    async createTasks(specName: string, content: string): Promise<void> {
        await this.ensureSpecExists(specName);

        const filePath = this.getSpecDocumentPath(specName, "tasks");
        await this.fileService.writeFile(filePath, content);

        console.log(`Created tasks for spec: ${specName}`);
    }

    /**
     * Read a spec document
     */
    async readSpecDocument(
        specName: string,
        stage: "requirements" | "design" | "tasks"
    ): Promise<string> {
        const filePath = this.getSpecDocumentPath(specName, stage);

        if (!(await this.fileService.exists(filePath))) {
            throw new Error(
                `${stage}.md does not exist for spec "${specName}"`
            );
        }

        return await this.fileService.readFile(filePath);
    }

    /**
     * Update a spec document
     */
    async updateSpecDocument(
        specName: string,
        stage: "requirements" | "design" | "tasks",
        content: string
    ): Promise<void> {
        const filePath = this.getSpecDocumentPath(specName, stage);

        if (!(await this.fileService.exists(filePath))) {
            throw new Error(
                `${stage}.md does not exist for spec "${specName}"`
            );
        }

        await this.fileService.writeFile(filePath, content);
        console.log(`Updated ${stage} for spec: ${specName}`);
    }

    /**
     * Get all documents for a spec
     */
    async getAllSpecDocuments(specName: string): Promise<Map<string, string>> {
        const documents = new Map<string, string>();
        const stages: Array<"requirements" | "design" | "tasks"> = [
            "requirements",
            "design",
            "tasks",
        ];

        for (const stage of stages) {
            const filePath = this.getSpecDocumentPath(specName, stage);

            if (await this.fileService.exists(filePath)) {
                const content = await this.fileService.readFile(filePath);
                documents.set(`${stage}.md`, content);
            }
        }

        return documents;
    }

    /**
     * Delete a spec and all its documents
     */
    async deleteSpec(specName: string): Promise<void> {
        const specPath = this.getSpecPath(specName);

        if (!(await this.fileService.exists(specPath))) {
            throw new Error(`Spec "${specName}" does not exist`);
        }

        // Delete all documents
        const stages: Array<"requirements" | "design" | "tasks"> = [
            "requirements",
            "design",
            "tasks",
        ];
        for (const stage of stages) {
            const filePath = this.getSpecDocumentPath(specName, stage);
            if (await this.fileService.exists(filePath)) {
                await this.fileService.deleteFile(filePath);
            }
        }

        // Note: We don't delete the directory itself to avoid issues with VS Code
        console.log(`Deleted documents for spec: ${specName}`);
    }

    /**
     * Open a spec document in editor
     */
    async openSpecDocument(
        specName: string,
        stage: "requirements" | "design" | "tasks",
        viewColumn?: vscode.ViewColumn
    ): Promise<vscode.TextEditor> {
        const filePath = this.getSpecDocumentPath(specName, stage);

        if (!(await this.fileService.exists(filePath))) {
            throw new Error(
                `${stage}.md does not exist for spec "${specName}"`
            );
        }

        return await this.fileService.openFile(filePath, viewColumn);
    }

    /**
     * Ensure spec directory exists
     */
    private async ensureSpecExists(specName: string): Promise<void> {
        const specPath = this.getSpecPath(specName);

        if (!(await this.fileService.exists(specPath))) {
            await this.createSpec(specName);
        }
    }
}
