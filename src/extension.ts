import * as vscode from "vscode";
import * as path from "path";
import { ModeSelectorProvider } from "./views/modeSelectorProvider";
import { TaskContextProvider } from "./views/taskContextProvider";
import {
    SpecExplorerTreeDataProvider,
    SpecTreeItem,
} from "./views/specExplorerProvider";
import { PromptManager } from "./services/promptManager";
import { PromptOrchestrator } from "./services/promptOrchestrator";
import { ChatParticipant } from "./chat/chatParticipant";
import { ModeManager } from "./services/modeManager";
import { SetupService } from "./services/setupService";
import { FileService } from "./services/fileService";
import { SpecManager } from "./services/specManager";
import { SteeringManager } from "./services/steeringManager";
import { TaskManager } from "./services/taskManager";
import { WorkflowOrchestrator } from "./workflows/workflowOrchestrator";
import { SpecNavigatorCodeLensProvider } from "./documents/specNavigatorCodeLens";
import { TaskContextMenuProvider } from "./documents/taskContextMenu";
import { TaskCompletionTracker } from "./services/taskCompletionTracker";
import { ChatPanelProvider } from "./views/chatPanelProvider";
import { KiroAgentService } from "./services/kiroAgentService";

export function activate(context: vscode.ExtensionContext) {
    console.log("Kiro-Style Copilot extension is now active");

    // Initialize core services
    const modeManager = new ModeManager(context);
    const promptManager = new PromptManager(context);
    const promptOrchestrator = new PromptOrchestrator(promptManager);
    const setupService = new SetupService(context);
    const fileService = new FileService(context);
    const kiroAgentService = new KiroAgentService(context);

    // Create status bar item for mode display
    const modeStatusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    modeStatusBarItem.command = "kiro-copilot.openModeSelector";
    modeStatusBarItem.tooltip = "Click to change Kiro coding mode";
    context.subscriptions.push(modeStatusBarItem);

    // Update status bar with current mode
    const updateModeStatusBar = () => {
        const mode = modeManager.getCurrentMode();
        const modeIcon = mode === "vibe" ? "$(rocket)" : "$(notebook)";
        const modeName = mode === "vibe" ? "Vibe" : "Spec";
        modeStatusBarItem.text = `${modeIcon} Kiro: ${modeName}`;
        modeStatusBarItem.show();
    };

    // Initial update
    updateModeStatusBar();

    // Initialize enhanced services
    const specManager = new SpecManager(fileService);
    const steeringManager = new SteeringManager(fileService);
    const taskManager = new TaskManager(fileService);

    // Initialize workflow orchestrator
    const workflowOrchestrator = new WorkflowOrchestrator(
        modeManager,
        specManager,
        steeringManager,
        taskManager,
        promptManager,
        promptOrchestrator,
        context
    );

    // Register progress callback for real-time updates
    workflowOrchestrator.onProgress((progress) => {
        console.log(
            `[WorkflowProgress] ${progress.workflowName}: Step ${
                progress.currentStep + 1
            }/${progress.totalSteps} - ${progress.currentStepName} (${
                progress.status
            })`
        );

        // Update status bar or show notification for important events
        if (progress.status === "completed") {
            vscode.window.showInformationMessage(
                `✓ Workflow "${progress.workflowName}" completed successfully!`
            );
        } else if (progress.status === "failed") {
            vscode.window.showErrorMessage(
                `✗ Workflow "${progress.workflowName}" failed: ${
                    progress.message || "Unknown error"
                }`
            );
        }
    });

    // Register chat panel view
    const chatPanelProvider = new ChatPanelProvider(
        context.extensionUri,
        context,
        modeManager,
        workflowOrchestrator,
        kiroAgentService
    );
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ChatPanelProvider.viewType,
            chatPanelProvider
        )
    );

    // Register mode selector view
    const modeSelectorProvider = new ModeSelectorProvider(modeManager);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "kiro-copilot.modeSelector",
            modeSelectorProvider
        )
    );

    // Register task context provider
    const taskContextProvider = new TaskContextProvider(
        promptManager,
        modeManager
    );
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "kiro-copilot.taskContext",
            taskContextProvider
        )
    );

    // Watch for active editor changes to update task context
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            taskContextProvider.refresh();
        })
    );

    // Register spec explorer tree view
    const specExplorerProvider = new SpecExplorerTreeDataProvider(
        specManager,
        steeringManager
    );
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider(
            "kiro-copilot.specExplorer",
            specExplorerProvider
        )
    );
    context.subscriptions.push(specExplorerProvider);

    // Initialize task completion tracker with tree view refresh callback
    const taskCompletionTracker = new TaskCompletionTracker(taskManager, () =>
        specExplorerProvider.refresh()
    );

    // Register spec navigator CodeLens provider
    const specNavigatorCodeLens = new SpecNavigatorCodeLensProvider(
        specManager
    );
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            { pattern: "**/.kiro/specs/*/*.md" },
            specNavigatorCodeLens
        )
    );

    // Watch for file changes to refresh CodeLens
    const fileWatcher = vscode.workspace.createFileSystemWatcher(
        "**/.kiro/specs/*/*.md"
    );
    fileWatcher.onDidCreate(() => specNavigatorCodeLens.refresh());
    fileWatcher.onDidDelete(() => specNavigatorCodeLens.refresh());
    context.subscriptions.push(fileWatcher);

    // Register task context menu provider
    const taskContextMenuProvider = new TaskContextMenuProvider(taskManager);
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            { pattern: "**/tasks.md" },
            taskContextMenuProvider,
            {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
            }
        )
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.switchToVibeMode",
            async () => {
                await modeManager.setMode("vibe");
                updateModeStatusBar();
                vscode.window.showInformationMessage(
                    "🎯 Switched to Vibe Coding mode - Chat first, then build!"
                );
                modeSelectorProvider.refresh();
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.switchToSpecMode",
            async () => {
                await modeManager.setMode("spec");
                updateModeStatusBar();
                vscode.window.showInformationMessage(
                    "📋 Switched to Spec mode - Plan first, then build!"
                );
                modeSelectorProvider.refresh();
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.openModeSelector",
            async () => {
                const currentMode = modeManager.getCurrentMode();
                const modes = [
                    {
                        label: "$(rocket) Vibe Coding",
                        description:
                            "Chat first, then build. Explore ideas and iterate as you discover needs.",
                        detail:
                            currentMode === "vibe" ? "✓ Currently active" : "",
                        mode: "vibe" as const,
                    },
                    {
                        label: "$(notebook) Spec",
                        description:
                            "Plan first, then build. Create requirements and design before coding starts.",
                        detail:
                            currentMode === "spec" ? "✓ Currently active" : "",
                        mode: "spec" as const,
                    },
                ];

                const selected = await vscode.window.showQuickPick(modes, {
                    placeHolder: "Select your coding mode",
                    title: "Kiro Coding Mode",
                });

                if (selected) {
                    await modeManager.setMode(selected.mode);
                    updateModeStatusBar();
                    vscode.window.showInformationMessage(
                        `Switched to ${
                            selected.mode === "vibe" ? "Vibe Coding" : "Spec"
                        } mode`
                    );
                    modeSelectorProvider.refresh();
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.startTaskFromFile",
            async (taskItem) => {
                if (!taskItem) {
                    vscode.window.showWarningMessage("No task selected");
                    return;
                }

                // Build context message with task details, steering, and spec files
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    return;
                }

                let contextMessage = `Execute this task:\n\n**Task:** ${taskItem.label}\n`;

                if (taskItem.specFolder) {
                    contextMessage += `**Spec:** ${taskItem.specFolder}\n`;
                }

                contextMessage += `**File:** ${taskItem.filePath}\n`;
                contextMessage += `**Line:** ${taskItem.lineNumber + 1}\n\n`;

                // Add note about context
                contextMessage += `Please read the following files for context:\n`;
                contextMessage += `- All files in .kiro/steering/ (project guidelines)\n`;

                if (taskItem.specFolder) {
                    contextMessage += `- .kiro/specs/${taskItem.specFolder}/requirements.md (requirements)\n`;
                    contextMessage += `- .kiro/specs/${taskItem.specFolder}/design.md (design)\n`;
                    contextMessage += `- .kiro/specs/${taskItem.specFolder}/tasks.md (all tasks)\n`;
                }

                contextMessage += `\nThen implement this task following the executeTask workflow.`;

                // Open chat with @kiro and the context message
                await vscode.commands.executeCommand(
                    "workbench.action.chat.open",
                    {
                        query: `@kiro ${contextMessage}`,
                    }
                );
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.executeTask",
            async (taskContext) => {
                if (!taskContext) {
                    vscode.window.showWarningMessage(
                        "No task context provided"
                    );
                    return;
                }

                try {
                    // Extract task context details
                    const {
                        taskNumber,
                        description,
                        filePath,
                        lineNumber,
                        isComplete,
                        task,
                    } = taskContext;

                    // Get spec name from file path
                    const specName = taskManager.getSpecNameFromPath(filePath);

                    // Build comprehensive context message
                    let contextMessage = isComplete
                        ? `Review this completed task:\n\n`
                        : `Execute this task:\n\n`;

                    contextMessage += `**Task ${taskNumber}:** ${description}\n`;

                    if (specName) {
                        contextMessage += `**Spec:** ${specName}\n`;
                    }

                    contextMessage += `**File:** ${filePath}\n`;
                    contextMessage += `**Line:** ${lineNumber + 1}\n`;

                    if (task.requirements && task.requirements.length > 0) {
                        contextMessage += `**Requirements:** ${task.requirements.join(
                            ", "
                        )}\n`;
                    }

                    if (task.optional) {
                        contextMessage += `**Note:** This is an optional task\n`;
                    }

                    contextMessage += `\n---\n\n`;

                    // Load steering files for project context
                    contextMessage += `## Project Context (Steering Files)\n\n`;
                    try {
                        const steeringContent =
                            await steeringManager.getAllSteeringContent();

                        if (steeringContent.size > 0) {
                            for (const [filename, content] of steeringContent) {
                                contextMessage += `### ${filename}\n\n`;
                                contextMessage += `\`\`\`markdown\n${content}\n\`\`\`\n\n`;
                            }
                        } else {
                            contextMessage += `*No steering files found. Consider creating them for better context.*\n\n`;
                        }
                    } catch (error) {
                        console.warn("Failed to load steering files:", error);
                        contextMessage += `*Could not load steering files.*\n\n`;
                    }

                    contextMessage += `---\n\n`;

                    // Load spec context if available
                    if (specName) {
                        contextMessage += `## Spec Context\n\n`;

                        try {
                            const specInfo = await specManager.getSpecInfo(
                                specName
                            );

                            if (specInfo) {
                                // Load requirements
                                if (specInfo.hasRequirements) {
                                    contextMessage += `### Requirements (.kiro/specs/${specName}/requirements.md)\n\n`;
                                    try {
                                        const requirementsContent =
                                            await specManager.readSpecDocument(
                                                specName,
                                                "requirements"
                                            );
                                        contextMessage += `\`\`\`markdown\n${requirementsContent}\n\`\`\`\n\n`;
                                    } catch (error) {
                                        console.warn(
                                            "Failed to load requirements:",
                                            error
                                        );
                                        contextMessage += `*Could not load requirements document.*\n\n`;
                                    }
                                }

                                // Load design
                                if (specInfo.hasDesign) {
                                    contextMessage += `### Design (.kiro/specs/${specName}/design.md)\n\n`;
                                    try {
                                        const designContent =
                                            await specManager.readSpecDocument(
                                                specName,
                                                "design"
                                            );
                                        contextMessage += `\`\`\`markdown\n${designContent}\n\`\`\`\n\n`;
                                    } catch (error) {
                                        console.warn(
                                            "Failed to load design:",
                                            error
                                        );
                                        contextMessage += `*Could not load design document.*\n\n`;
                                    }
                                }

                                // Load all tasks for context
                                if (specInfo.hasTasks) {
                                    contextMessage += `### All Tasks (.kiro/specs/${specName}/tasks.md)\n\n`;
                                    try {
                                        const tasksContent =
                                            await specManager.readSpecDocument(
                                                specName,
                                                "tasks"
                                            );
                                        contextMessage += `\`\`\`markdown\n${tasksContent}\n\`\`\`\n\n`;
                                    } catch (error) {
                                        console.warn(
                                            "Failed to load tasks:",
                                            error
                                        );
                                        contextMessage += `*Could not load tasks document.*\n\n`;
                                    }
                                }
                            }
                        } catch (error) {
                            console.warn("Failed to load spec context:", error);
                            contextMessage += `*Could not load spec documents.*\n\n`;
                        }

                        contextMessage += `---\n\n`;
                    }

                    // Add execution instructions
                    if (isComplete) {
                        contextMessage += `## Instructions\n\n`;
                        contextMessage += `This task is marked as complete. Please:\n`;
                        contextMessage += `1. Review the implementation\n`;
                        contextMessage += `2. Verify it meets the requirements listed above\n`;
                        contextMessage += `3. Suggest any improvements or optimizations\n`;
                        contextMessage += `4. Check for potential issues or edge cases\n`;
                    } else {
                        contextMessage += `## Instructions\n\n`;
                        contextMessage += `Please implement this task following these steps:\n`;
                        contextMessage += `1. Review the task description and requirements\n`;
                        contextMessage += `2. Review the spec context (requirements, design, tasks) above\n`;
                        contextMessage += `3. Review the project context (steering files) above\n`;
                        contextMessage += `4. Implement the task according to the requirements\n`;
                        contextMessage += `5. Follow the executeTask workflow\n`;
                        contextMessage += `6. Ensure the implementation aligns with the design and project standards\n`;
                    }

                    // Set active task for completion tracking
                    if (!isComplete) {
                        taskCompletionTracker.setActiveTask(
                            filePath,
                            taskNumber
                        );
                    }

                    // Open chat with @kiro and the comprehensive context message
                    await vscode.commands.executeCommand(
                        "workbench.action.chat.open",
                        {
                            query: `@kiro ${contextMessage}`,
                        }
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to execute task: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    // Register task completion tracking commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.markTaskComplete",
            async () => {
                await taskCompletionTracker.markActiveTaskComplete();
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("kiro-copilot.clearActiveTask", () => {
            taskCompletionTracker.clearActiveTask();
            vscode.window.showInformationMessage(
                "Active task tracking cleared"
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("kiro-copilot.showActiveTask", () => {
            const activeTask = taskCompletionTracker.getActiveTask();
            if (activeTask) {
                vscode.window.showInformationMessage(
                    `Active task: ${activeTask.taskNumber} in ${path.basename(
                        activeTask.filePath
                    )}`
                );
            } else {
                vscode.window.showInformationMessage(
                    "No active task being tracked"
                );
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.refreshModeSelector",
            () => {
                modeSelectorProvider.refresh();
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.refreshTaskContext",
            () => {
                taskContextProvider.refresh();
            }
        )
    );

    // Register workflow commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.startWorkflow",
            async (specName?: string) => {
                const mode = modeManager.getCurrentMode();

                // If spec mode and no spec name provided, prompt for it
                if (mode === "spec" && !specName) {
                    specName = await vscode.window.showInputBox({
                        prompt: "Enter spec name (e.g., user-authentication)",
                        placeHolder: "my-feature",
                        validateInput: (value) => {
                            if (!value || value.trim().length === 0) {
                                return "Spec name is required";
                            }
                            if (!/^[a-z0-9-]+$/.test(value)) {
                                return "Spec name must be lowercase with hyphens (e.g., my-feature)";
                            }
                            return null;
                        },
                    });

                    if (!specName) {
                        return; // User cancelled
                    }
                }

                try {
                    await workflowOrchestrator.startWorkflow(
                        mode,
                        "start",
                        specName
                    );
                    vscode.window.showInformationMessage(
                        `Started ${mode === "vibe" ? "Vibe" : "Spec"} workflow${
                            specName ? ` for ${specName}` : ""
                        }`
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to start workflow: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.resumeWorkflow",
            async () => {
                try {
                    if (!modeManager.isWorkflowInProgress()) {
                        vscode.window.showInformationMessage(
                            "No workflow to resume"
                        );
                        return;
                    }

                    await workflowOrchestrator.resumeWorkflow();
                    vscode.window.showInformationMessage("Resumed workflow");
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to resume workflow: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.cancelWorkflow",
            async () => {
                try {
                    if (!workflowOrchestrator.isWorkflowRunning()) {
                        vscode.window.showInformationMessage(
                            "No workflow is running"
                        );
                        return;
                    }

                    const confirm = await vscode.window.showWarningMessage(
                        "Are you sure you want to cancel the current workflow?",
                        "Yes",
                        "No"
                    );

                    if (confirm === "Yes") {
                        await workflowOrchestrator.cancelWorkflow();
                        vscode.window.showInformationMessage(
                            "Workflow cancelled"
                        );
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to cancel workflow: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.showWorkflowStatus",
            async () => {
                const state = workflowOrchestrator.getWorkflowState();

                if (!state.workflow) {
                    vscode.window.showInformationMessage(
                        "No workflow is running"
                    );
                    return;
                }

                const progress = workflowOrchestrator.getProgress();
                const elapsed = modeManager.getWorkflowElapsedTime();
                const totalSteps = state.workflow.steps.length;
                const currentStepIndex = state.currentStep;

                // Calculate estimated remaining time
                const avgTimePerStep =
                    currentStepIndex > 0 ? elapsed / currentStepIndex : 0;
                const remainingSteps = totalSteps - currentStepIndex;
                const estimatedRemaining =
                    avgTimePerStep > 0
                        ? Math.round(avgTimePerStep * remainingSteps)
                        : null;

                // Build step summary
                let stepSummary = "\n\n**Steps:**\n";

                // Completed steps
                const completedSteps = state.workflow.steps.slice(
                    0,
                    currentStepIndex
                );
                if (completedSteps.length > 0) {
                    stepSummary += "\n*Completed:*\n";
                    completedSteps.forEach((step, index) => {
                        stepSummary += `  ✓ ${index + 1}. ${step.name}\n`;
                    });
                }

                // Current step
                const currentStep = state.workflow.steps[currentStepIndex];
                if (currentStep) {
                    stepSummary += `\n*Current:*\n`;
                    stepSummary += `  ⟳ ${currentStepIndex + 1}. ${
                        currentStep.name
                    }\n`;
                    stepSummary += `     ${currentStep.description}\n`;
                }

                // Upcoming steps
                const upcomingSteps = state.workflow.steps.slice(
                    currentStepIndex + 1
                );
                if (upcomingSteps.length > 0) {
                    stepSummary += `\n*Upcoming:*\n`;
                    upcomingSteps.forEach((step, index) => {
                        stepSummary += `  ○ ${currentStepIndex + index + 2}. ${
                            step.name
                        }\n`;
                    });
                }

                // Build complete message
                const message =
                    `**Workflow Status**\n\n` +
                    `**Name:** ${state.workflow.name}\n` +
                    `**Progress:** ${progress}% (Step ${
                        currentStepIndex + 1
                    }/${totalSteps})\n` +
                    `**Spec:** ${state.context.specName || "N/A"}\n` +
                    `**Elapsed Time:** ${elapsed} minutes\n` +
                    `**Estimated Remaining:** ${
                        estimatedRemaining !== null
                            ? `${estimatedRemaining} minutes`
                            : "Calculating..."
                    }\n` +
                    stepSummary;

                // Show message with resume option if workflow is interrupted
                const isInterrupted = !workflowOrchestrator.isWorkflowRunning();
                const buttons = isInterrupted
                    ? ["Resume Workflow", "Cancel Workflow", "Close"]
                    : ["Close"];

                const choice = await vscode.window.showInformationMessage(
                    message,
                    { modal: true },
                    ...buttons
                );

                if (choice === "Resume Workflow") {
                    await vscode.commands.executeCommand(
                        "kiro-copilot.resumeWorkflow"
                    );
                } else if (choice === "Cancel Workflow") {
                    await vscode.commands.executeCommand(
                        "kiro-copilot.cancelWorkflow"
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.showWorkflowProgress",
            async () => {
                if (!workflowOrchestrator.isWorkflowRunning()) {
                    vscode.window.showInformationMessage(
                        "No workflow is currently running"
                    );
                    return;
                }

                // Open chat and display progress with details
                await vscode.commands.executeCommand(
                    "workbench.action.chat.open",
                    {
                        query: "@kiro Show me the current workflow progress with details",
                    }
                );
            }
        )
    );

    // Register steering file management commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.reviewSteeringFiles",
            async () => {
                try {
                    // Open all steering files for review
                    const editors =
                        await steeringManager.openAllSteeringFilesForReview();

                    if (editors.length > 0) {
                        vscode.window.showInformationMessage(
                            `Opened ${editors.length} steering files for review. Edit them as needed, then save your changes.`
                        );
                    } else {
                        vscode.window.showWarningMessage(
                            "No steering files found to review"
                        );
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to open steering files: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.generateSteeringFiles",
            async () => {
                try {
                    // Check if files need attention
                    const attention = await steeringManager.needsAttention();

                    if (
                        attention.missing.length === 0 &&
                        attention.empty.length === 0
                    ) {
                        const overwrite =
                            await vscode.window.showWarningMessage(
                                "Steering files already exist. Do you want to regenerate them?",
                                "Yes",
                                "No"
                            );

                        if (overwrite !== "Yes") {
                            return;
                        }
                    }

                    // Analyze workspace
                    const analysis = await steeringManager.analyzeWorkspace();

                    // Show analysis summary
                    const summary =
                        `**Workspace Analysis:**\n` +
                        `- Package.json: ${
                            analysis.hasPackageJson ? "✓" : "✗"
                        }\n` +
                        `- README: ${analysis.hasReadme ? "✓" : "✗"}\n` +
                        `- Directories: ${analysis.directoryStructure.join(
                            ", "
                        )}\n\n` +
                        `I'll generate intelligent steering files based on this analysis. ` +
                        `You can review and customize them after generation.`;

                    vscode.window.showInformationMessage(summary);

                    // Ensure steering files with templates
                    const result = await steeringManager.ensureSteeringFiles();

                    // Open files for review
                    await steeringManager.openAllSteeringFilesForReview();

                    vscode.window
                        .showInformationMessage(
                            `Created ${result.created.length} steering files. Please review and enhance them with project-specific details.`,
                            "Open Chat to Generate Content"
                        )
                        .then((selection) => {
                            if (selection === "Open Chat to Generate Content") {
                                // Open chat with steering generation prompt
                                vscode.commands.executeCommand(
                                    "workbench.action.chat.open",
                                    {
                                        query: `@kiro I need help generating intelligent content for my steering files. Please analyze my workspace and enhance the steering files in .kiro/steering/ with specific, contextual information about my project.`,
                                    }
                                );
                            }
                        });
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to generate steering files: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.validateSteeringFiles",
            async () => {
                try {
                    const validation =
                        await steeringManager.validateSteeringContent();

                    if (validation.valid) {
                        vscode.window.showInformationMessage(
                            "✓ All steering files are valid and have meaningful content"
                        );
                    } else {
                        const message =
                            "⚠️ Steering files need attention:\n\n" +
                            validation.issues.join("\n");

                        vscode.window
                            .showWarningMessage(
                                message,
                                "Review Files",
                                "Generate Content"
                            )
                            .then((selection) => {
                                if (selection === "Review Files") {
                                    vscode.commands.executeCommand(
                                        "kiro-copilot.reviewSteeringFiles"
                                    );
                                } else if (selection === "Generate Content") {
                                    vscode.commands.executeCommand(
                                        "kiro-copilot.generateSteeringFiles"
                                    );
                                }
                            });
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to validate steering files: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    // Register spec explorer commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.openSpecDocument",
            async (
                specName: string,
                stage: "requirements" | "design" | "tasks"
            ) => {
                try {
                    await specManager.openSpecDocument(specName, stage);
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to open ${stage}.md: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.openSteeringFile",
            async (filename: string) => {
                try {
                    await steeringManager.openSteeringFile(filename);
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to open ${filename}: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.refreshSpecExplorer",
            () => {
                specExplorerProvider.refresh();
            }
        )
    );

    // Register spec context menu commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.refineRequirements",
            async (specItem: SpecTreeItem) => {
                const specName = specItem.specName;
                if (!specName) {
                    vscode.window.showErrorMessage("Invalid spec item");
                    return;
                }

                try {
                    // Check if requirements exist
                    const specInfo = await specManager.getSpecInfo(specName);
                    if (!specInfo?.hasRequirements) {
                        const create =
                            await vscode.window.showInformationMessage(
                                `Requirements document doesn't exist for "${specName}". Create it first?`,
                                "Create Requirements",
                                "Cancel"
                            );
                        if (create === "Create Requirements") {
                            await vscode.commands.executeCommand(
                                "kiro-copilot.createRequirements",
                                specName
                            );
                        }
                        return;
                    }

                    // Open requirements document
                    await specManager.openSpecDocument(
                        specName,
                        "requirements"
                    );

                    // Open chat with refinement prompt
                    await vscode.commands.executeCommand(
                        "workbench.action.chat.open",
                        {
                            query: `@kiro I want to refine the requirements for the "${specName}" spec. Please review .kiro/specs/${specName}/requirements.md and help me improve it. What changes would you suggest?`,
                        }
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to refine requirements: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.updateDesign",
            async (specItem: SpecTreeItem) => {
                const specName = specItem.specName;
                if (!specName) {
                    vscode.window.showErrorMessage("Invalid spec item");
                    return;
                }

                try {
                    // Check if design exists
                    const specInfo = await specManager.getSpecInfo(specName);
                    if (!specInfo?.hasDesign) {
                        const create =
                            await vscode.window.showInformationMessage(
                                `Design document doesn't exist for "${specName}". Create it first?`,
                                "Create Design",
                                "Cancel"
                            );
                        if (create === "Create Design") {
                            await vscode.commands.executeCommand(
                                "kiro-copilot.createDesign",
                                specName
                            );
                        }
                        return;
                    }

                    // Open design document
                    await specManager.openSpecDocument(specName, "design");

                    // Open chat with update prompt
                    await vscode.commands.executeCommand(
                        "workbench.action.chat.open",
                        {
                            query: `@kiro I want to update the design for the "${specName}" spec. Please review .kiro/specs/${specName}/design.md and help me enhance it. What improvements would you recommend?`,
                        }
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to update design: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.manageTasks",
            async (specItem: SpecTreeItem) => {
                const specName = specItem.specName;
                if (!specName) {
                    vscode.window.showErrorMessage("Invalid spec item");
                    return;
                }

                try {
                    // Check if tasks exist
                    const specInfo = await specManager.getSpecInfo(specName);
                    if (!specInfo?.hasTasks) {
                        const create =
                            await vscode.window.showInformationMessage(
                                `Tasks document doesn't exist for "${specName}". Create it first?`,
                                "Create Tasks",
                                "Cancel"
                            );
                        if (create === "Create Tasks") {
                            await vscode.commands.executeCommand(
                                "kiro-copilot.createTasks",
                                specName
                            );
                        }
                        return;
                    }

                    // Open tasks document
                    await specManager.openSpecDocument(specName, "tasks");

                    // Open chat with management prompt
                    await vscode.commands.executeCommand(
                        "workbench.action.chat.open",
                        {
                            query: `@kiro I want to manage the tasks for the "${specName}" spec. Please review .kiro/specs/${specName}/tasks.md. I can help you add, modify, or reorganize tasks.`,
                        }
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to manage tasks: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.createRequirements",
            async (specName: string) => {
                if (!specName) {
                    vscode.window.showErrorMessage("Spec name is required");
                    return;
                }

                try {
                    // Check if already exists
                    const specInfo = await specManager.getSpecInfo(specName);
                    if (specInfo?.hasRequirements) {
                        vscode.window.showWarningMessage(
                            `Requirements already exist for "${specName}"`
                        );
                        await specManager.openSpecDocument(
                            specName,
                            "requirements"
                        );
                        return;
                    }

                    // Open chat to create requirements
                    await vscode.commands.executeCommand(
                        "workbench.action.chat.open",
                        {
                            query: `@kiro I want to create requirements for a new spec called "${specName}". Please help me create a requirements.md document following the EARS format with user stories and acceptance criteria.`,
                        }
                    );

                    vscode.window.showInformationMessage(
                        `Starting requirements creation for "${specName}". Follow the chat prompts to complete the document.`
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to create requirements: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.createDesign",
            async (specName: string) => {
                if (!specName) {
                    vscode.window.showErrorMessage("Spec name is required");
                    return;
                }

                try {
                    // Check if already exists
                    const specInfo = await specManager.getSpecInfo(specName);
                    if (specInfo?.hasDesign) {
                        vscode.window.showWarningMessage(
                            `Design already exists for "${specName}"`
                        );
                        await specManager.openSpecDocument(specName, "design");
                        return;
                    }

                    // Check if requirements exist
                    if (!specInfo?.hasRequirements) {
                        const create = await vscode.window.showWarningMessage(
                            `Requirements don't exist for "${specName}". It's recommended to create requirements first.`,
                            "Create Requirements First",
                            "Continue Anyway"
                        );
                        if (create === "Create Requirements First") {
                            await vscode.commands.executeCommand(
                                "kiro-copilot.createRequirements",
                                specName
                            );
                            return;
                        }
                    }

                    // Open chat to create design
                    await vscode.commands.executeCommand(
                        "workbench.action.chat.open",
                        {
                            query: `@kiro I want to create a design document for the "${specName}" spec. Please help me create a design.md document with architecture, components, and technical decisions${
                                specInfo?.hasRequirements
                                    ? ". Review the requirements in .kiro/specs/" +
                                      specName +
                                      "/requirements.md first"
                                    : ""
                            }.`,
                        }
                    );

                    vscode.window.showInformationMessage(
                        `Starting design creation for "${specName}". Follow the chat prompts to complete the document.`
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to create design: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.createTasks",
            async (specName: string) => {
                if (!specName) {
                    vscode.window.showErrorMessage("Spec name is required");
                    return;
                }

                try {
                    // Check if already exists
                    const specInfo = await specManager.getSpecInfo(specName);
                    if (specInfo?.hasTasks) {
                        vscode.window.showWarningMessage(
                            `Tasks already exist for "${specName}"`
                        );
                        await specManager.openSpecDocument(specName, "tasks");
                        return;
                    }

                    // Check if design exists
                    if (!specInfo?.hasDesign) {
                        const create = await vscode.window.showWarningMessage(
                            `Design doesn't exist for "${specName}". It's recommended to create design first.`,
                            "Create Design First",
                            "Continue Anyway"
                        );
                        if (create === "Create Design First") {
                            await vscode.commands.executeCommand(
                                "kiro-copilot.createDesign",
                                specName
                            );
                            return;
                        }
                    }

                    // Open chat to create tasks
                    await vscode.commands.executeCommand(
                        "workbench.action.chat.open",
                        {
                            query: `@kiro I want to create a task list for the "${specName}" spec. Please help me create a tasks.md document with a numbered checklist of implementation tasks${
                                specInfo?.hasDesign
                                    ? ". Review the design in .kiro/specs/" +
                                      specName +
                                      "/design.md first"
                                    : ""
                            }.`,
                        }
                    );

                    vscode.window.showInformationMessage(
                        `Starting task creation for "${specName}". Follow the chat prompts to complete the document.`
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to create tasks: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.deleteSpec",
            async (specItem: SpecTreeItem) => {
                const specName = specItem.specName;
                if (!specName) {
                    vscode.window.showErrorMessage("Invalid spec item");
                    return;
                }

                try {
                    // Confirmation dialog
                    const confirm = await vscode.window.showWarningMessage(
                        `Are you sure you want to delete the spec "${specName}"? This will delete all associated documents (requirements.md, design.md, tasks.md).`,
                        { modal: true },
                        "Delete",
                        "Cancel"
                    );

                    if (confirm !== "Delete") {
                        return;
                    }

                    // Delete the spec
                    await specManager.deleteSpec(specName);

                    // Refresh the tree view
                    specExplorerProvider.refresh();

                    vscode.window.showInformationMessage(
                        `Spec "${specName}" has been deleted`
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to delete spec: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    // Register spec navigation commands (for CodeLens)
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.navigateToStage",
            async (
                specName: string,
                stage: "requirements" | "design" | "tasks"
            ) => {
                try {
                    // Get current editor's view column for seamless navigation
                    const currentEditor = vscode.window.activeTextEditor;
                    const viewColumn =
                        currentEditor?.viewColumn || vscode.ViewColumn.One;

                    // Check if the document exists
                    const specInfo = await specManager.getSpecInfo(specName);

                    if (!specInfo) {
                        vscode.window.showErrorMessage(
                            `Spec "${specName}" does not exist`
                        );
                        return;
                    }

                    // Check if the specific stage document exists
                    const stageExists =
                        (stage === "requirements" &&
                            specInfo.hasRequirements) ||
                        (stage === "design" && specInfo.hasDesign) ||
                        (stage === "tasks" && specInfo.hasTasks);

                    if (!stageExists) {
                        // Prompt user to create the missing document
                        const stageNames = {
                            requirements: "Requirements",
                            design: "Design",
                            tasks: "Tasks",
                        };

                        const create =
                            await vscode.window.showInformationMessage(
                                `${stageNames[stage]} document doesn't exist for "${specName}". Would you like to create it?`,
                                `Create ${stageNames[stage]}`,
                                "Cancel"
                            );

                        if (create === `Create ${stageNames[stage]}`) {
                            // Trigger the appropriate creation command
                            const createCommands = {
                                requirements: "kiro-copilot.createRequirements",
                                design: "kiro-copilot.createDesign",
                                tasks: "kiro-copilot.createTasks",
                            };

                            await vscode.commands.executeCommand(
                                createCommands[stage],
                                specName
                            );
                        }
                        return;
                    }

                    // Open the document in the same editor group
                    await specManager.openSpecDocument(
                        specName,
                        stage,
                        viewColumn
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to navigate to ${stage}: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.updateStage",
            async (
                specName: string,
                stage: "requirements" | "design" | "tasks"
            ) => {
                try {
                    // Open the document first
                    await specManager.openSpecDocument(specName, stage);

                    // Map stage to appropriate prompt file
                    const promptFiles = {
                        requirements: "requirements.prompt.md",
                        design: "design.prompt.md",
                        tasks: "createTasks.prompt.md",
                    };

                    // Load the appropriate prompt for the stage
                    let stagePrompt = "";
                    try {
                        const promptsPath =
                            await promptManager.getPromptsPath();
                        const promptFilePath = path.join(
                            promptsPath,
                            promptFiles[stage]
                        );
                        const loadedPrompt = await promptManager.loadPromptFile(
                            promptFilePath
                        );
                        if (loadedPrompt) {
                            stagePrompt = loadedPrompt;
                        }
                    } catch (error) {
                        console.warn(
                            `Could not load prompt for ${stage}:`,
                            error
                        );
                    }

                    // Build context message with stage-specific guidance
                    const stageNames = {
                        requirements: "Requirements",
                        design: "Design",
                        tasks: "Tasks",
                    };

                    let contextMessage = `I want to update the ${stageNames[stage]} for the "${specName}" spec.\n\n`;
                    contextMessage += `**Current ${stageNames[stage]} Document:**\n`;
                    contextMessage += `File: .kiro/specs/${specName}/${stage}.md\n\n`;

                    // Add guidance based on stage
                    if (stage === "requirements") {
                        contextMessage += `Please help me refine the requirements using the EARS format. `;
                        contextMessage += `Review the current requirements and suggest improvements or help me add new requirements.\n\n`;
                    } else if (stage === "design") {
                        contextMessage += `Please help me enhance the design document. `;
                        contextMessage += `Review the architecture, components, and technical decisions. Suggest improvements or help me add new design elements.\n\n`;
                    } else if (stage === "tasks") {
                        contextMessage += `Please help me manage the task list. `;
                        contextMessage += `Review the current tasks and help me add, modify, or reorganize them based on the requirements and design.\n\n`;
                    }

                    contextMessage += `What changes would you like to make to the ${stageNames[stage]}?`;

                    // If we have a stage-specific prompt, include it as context
                    if (stagePrompt) {
                        contextMessage += `\n\n---\n\n**Workflow Guidance:**\n${stagePrompt}`;
                    }

                    // Open chat with the context message
                    await vscode.commands.executeCommand(
                        "workbench.action.chat.open",
                        {
                            query: `@kiro ${contextMessage}`,
                        }
                    );
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Failed to update ${stage}: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`
                    );
                }
            }
        )
    );

    // Register setup project command
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.setupProject",
            async () => {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    vscode.window.showErrorMessage(
                        "No workspace folder open. Please open a workspace."
                    );
                    return;
                }

                const workspacePath = workspaceFolder.uri.fsPath;

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: "Setting up Kiro",
                        cancellable: false,
                    },
                    async (progress) => {
                        progress.report({
                            message: "Checking setup status...",
                        });

                        // Setup MCP server if needed
                        if (!setupService.isMCPServerSetup(workspacePath)) {
                            progress.report({
                                message: "Setting up MCP server...",
                            });
                            const mcpResult = await setupService.setupMCPServer(
                                workspacePath
                            );
                            if (!mcpResult.success) {
                                vscode.window.showErrorMessage(
                                    mcpResult.message
                                );
                                return;
                            }
                        }

                        // Copy prompt files if needed
                        if (!setupService.arePromptFilesSetup(workspacePath)) {
                            progress.report({
                                message: "Copying prompt files...",
                            });
                            const promptResult =
                                await setupService.copyPromptFiles(
                                    workspacePath
                                );
                            if (!promptResult.success) {
                                vscode.window.showWarningMessage(
                                    promptResult.message
                                );
                            }
                        }

                        // Setup MCP config
                        progress.report({
                            message: "Updating MCP configuration...",
                        });
                        const configResult = await setupService.setupMCPConfig(
                            workspacePath
                        );

                        if (configResult.success) {
                            vscode.window
                                .showInformationMessage(
                                    "✓ Kiro setup complete! Check the terminal for installation progress. You may need to restart VS Code.",
                                    "Restart Now"
                                )
                                .then((selection) => {
                                    if (selection === "Restart Now") {
                                        vscode.commands.executeCommand(
                                            "workbench.action.reloadWindow"
                                        );
                                    }
                                });
                        } else {
                            vscode.window.showErrorMessage(
                                configResult.message
                            );
                        }
                    }
                );
            }
        )
    );

    // Register chat participant
    const chatParticipant = new ChatParticipant(
        modeManager,
        promptManager,
        taskContextProvider,
        context,
        setupService,
        workflowOrchestrator
    );
    context.subscriptions.push(chatParticipant.register());

    // Register chat session management commands
    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.viewChatSessions",
            async () => {
                const sessionManager = chatParticipant.getSessionManager();
                const sessions = sessionManager.getAllSessions();

                if (sessions.length === 0) {
                    vscode.window.showInformationMessage(
                        "No chat sessions found"
                    );
                    return;
                }

                // Build session list for quick pick
                const sessionItems = sessions.map((session) => {
                    const activeIndicator = session.isActive ? "🟢 " : "⚪ ";
                    const workflowInfo = session.workflowName
                        ? ` [${session.workflowName} ${session.currentStep}/${session.totalSteps}]`
                        : "";
                    const age = Math.round(
                        (Date.now() - session.lastActivity.getTime()) /
                            (1000 * 60)
                    );

                    return {
                        label: `${activeIndicator}${session.mode.toUpperCase()}${workflowInfo}`,
                        description: session.specName || "No spec",
                        detail: `Last activity: ${age} minutes ago | Messages: ${session.conversationHistory.length}`,
                        session,
                    };
                });

                const selected = await vscode.window.showQuickPick(
                    sessionItems,
                    {
                        placeHolder: "Select a chat session to manage",
                    }
                );

                if (selected) {
                    const action = await vscode.window.showQuickPick(
                        [
                            "Set as Active",
                            "View History",
                            "Restore Workflow",
                            "Complete Session",
                            "Delete Session",
                        ],
                        {
                            placeHolder: `Manage session: ${selected.label}`,
                        }
                    );

                    if (action === "Set as Active") {
                        sessionManager.setActiveSession(selected.session.id);
                        vscode.window.showInformationMessage(
                            "Session set as active"
                        );
                    } else if (action === "View History") {
                        const history = sessionManager.getConversationHistory(
                            selected.session.id
                        );
                        const historyText = history
                            .map(
                                (msg) =>
                                    `[${msg.role}] ${msg.content.substring(
                                        0,
                                        100
                                    )}...`
                            )
                            .join("\n");
                        vscode.window.showInformationMessage(
                            historyText || "No conversation history"
                        );
                    } else if (action === "Restore Workflow") {
                        const restored =
                            await chatParticipant.restoreSessionWorkflow(
                                selected.session.id
                            );
                        if (restored) {
                            vscode.window.showInformationMessage(
                                "Workflow restored successfully"
                            );
                        } else {
                            vscode.window.showWarningMessage(
                                "Failed to restore workflow"
                            );
                        }
                    } else if (action === "Complete Session") {
                        sessionManager.completeSession(selected.session.id);
                        vscode.window.showInformationMessage(
                            "Session completed"
                        );
                    } else if (action === "Delete Session") {
                        const confirm = await vscode.window.showWarningMessage(
                            "Are you sure you want to delete this session?",
                            "Yes",
                            "No"
                        );
                        if (confirm === "Yes") {
                            sessionManager.deleteSession(selected.session.id);
                            vscode.window.showInformationMessage(
                                "Session deleted"
                            );
                        }
                    }
                }
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.cleanupSessions",
            async () => {
                const sessionManager = chatParticipant.getSessionManager();
                sessionManager.cleanupSessions();
                vscode.window.showInformationMessage(
                    "Old chat sessions cleaned up"
                );
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            "kiro-copilot.completeCurrentSession",
            () => {
                chatParticipant.completeCurrentSession();
                vscode.window.showInformationMessage(
                    "Current chat session completed"
                );
            }
        )
    );

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get("hasShownWelcome", false);
    if (!hasShownWelcome) {
        vscode.window
            .showInformationMessage(
                "Welcome to Kiro-Style Copilot! Choose your coding mode to get started.",
                "Select Mode"
            )
            .then((selection) => {
                if (selection === "Select Mode") {
                    vscode.commands.executeCommand(
                        "kiro-copilot.openModeSelector"
                    );
                }
            });
        context.globalState.update("hasShownWelcome", true);
    }
}

export function deactivate() {
    // Cleanup is handled automatically by VS Code disposing subscriptions
    // Session state is persisted to workspace state and will be restored on next activation
    console.log("Kiro-Style Copilot extension is deactivating");
}
