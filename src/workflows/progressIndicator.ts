import * as vscode from "vscode";
import { WorkflowProgress } from "./workflowOrchestrator";
import { KiroMarkdownFormatter } from "../styles/kiroTheme";

/**
 * Status icons for workflow steps (using Kiro design system)
 */
const STEP_ICONS = {
    completed: "✓",
    "in-progress": "⟳",
    pending: "○",
    failed: "✗",
    "waiting-approval": "⏸",
} as const;

/**
 * Detailed log entry for verbose output
 */
export interface ProgressLogEntry {
    timestamp: Date;
    stepName: string;
    message: string;
    level: "info" | "warning" | "error";
}

/**
 * Options for rendering progress
 */
export interface ProgressRenderOptions {
    showDetails?: boolean;
    includeTimestamps?: boolean;
    compactMode?: boolean;
}

/**
 * Manages and renders visual progress indicators for multi-step workflows
 * Provides markdown-formatted progress displays with step icons and expandable details
 */
export class ProgressIndicator {
    private logs: ProgressLogEntry[] = [];
    private startTime?: Date;
    private stepStartTimes: Map<number, Date> = new Map();

    constructor() {}

    /**
     * Render progress as markdown for display in chat or UI
     * @param progress Current workflow progress state
     * @param options Rendering options
     * @returns Markdown-formatted progress display
     */
    renderProgress(
        progress: WorkflowProgress,
        options: ProgressRenderOptions = {}
    ): string {
        const { showDetails = false, compactMode = false } = options;

        let markdown = "";

        // Workflow header
        if (!compactMode) {
            markdown += KiroMarkdownFormatter.header(
                progress.workflowName,
                "⚙️"
            );
        }

        // Render step list
        markdown += this.renderStepList(progress, compactMode);

        // Add current step message if available
        if (progress.message && !compactMode) {
            markdown += `\n*${progress.message}*\n`;
        }

        // Add details section if requested
        if (showDetails && this.logs.length > 0) {
            markdown += "\n" + this.renderDetailsSection(options);
        }

        return markdown;
    }

    /**
     * Render the list of workflow steps with status icons
     */
    private renderStepList(
        progress: WorkflowProgress,
        compactMode: boolean
    ): string {
        let markdown = "";

        // Calculate step statuses
        const steps = this.generateStepStatuses(progress);

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const icon = STEP_ICONS[step.status];
            const isCurrentStep = i === progress.currentStep;

            // Format step line
            let stepLine = `${icon} ${i + 1}. ${step.name}`;

            // Highlight current step
            if (isCurrentStep && !compactMode) {
                stepLine = `**${stepLine}**`;
            }

            // Add step details for current step
            if (isCurrentStep && progress.details && !compactMode) {
                stepLine += ` - ${progress.details}`;
            }

            // Add elapsed time for completed steps
            if (
                step.status === "completed" &&
                this.stepStartTimes.has(i) &&
                !compactMode
            ) {
                const elapsed = this.getStepElapsedTime(i);
                if (elapsed) {
                    stepLine += ` *(${elapsed})*`;
                }
            }

            markdown += stepLine + "\n";
        }

        return markdown;
    }

    /**
     * Generate step statuses based on current progress
     */
    private generateStepStatuses(
        progress: WorkflowProgress
    ): Array<{ name: string; status: keyof typeof STEP_ICONS }> {
        const steps: Array<{ name: string; status: keyof typeof STEP_ICONS }> =
            [];

        for (let i = 0; i < progress.totalSteps; i++) {
            let status: keyof typeof STEP_ICONS;

            if (i < progress.currentStep) {
                status = "completed";
            } else if (i === progress.currentStep) {
                status = progress.status;
            } else {
                status = "pending";
            }

            // Use step name from progress if it's the current step
            const name =
                i === progress.currentStep
                    ? progress.currentStepName
                    : `Step ${i + 1}`;

            steps.push({ name, status });
        }

        return steps;
    }

    /**
     * Render expandable details section with verbose logs
     */
    private renderDetailsSection(options: ProgressRenderOptions): string {
        const { includeTimestamps = true } = options;

        let markdown = "\n<details>\n<summary>Show Details</summary>\n\n";
        markdown += "#### Execution Log\n\n";

        for (const log of this.logs) {
            let logLine = "";

            // Add timestamp if requested
            if (includeTimestamps) {
                const time = log.timestamp.toLocaleTimeString();
                logLine += `\`${time}\` `;
            }

            // Add level indicator
            const levelIcon = this.getLevelIcon(log.level);
            logLine += `${levelIcon} `;

            // Add step name if available
            if (log.stepName) {
                logLine += `**${log.stepName}**: `;
            }

            // Add message
            logLine += log.message;

            markdown += logLine + "\n";
        }

        markdown += "\n</details>\n";

        return markdown;
    }

    /**
     * Get icon for log level
     */
    private getLevelIcon(level: "info" | "warning" | "error"): string {
        switch (level) {
            case "info":
                return "ℹ️";
            case "warning":
                return "⚠️";
            case "error":
                return "❌";
        }
    }

    /**
     * Add a log entry for verbose output
     * @param stepName Name of the step generating the log
     * @param message Log message
     * @param level Log level (info, warning, error)
     */
    addLog(
        stepName: string,
        message: string,
        level: "info" | "warning" | "error" = "info"
    ): void {
        this.logs.push({
            timestamp: new Date(),
            stepName,
            message,
            level,
        });
    }

    /**
     * Clear all logs
     */
    clearLogs(): void {
        this.logs = [];
    }

    /**
     * Start tracking workflow execution time
     */
    startTracking(): void {
        this.startTime = new Date();
        this.stepStartTimes.clear();
    }

    /**
     * Record the start time of a step
     * @param stepIndex Index of the step
     */
    recordStepStart(stepIndex: number): void {
        this.stepStartTimes.set(stepIndex, new Date());
    }

    /**
     * Get elapsed time for a step
     * @param stepIndex Index of the step
     * @returns Formatted elapsed time string or null
     */
    private getStepElapsedTime(stepIndex: number): string | null {
        const startTime = this.stepStartTimes.get(stepIndex);
        if (!startTime) {
            return null;
        }

        const endTime = this.stepStartTimes.get(stepIndex + 1) || new Date();
        const elapsed = endTime.getTime() - startTime.getTime();

        return this.formatDuration(elapsed);
    }

    /**
     * Get total elapsed time since workflow start
     * @returns Formatted elapsed time string or null
     */
    getTotalElapsedTime(): string | null {
        if (!this.startTime) {
            return null;
        }

        const elapsed = new Date().getTime() - this.startTime.getTime();
        return this.formatDuration(elapsed);
    }

    /**
     * Format duration in milliseconds to human-readable string
     * @param ms Duration in milliseconds
     * @returns Formatted duration string
     */
    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Render progress to a VS Code chat response stream
     * @param progress Current workflow progress state
     * @param stream Chat response stream
     * @param options Rendering options
     */
    renderToStream(
        progress: WorkflowProgress,
        stream: vscode.ChatResponseStream,
        options: ProgressRenderOptions = {}
    ): void {
        const markdown = this.renderProgress(progress, options);
        stream.markdown(markdown);
    }

    /**
     * Create a compact progress summary for status bar or inline display
     * @param progress Current workflow progress state
     * @returns Compact progress string
     */
    renderCompact(progress: WorkflowProgress): string {
        const icon = STEP_ICONS[progress.status];
        const percentage = Math.round(
            (progress.currentStep / progress.totalSteps) * 100
        );

        return `${icon} ${progress.workflowName}: ${progress.currentStep}/${progress.totalSteps} (${percentage}%)`;
    }

    /**
     * Render progress as a status bar item text
     * @param progress Current workflow progress state
     * @returns Status bar text
     */
    renderStatusBar(progress: WorkflowProgress): string {
        const icon = STEP_ICONS[progress.status];
        return `${icon} ${progress.currentStepName} (${
            progress.currentStep + 1
        }/${progress.totalSteps})`;
    }

    /**
     * Reset all tracking data
     */
    reset(): void {
        this.logs = [];
        this.startTime = undefined;
        this.stepStartTimes.clear();
    }

    /**
     * Get all logs
     * @returns Array of log entries
     */
    getLogs(): ProgressLogEntry[] {
        return [...this.logs];
    }

    /**
     * Get logs filtered by level
     * @param level Log level to filter by
     * @returns Filtered array of log entries
     */
    getLogsByLevel(level: "info" | "warning" | "error"): ProgressLogEntry[] {
        return this.logs.filter((log) => log.level === level);
    }

    /**
     * Check if there are any error logs
     * @returns True if there are error logs
     */
    hasErrors(): boolean {
        return this.logs.some((log) => log.level === "error");
    }

    /**
     * Check if there are any warning logs
     * @returns True if there are warning logs
     */
    hasWarnings(): boolean {
        return this.logs.some((log) => log.level === "warning");
    }
}
