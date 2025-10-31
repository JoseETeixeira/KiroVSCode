import * as vscode from "vscode";
import { SpecManager, SpecInfo } from "../services/specManager";

/**
 * CodeLens provider for spec document navigation
 * Adds contextual navigation buttons to requirements.md, design.md, and tasks.md files
 */
export class SpecNavigatorCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> =
        this._onDidChangeCodeLenses.event;

    constructor(private specManager: SpecManager) {}

    /**
     * Refresh CodeLens display
     */
    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Provide CodeLens for spec documents
     */
    async provideCodeLenses(
        document: vscode.TextDocument
    ): Promise<vscode.CodeLens[]> {
        // Get spec info from document URI
        const specInfo = await this.specManager.getSpecInfoFromUri(
            document.uri
        );

        if (!specInfo) {
            return [];
        }

        // Create CodeLens at the top of the document
        const range = new vscode.Range(0, 0, 0, 0);
        const codeLenses: vscode.CodeLens[] = [];

        // 1. Spec name indicator
        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `📋 Spec: ${specInfo.name}`,
                command: "",
                tooltip: `Current specification: ${specInfo.name}`,
            })
        );

        // 2. Stage navigation buttons
        const stages: Array<{
            name: string;
            stage: "requirements" | "design" | "tasks";
            icon: string;
            number: string;
        }> = [
            {
                name: "Requirements",
                stage: "requirements",
                icon: "📝",
                number: "①",
            },
            { name: "Design", stage: "design", icon: "🏗️", number: "②" },
            { name: "Tasks", stage: "tasks", icon: "✅", number: "③" },
        ];

        for (const stageInfo of stages) {
            const isCurrentStage = this.isCurrentStage(
                document.uri,
                stageInfo.stage
            );
            const hasDocument = this.hasStageDocument(
                specInfo,
                stageInfo.stage
            );

            if (hasDocument) {
                // Navigation button for existing documents
                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `${stageInfo.number} ${stageInfo.name}${
                            isCurrentStage ? " (viewing)" : ""
                        }`,
                        command: isCurrentStage
                            ? ""
                            : "kiro-copilot.navigateToStage",
                        arguments: isCurrentStage
                            ? undefined
                            : [specInfo.name, stageInfo.stage],
                        tooltip: isCurrentStage
                            ? `Currently viewing ${stageInfo.name}`
                            : `Navigate to ${stageInfo.name}`,
                    })
                );
            } else {
                // Create button for missing documents
                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `${stageInfo.number} Create ${stageInfo.name}`,
                        command: `kiro-copilot.create${this.capitalize(
                            stageInfo.stage
                        )}`,
                        arguments: [specInfo.name],
                        tooltip: `Create ${stageInfo.name} document`,
                    })
                );
            }
        }

        // 3. Update stage button
        const currentStage = this.getCurrentStage(document.uri);
        if (currentStage) {
            codeLenses.push(
                new vscode.CodeLens(range, {
                    title: "🔄 Update Stage",
                    command: "kiro-copilot.updateStage",
                    arguments: [specInfo.name, currentStage],
                    tooltip: `Update ${this.capitalize(currentStage)} document`,
                })
            );
        }

        return codeLenses;
    }

    /**
     * Check if the document is for the given stage
     */
    private isCurrentStage(
        uri: vscode.Uri,
        stage: "requirements" | "design" | "tasks"
    ): boolean {
        return uri.fsPath.endsWith(`${stage}.md`);
    }

    /**
     * Get the current stage from document URI
     */
    private getCurrentStage(
        uri: vscode.Uri
    ): "requirements" | "design" | "tasks" | null {
        if (uri.fsPath.endsWith("requirements.md")) {
            return "requirements";
        }
        if (uri.fsPath.endsWith("design.md")) {
            return "design";
        }
        if (uri.fsPath.endsWith("tasks.md")) {
            return "tasks";
        }
        return null;
    }

    /**
     * Check if spec has a document for the given stage
     */
    private hasStageDocument(
        specInfo: SpecInfo,
        stage: "requirements" | "design" | "tasks"
    ): boolean {
        switch (stage) {
            case "requirements":
                return specInfo.hasRequirements;
            case "design":
                return specInfo.hasDesign;
            case "tasks":
                return specInfo.hasTasks;
        }
    }

    /**
     * Capitalize first letter of string
     */
    private capitalize(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
