import * as vscode from "vscode";
import { CodingMode, ModeManager } from "../services/modeManager";
import { SpecManager } from "../services/specManager";
import { SteeringManager } from "../services/steeringManager";
import { TaskManager } from "../services/taskManager";
import { PromptManager } from "../services/promptManager";
import { PromptOrchestrator } from "../services/promptOrchestrator";
import { ProgressIndicator } from "./progressIndicator";

/**
 * Represents a single step in a workflow
 */
export interface WorkflowStep {
    id: string;
    name: string;
    description: string;
    promptFile?: string;
    requiresApproval: boolean;
    onExecute: (context: WorkflowContext) => Promise<WorkflowStepResult>;
}

/**
 * Result of executing a workflow step
 */
export interface WorkflowStepResult {
    success: boolean;
    message?: string;
    data?: unknown;
    shouldContinue: boolean;
}

/**
 * Context passed to workflow steps during execution
 */
export interface WorkflowContext {
    mode: CodingMode;
    specName?: string;
    command?: string;
    userInput?: string;
    stepData: Map<string, unknown>;
}

/**
 * Represents a complete workflow
 */
export interface Workflow {
    name: string;
    description: string;
    steps: WorkflowStep[];
}

/**
 * Progress update emitted during workflow execution
 */
export interface WorkflowProgress {
    workflowName: string;
    totalSteps: number;
    currentStep: number;
    currentStepName: string;
    status: "in-progress" | "completed" | "failed" | "waiting-approval";
    message?: string;
    details?: string;
}

/**
 * Approval request for workflow gates
 */
export interface ApprovalRequest {
    stepName: string;
    message: string;
    options: string[];
}

/**
 * Orchestrates multi-step workflow execution based on coding mode
 * Manages workflow state, progress tracking, and approval gates
 */
export class WorkflowOrchestrator {
    private currentWorkflow?: Workflow;
    private currentStepIndex: number = 0;
    private workflowContext: WorkflowContext;
    private progressCallbacks: Array<(progress: WorkflowProgress) => void> = [];
    private approvalCallbacks: Array<
        (request: ApprovalRequest) => Promise<string>
    > = [];
    private progressIndicator: ProgressIndicator;
    private currentSessionId?: string;

    constructor(
        private modeManager: ModeManager,
        private specManager: SpecManager,
        private steeringManager: SteeringManager,
        private taskManager: TaskManager,
        private promptManager: PromptManager,
        private promptOrchestrator: PromptOrchestrator,
        private context: vscode.ExtensionContext
    ) {
        this.workflowContext = {
            mode: this.modeManager.getCurrentMode(),
            stepData: new Map(),
        };
        this.progressIndicator = new ProgressIndicator();
    }

    /**
     * Register a callback for progress updates
     */
    onProgress(callback: (progress: WorkflowProgress) => void): void {
        this.progressCallbacks.push(callback);
    }

    /**
     * Register a callback for approval requests
     */
    onApprovalRequired(
        callback: (request: ApprovalRequest) => Promise<string>
    ): void {
        this.approvalCallbacks.push(callback);
    }

    /**
     * Start a workflow based on mode and command
     */
    async startWorkflow(
        mode: CodingMode,
        command: string,
        specName?: string,
        sessionId?: string
    ): Promise<void> {
        // Store session ID for tracking
        this.currentSessionId = sessionId;

        // Initialize workflow context
        this.workflowContext = {
            mode,
            command,
            specName,
            stepData: new Map(),
        };

        // Get workflow definition for mode
        this.currentWorkflow = this.getWorkflowForMode(mode);
        this.currentStepIndex = 0;

        // Reset and start progress tracking
        this.progressIndicator.reset();
        this.progressIndicator.startTracking();

        // Persist workflow state
        await this.modeManager.startWorkflow(
            this.currentWorkflow.name,
            specName,
            this.currentWorkflow.steps.length
        );

        console.log(
            `[WorkflowOrchestrator] Started workflow: ${
                this.currentWorkflow.name
            }${sessionId ? ` (session: ${sessionId})` : ""}`
        );

        // Log workflow start
        this.progressIndicator.addLog(
            "Workflow",
            `Started workflow: ${this.currentWorkflow.name}`,
            "info"
        );

        // Execute workflow
        await this.executeWorkflow();
    }

    /**
     * Resume a workflow from saved state
     */
    async resumeWorkflow(): Promise<void> {
        const state = this.modeManager.getWorkflowState();

        if (!state || !state.currentWorkflow) {
            throw new Error("No workflow to resume");
        }

        // Restore workflow context
        this.workflowContext = {
            mode: state.mode,
            specName: state.specName,
            stepData: new Map(),
        };

        // Get workflow definition
        this.currentWorkflow = this.getWorkflowForMode(state.mode);
        this.currentStepIndex = state.currentStep || 0;

        // Reset and start progress tracking
        this.progressIndicator.reset();
        this.progressIndicator.startTracking();

        console.log(
            `[WorkflowOrchestrator] Resuming workflow: ${this.currentWorkflow.name} at step ${this.currentStepIndex}`
        );

        // Log workflow resume
        this.progressIndicator.addLog(
            "Workflow",
            `Resumed workflow: ${this.currentWorkflow.name} at step ${this.currentStepIndex}`,
            "info"
        );

        // Continue execution
        await this.executeWorkflow();
    }

    /**
     * Cancel current workflow
     */
    async cancelWorkflow(): Promise<void> {
        if (!this.currentWorkflow) {
            return;
        }

        console.log(
            `[WorkflowOrchestrator] Cancelling workflow: ${this.currentWorkflow.name}`
        );

        // Log workflow cancellation
        this.progressIndicator.addLog(
            "Workflow",
            `Cancelled workflow: ${this.currentWorkflow.name}`,
            "warning"
        );

        await this.modeManager.clearWorkflowState();
        this.currentWorkflow = undefined;
        this.currentStepIndex = 0;
        this.currentSessionId = undefined;
        this.workflowContext.stepData.clear();
        this.progressIndicator.reset();
    }

    /**
     * Execute the workflow from current step
     */
    private async executeWorkflow(): Promise<void> {
        if (!this.currentWorkflow) {
            throw new Error("No workflow to execute");
        }

        while (this.currentStepIndex < this.currentWorkflow.steps.length) {
            const step = this.currentWorkflow.steps[this.currentStepIndex];

            try {
                // Record step start time
                this.progressIndicator.recordStepStart(this.currentStepIndex);

                // Log step start
                this.progressIndicator.addLog(
                    step.name,
                    `Starting step: ${step.description}`,
                    "info"
                );

                // Emit progress update
                this.emitProgress({
                    workflowName: this.currentWorkflow.name,
                    totalSteps: this.currentWorkflow.steps.length,
                    currentStep: this.currentStepIndex,
                    currentStepName: step.name,
                    status: "in-progress",
                    message: step.description,
                });

                // Execute step
                const result = await this.executeStep(step);

                if (!result.success) {
                    // Step failed
                    this.progressIndicator.addLog(
                        step.name,
                        result.message || "Step failed",
                        "error"
                    );

                    this.emitProgress({
                        workflowName: this.currentWorkflow.name,
                        totalSteps: this.currentWorkflow.steps.length,
                        currentStep: this.currentStepIndex,
                        currentStepName: step.name,
                        status: "failed",
                        message: result.message || "Step failed",
                    });

                    await this.modeManager.clearWorkflowState();
                    return;
                }

                // Log step success
                this.progressIndicator.addLog(
                    step.name,
                    result.message || "Step completed successfully",
                    "info"
                );

                if (!result.shouldContinue) {
                    // Step requested to stop workflow
                    console.log(
                        `[WorkflowOrchestrator] Step ${step.name} requested workflow stop`
                    );
                    this.progressIndicator.addLog(
                        step.name,
                        "Workflow stopped by step request",
                        "info"
                    );
                    await this.modeManager.clearWorkflowState();
                    return;
                }

                // Handle approval gate
                if (step.requiresApproval) {
                    this.progressIndicator.addLog(
                        step.name,
                        "Waiting for user approval",
                        "info"
                    );

                    const approved = await this.requestApproval(step);

                    if (!approved) {
                        console.log(
                            `[WorkflowOrchestrator] Step ${step.name} not approved, stopping workflow`
                        );
                        this.progressIndicator.addLog(
                            step.name,
                            "Step not approved by user",
                            "warning"
                        );
                        await this.modeManager.clearWorkflowState();
                        return;
                    }

                    this.progressIndicator.addLog(
                        step.name,
                        "Step approved by user",
                        "info"
                    );
                }

                // Move to next step
                this.currentStepIndex++;
                await this.modeManager.updateWorkflowStep(
                    this.currentStepIndex
                );
            } catch (error) {
                console.error(
                    `[WorkflowOrchestrator] Error executing step ${step.name}:`,
                    error
                );

                const errorMessage =
                    error instanceof Error ? error.message : "Unknown error";

                this.progressIndicator.addLog(
                    step.name,
                    `Error: ${errorMessage}`,
                    "error"
                );

                this.emitProgress({
                    workflowName: this.currentWorkflow.name,
                    totalSteps: this.currentWorkflow.steps.length,
                    currentStep: this.currentStepIndex,
                    currentStepName: step.name,
                    status: "failed",
                    message: errorMessage,
                });

                await this.modeManager.clearWorkflowState();
                return;
            }
        }

        // Workflow completed
        const totalTime = this.progressIndicator.getTotalElapsedTime();
        const completionMessage = `Workflow completed successfully${
            totalTime ? ` in ${totalTime}` : ""
        }`;

        this.progressIndicator.addLog("Workflow", completionMessage, "info");

        this.emitProgress({
            workflowName: this.currentWorkflow.name,
            totalSteps: this.currentWorkflow.steps.length,
            currentStep: this.currentWorkflow.steps.length,
            currentStepName: "Complete",
            status: "completed",
            message: completionMessage,
        });

        await this.modeManager.completeWorkflow();
        console.log(
            `[WorkflowOrchestrator] Workflow completed: ${this.currentWorkflow.name}`
        );
    }

    /**
     * Execute a single workflow step
     */
    private async executeStep(step: WorkflowStep): Promise<WorkflowStepResult> {
        console.log(`[WorkflowOrchestrator] Executing step: ${step.name}`);

        // Load prompt if specified
        if (step.promptFile) {
            try {
                // Create template context from workflow context
                const templateContext =
                    this.promptOrchestrator.createTemplateContext({
                        specName: this.workflowContext.specName,
                        stepName: step.name,
                    });

                // Load prompt with template variable substitution
                const promptContent = await this.promptOrchestrator.loadPrompt(
                    step.promptFile,
                    templateContext
                );

                if (promptContent) {
                    this.workflowContext.stepData.set(
                        `${step.id}_prompt`,
                        promptContent
                    );
                }
            } catch (error) {
                console.warn(
                    `[WorkflowOrchestrator] Failed to load prompt for step ${step.name}:`,
                    error
                );
            }
        }

        // Execute step logic
        return await step.onExecute(this.workflowContext);
    }

    /**
     * Request approval for a workflow step
     */
    private async requestApproval(step: WorkflowStep): Promise<boolean> {
        if (this.approvalCallbacks.length === 0) {
            // No approval callback registered, use VS Code UI
            return await this.requestApprovalViaUI(step);
        }

        this.emitProgress({
            workflowName: this.currentWorkflow!.name,
            totalSteps: this.currentWorkflow!.steps.length,
            currentStep: this.currentStepIndex,
            currentStepName: step.name,
            status: "waiting-approval",
            message: `Waiting for approval: ${step.name}`,
        });

        const request: ApprovalRequest = {
            stepName: step.name,
            message: `Do you want to proceed with: ${step.name}?`,
            options: ["Approve", "Reject", "Skip"],
        };

        // Call first registered approval callback
        const response = await this.approvalCallbacks[0](request);

        return response === "Approve";
    }

    /**
     * Request approval via VS Code UI (fallback when no callback registered)
     */
    private async requestApprovalViaUI(step: WorkflowStep): Promise<boolean> {
        // Special handling for steering-check step
        if (step.id === "steering-check") {
            const needsGeneration =
                this.workflowContext.stepData.get("needsGeneration");

            if (needsGeneration) {
                const message =
                    `**Steering Setup Complete**\n\n` +
                    `I've created steering files with default templates. ` +
                    `These files provide project context for all future development.\n\n` +
                    `Would you like to:\n` +
                    `- Review and customize the files now\n` +
                    `- Generate intelligent content based on workspace analysis\n` +
                    `- Continue with current templates`;

                const choice = await vscode.window.showInformationMessage(
                    message,
                    { modal: true },
                    "Review Files",
                    "Generate Content",
                    "Continue"
                );

                if (choice === "Review Files") {
                    await vscode.commands.executeCommand(
                        "kiro-copilot.reviewSteeringFiles"
                    );
                    // Ask again after review
                    const proceed = await vscode.window.showInformationMessage(
                        "Have you finished reviewing the steering files?",
                        "Yes, Continue",
                        "Cancel Workflow"
                    );
                    return proceed === "Yes, Continue";
                } else if (choice === "Generate Content") {
                    await vscode.commands.executeCommand(
                        "kiro-copilot.generateSteeringFiles"
                    );
                    // Ask again after generation
                    const proceed = await vscode.window.showInformationMessage(
                        "Have you finished customizing the steering files?",
                        "Yes, Continue",
                        "Cancel Workflow"
                    );
                    return proceed === "Yes, Continue";
                } else if (choice === "Continue") {
                    return true;
                } else {
                    return false; // User cancelled
                }
            }
        }

        // Default approval UI for other steps
        const message = `Ready to proceed with: ${step.name}?\n\n${step.description}`;

        const choice = await vscode.window.showInformationMessage(
            message,
            { modal: true },
            "Approve",
            "Cancel"
        );

        return choice === "Approve";
    }

    /**
     * Emit progress update to all registered callbacks
     */
    private emitProgress(progress: WorkflowProgress): void {
        for (const callback of this.progressCallbacks) {
            try {
                callback(progress);
            } catch (error) {
                console.error(
                    "[WorkflowOrchestrator] Error in progress callback:",
                    error
                );
            }
        }
    }

    /**
     * Get workflow definition for a coding mode
     */
    private getWorkflowForMode(mode: CodingMode): Workflow {
        if (mode === "vibe") {
            return this.createVibeWorkflow();
        } else {
            return this.createSpecWorkflow();
        }
    }

    /**
     * Create Vibe mode workflow (single-step: execute task directly)
     */
    private createVibeWorkflow(): Workflow {
        return {
            name: "Vibe Coding",
            description:
                "Chat first, then build. Explore ideas and iterate as you discover needs.",
            steps: [
                {
                    id: "execute-task",
                    name: "Execute Task",
                    description: "Execute task with iterative exploration",
                    promptFile: "executeTask.prompt.md",
                    requiresApproval: false,
                    onExecute: async () => {
                        // In Vibe mode, we just load the prompt and let the chat handle execution
                        // The actual execution happens in the chat participant
                        return {
                            success: true,
                            shouldContinue: false, // Single-step workflow
                            message: "Ready for task execution",
                        };
                    },
                },
            ],
        };
    }

    /**
     * Create Spec mode workflow (multi-step: steering → requirements → design → tasks → execute)
     */
    private createSpecWorkflow(): Workflow {
        return {
            name: "Spec Mode",
            description:
                "Plan first, then build. Create requirements and design before coding starts.",
            steps: [
                {
                    id: "requirements",
                    name: "Requirements",
                    description:
                        "Generate requirements document using EARS format",
                    promptFile: "requirements.prompt.md",
                    requiresApproval: true,
                    onExecute: async (context) => {
                        if (!context.specName) {
                            return {
                                success: false,
                                shouldContinue: false,
                                message: "Spec name is required",
                            };
                        }

                        // Ensure spec directory exists
                        await this.specManager.createSpec(context.specName);

                        return {
                            success: true,
                            shouldContinue: true,
                            message: "Requirements step ready",
                        };
                    },
                },
                {
                    id: "steering-check",
                    name: "Steering Setup",
                    description: "Check and generate steering files if needed",
                    promptFile: "generateSteering.prompt.md",
                    requiresApproval: true,
                    onExecute: async (context) => {
                        // Check if steering files need attention
                        const attention =
                            await this.steeringManager.needsAttention();

                        if (
                            attention.missing.length > 0 ||
                            attention.empty.length > 0
                        ) {
                            // Analyze workspace for context
                            const analysis =
                                await this.steeringManager.analyzeWorkspace();

                            // Store analysis in context for prompt
                            context.stepData.set(
                                "workspace_analysis",
                                analysis
                            );
                            context.stepData.set(
                                "steering_missing",
                                attention.missing
                            );
                            context.stepData.set(
                                "steering_empty",
                                attention.empty
                            );

                            // Ensure steering files are created with templates
                            const result =
                                await this.steeringManager.ensureSteeringFiles();

                            context.stepData.set(
                                "steering_created",
                                result.created
                            );
                            context.stepData.set(
                                "steering_existing",
                                result.existing
                            );

                            // Prepare message for user
                            const filesNeedingAttention = [
                                ...attention.missing,
                                ...attention.empty,
                            ];
                            const message =
                                filesNeedingAttention.length > 0
                                    ? `Steering files need attention: ${filesNeedingAttention.join(
                                          ", "
                                      )}. ` +
                                      `I'll analyze your workspace and generate intelligent content for these files. ` +
                                      `You'll be able to review and customize them before continuing.`
                                    : `Created ${result.created.length} steering files with default templates`;

                            return {
                                success: true,
                                shouldContinue: true,
                                message,
                                data: {
                                    result,
                                    analysis,
                                    needsGeneration:
                                        filesNeedingAttention.length > 0,
                                },
                            };
                        }

                        return {
                            success: true,
                            shouldContinue: true,
                            message:
                                "Steering files already exist and are complete",
                        };
                    },
                },
                {
                    id: "design",
                    name: "Design",
                    description: "Create technical design document",
                    promptFile: "design.prompt.md",
                    requiresApproval: true,
                    onExecute: async (context) => {
                        if (!context.specName) {
                            return {
                                success: false,
                                shouldContinue: false,
                                message: "Spec name is required",
                            };
                        }

                        // Check if requirements exist
                        const specInfo = await this.specManager.getSpecInfo(
                            context.specName
                        );

                        if (!specInfo || !specInfo.hasRequirements) {
                            return {
                                success: false,
                                shouldContinue: false,
                                message:
                                    "Requirements must be created before design",
                            };
                        }

                        return {
                            success: true,
                            shouldContinue: true,
                            message: "Design step ready",
                        };
                    },
                },
                {
                    id: "create-tasks",
                    name: "Create Tasks",
                    description: "Generate implementation task list",
                    promptFile: "createTasks.prompt.md",
                    requiresApproval: true,
                    onExecute: async (context) => {
                        if (!context.specName) {
                            return {
                                success: false,
                                shouldContinue: false,
                                message: "Spec name is required",
                            };
                        }

                        // Check if design exists
                        const specInfo = await this.specManager.getSpecInfo(
                            context.specName
                        );

                        if (!specInfo || !specInfo.hasDesign) {
                            return {
                                success: false,
                                shouldContinue: false,
                                message: "Design must be created before tasks",
                            };
                        }

                        return {
                            success: true,
                            shouldContinue: true,
                            message: "Tasks step ready",
                        };
                    },
                },
                {
                    id: "execute-tasks",
                    name: "Execute Tasks",
                    description: "Execute tasks from task list",
                    promptFile: "executeTask.prompt.md",
                    requiresApproval: false,
                    onExecute: async (context) => {
                        if (!context.specName) {
                            return {
                                success: false,
                                shouldContinue: false,
                                message: "Spec name is required",
                            };
                        }

                        // Check if tasks exist
                        const specInfo = await this.specManager.getSpecInfo(
                            context.specName
                        );

                        if (!specInfo || !specInfo.hasTasks) {
                            return {
                                success: false,
                                shouldContinue: false,
                                message:
                                    "Tasks must be created before execution",
                            };
                        }

                        return {
                            success: true,
                            shouldContinue: false, // End of workflow
                            message: "Ready for task execution",
                        };
                    },
                },
            ],
        };
    }

    /**
     * Get full path to a prompt file
     */
    private async getPromptPath(promptFile: string): Promise<string> {
        const promptsPath = await this.promptManager.getPromptsPath();
        return `${promptsPath}/${promptFile}`;
    }

    /**
     * Get current workflow state
     */
    getWorkflowState(): {
        workflow?: Workflow;
        currentStep: number;
        context: WorkflowContext;
        sessionId?: string;
    } {
        return {
            workflow: this.currentWorkflow,
            currentStep: this.currentStepIndex,
            context: this.workflowContext,
            sessionId: this.currentSessionId,
        };
    }

    /**
     * Get current session ID
     */
    getCurrentSessionId(): string | undefined {
        return this.currentSessionId;
    }

    /**
     * Check if a workflow is currently running
     */
    isWorkflowRunning(): boolean {
        return this.currentWorkflow !== undefined;
    }

    /**
     * Get workflow progress percentage
     */
    getProgress(): number {
        if (!this.currentWorkflow) {
            return 0;
        }

        return Math.round(
            (this.currentStepIndex / this.currentWorkflow.steps.length) * 100
        );
    }

    /**
     * Get the progress indicator instance
     */
    getProgressIndicator(): ProgressIndicator {
        return this.progressIndicator;
    }

    /**
     * Render current progress to a chat response stream
     * @param stream Chat response stream
     * @param showDetails Whether to show detailed logs
     */
    renderProgressToStream(
        stream: vscode.ChatResponseStream,
        showDetails: boolean = false
    ): void {
        if (!this.currentWorkflow) {
            return;
        }

        const progress: WorkflowProgress = {
            workflowName: this.currentWorkflow.name,
            totalSteps: this.currentWorkflow.steps.length,
            currentStep: this.currentStepIndex,
            currentStepName:
                this.currentWorkflow.steps[this.currentStepIndex]?.name ||
                "Complete",
            status:
                this.currentStepIndex >= this.currentWorkflow.steps.length
                    ? "completed"
                    : "in-progress",
        };

        this.progressIndicator.renderToStream(progress, stream, {
            showDetails,
        });
    }

    /**
     * Get current progress state
     */
    getCurrentProgress(): WorkflowProgress | null {
        if (!this.currentWorkflow) {
            return null;
        }

        return {
            workflowName: this.currentWorkflow.name,
            totalSteps: this.currentWorkflow.steps.length,
            currentStep: this.currentStepIndex,
            currentStepName:
                this.currentWorkflow.steps[this.currentStepIndex]?.name ||
                "Complete",
            status:
                this.currentStepIndex >= this.currentWorkflow.steps.length
                    ? "completed"
                    : "in-progress",
        };
    }
}
