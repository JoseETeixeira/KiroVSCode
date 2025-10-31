import * as vscode from "vscode";

export type CodingMode = "vibe" | "spec";

export interface WorkflowState {
    mode: CodingMode;
    currentWorkflow?: string;
    currentStep?: number;
    totalSteps?: number;
    specName?: string;
    startedAt?: Date;
    lastUpdated?: Date;
}

/**
 * Manages coding mode and workflow state tracking
 * Enhanced to support workflow orchestration and state persistence
 */
export class ModeManager {
    private static readonly CONFIG_KEY = "kiroCopilot.mode";
    private static readonly WORKFLOW_STATE_KEY = "kiro.workflowState";

    constructor(private context: vscode.ExtensionContext) {}

    getCurrentMode(): CodingMode {
        const config = vscode.workspace.getConfiguration();
        return config.get<CodingMode>(ModeManager.CONFIG_KEY, "vibe");
    }

    async setMode(mode: CodingMode): Promise<void> {
        const config = vscode.workspace.getConfiguration();
        await config.update(
            ModeManager.CONFIG_KEY,
            mode,
            vscode.ConfigurationTarget.Global
        );

        // Clear workflow state when mode changes
        await this.clearWorkflowState();

        console.log(`Mode changed to: ${mode}`);
    }

    getModeDescription(mode: CodingMode): string {
        return mode === "vibe"
            ? "Chat first, then build. Explore ideas and iterate as you discover needs."
            : "Plan first, then build. Create requirements and design before coding starts.";
    }

    getModeIcon(mode: CodingMode): string {
        return mode === "vibe" ? "$(rocket)" : "$(notebook)";
    }

    getModeBenefits(mode: CodingMode): string[] {
        return mode === "vibe"
            ? [
                  "Rapid exploration and testing",
                  "Building when requirements are unclear",
                  "Implementing a task",
              ]
            : [
                  "Structured feature development",
                  "Requirements-driven development",
                  "Complex features requiring formal specs",
              ];
    }

    // Workflow State Management

    /**
     * Get current workflow state
     */
    getWorkflowState(): WorkflowState | undefined {
        const state = this.context.workspaceState.get<WorkflowState>(
            ModeManager.WORKFLOW_STATE_KEY
        );

        // Convert date strings back to Date objects
        if (state) {
            if (state.startedAt) {
                state.startedAt = new Date(state.startedAt);
            }
            if (state.lastUpdated) {
                state.lastUpdated = new Date(state.lastUpdated);
            }
        }

        return state;
    }

    /**
     * Set workflow state
     */
    async setWorkflowState(state: WorkflowState): Promise<void> {
        state.lastUpdated = new Date();

        await this.context.workspaceState.update(
            ModeManager.WORKFLOW_STATE_KEY,
            state
        );
        console.log(`Workflow state updated:`, state);
    }

    /**
     * Update workflow step
     */
    async updateWorkflowStep(
        currentStep: number,
        totalSteps?: number
    ): Promise<void> {
        const state = this.getWorkflowState();

        if (state) {
            state.currentStep = currentStep;
            if (totalSteps !== undefined) {
                state.totalSteps = totalSteps;
            }
            await this.setWorkflowState(state);
        }
    }

    /**
     * Start a new workflow
     */
    async startWorkflow(
        workflowName: string,
        specName?: string,
        totalSteps?: number
    ): Promise<void> {
        const state: WorkflowState = {
            mode: this.getCurrentMode(),
            currentWorkflow: workflowName,
            currentStep: 0,
            totalSteps,
            specName,
            startedAt: new Date(),
            lastUpdated: new Date(),
        };

        await this.setWorkflowState(state);
        console.log(`Started workflow: ${workflowName}`);
    }

    /**
     * Complete current workflow
     */
    async completeWorkflow(): Promise<void> {
        await this.clearWorkflowState();
        console.log("Workflow completed");
    }

    /**
     * Clear workflow state
     */
    async clearWorkflowState(): Promise<void> {
        await this.context.workspaceState.update(
            ModeManager.WORKFLOW_STATE_KEY,
            undefined
        );
    }

    /**
     * Check if a workflow is in progress
     */
    isWorkflowInProgress(): boolean {
        const state = this.getWorkflowState();
        return state !== undefined && state.currentWorkflow !== undefined;
    }

    /**
     * Get workflow progress percentage
     */
    getWorkflowProgress(): number {
        const state = this.getWorkflowState();

        if (!state || !state.totalSteps || state.totalSteps === 0) {
            return 0;
        }

        const currentStep = state.currentStep || 0;
        return Math.round((currentStep / state.totalSteps) * 100);
    }

    /**
     * Get workflow elapsed time in minutes
     */
    getWorkflowElapsedTime(): number {
        const state = this.getWorkflowState();

        if (!state || !state.startedAt) {
            return 0;
        }

        const now = new Date();
        const elapsed = now.getTime() - state.startedAt.getTime();
        return Math.round(elapsed / 60000); // Convert to minutes
    }
}
