import * as vscode from "vscode";
import { TaskManager } from "./taskManager";

/**
 * Tracks task execution and automatically marks tasks as complete
 * when success indicators are detected in chat responses
 */
export class TaskCompletionTracker {
    private activeTaskContext: {
        filePath: string;
        taskNumber: number;
    } | null = null;

    constructor(
        private taskManager: TaskManager,
        private treeViewRefreshCallback?: () => void
    ) {}

    /**
     * Set the currently active task being executed
     */
    setActiveTask(filePath: string, taskNumber: number): void {
        this.activeTaskContext = { filePath, taskNumber };
        console.log(
            `[TaskCompletionTracker] Active task set: ${taskNumber} in ${filePath}`
        );
    }

    /**
     * Clear the active task context
     */
    clearActiveTask(): void {
        this.activeTaskContext = null;
        console.log(`[TaskCompletionTracker] Active task cleared`);
    }

    /**
     * Get the currently active task context
     */
    getActiveTask(): { filePath: string; taskNumber: number } | null {
        return this.activeTaskContext;
    }

    /**
     * Detect success indicators in chat response
     * Returns true if the response indicates task completion
     */
    detectTaskCompletion(responseText: string): boolean {
        const successIndicators = [
            /task\s+(?:is\s+)?complete/i,
            /successfully\s+implemented/i,
            /implementation\s+complete/i,
            /finished\s+implementing/i,
            /all\s+(?:sub-?)?tasks?\s+(?:are\s+)?complete/i,
            /✓.*complete/i,
            /✅.*complete/i,
            /done\s+implementing/i,
            /implementation\s+successful/i,
        ];

        return successIndicators.some((pattern) => pattern.test(responseText));
    }

    /**
     * Analyze chat response and mark task complete if success indicators found
     */
    async analyzeAndMarkComplete(responseText: string): Promise<boolean> {
        if (!this.activeTaskContext) {
            return false;
        }

        if (this.detectTaskCompletion(responseText)) {
            const { filePath, taskNumber } = this.activeTaskContext;

            try {
                await this.taskManager.markTaskComplete(filePath, taskNumber);

                // Refresh tree view if callback provided
                if (this.treeViewRefreshCallback) {
                    this.treeViewRefreshCallback();
                }

                // Show notification
                vscode.window.showInformationMessage(
                    `✓ Task ${taskNumber} marked as complete`
                );

                // Clear active task
                this.clearActiveTask();

                return true;
            } catch (error) {
                console.error(
                    `[TaskCompletionTracker] Failed to mark task complete:`,
                    error
                );
                return false;
            }
        }

        return false;
    }

    /**
     * Manually mark the active task as complete
     */
    async markActiveTaskComplete(): Promise<boolean> {
        if (!this.activeTaskContext) {
            vscode.window.showWarningMessage("No active task to mark complete");
            return false;
        }

        const { filePath, taskNumber } = this.activeTaskContext;

        try {
            await this.taskManager.markTaskComplete(filePath, taskNumber);

            // Refresh tree view if callback provided
            if (this.treeViewRefreshCallback) {
                this.treeViewRefreshCallback();
            }

            vscode.window.showInformationMessage(
                `✓ Task ${taskNumber} marked as complete`
            );

            this.clearActiveTask();
            return true;
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to mark task complete: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return false;
        }
    }

    /**
     * Check if a task is currently being tracked
     */
    hasActiveTask(): boolean {
        return this.activeTaskContext !== null;
    }
}
