/**
 * Example usage of ProgressIndicator
 * This file demonstrates how to use the ProgressIndicator class
 * to display workflow progress in various formats
 */

import { ProgressIndicator } from "./progressIndicator";
import { WorkflowProgress } from "./workflowOrchestrator";

// Example 1: Basic progress rendering
function exampleBasicProgress() {
    const indicator = new ProgressIndicator();

    const progress: WorkflowProgress = {
        workflowName: "Spec Mode",
        totalSteps: 5,
        currentStep: 2,
        currentStepName: "Design",
        status: "in-progress",
        message: "Creating technical design document",
        details: "Analyzing requirements and defining architecture",
    };

    // Render full progress display
    const markdown = indicator.renderProgress(progress);
    console.log("Full Progress Display:");
    console.log(markdown);
    console.log("\n---\n");

    // Render compact progress
    const compact = indicator.renderCompact(progress);
    console.log("Compact Progress:");
    console.log(compact);
    console.log("\n---\n");

    // Render status bar text
    const statusBar = indicator.renderStatusBar(progress);
    console.log("Status Bar:");
    console.log(statusBar);
}

// Example 2: Progress with detailed logs
function exampleProgressWithLogs() {
    const indicator = new ProgressIndicator();

    // Start tracking
    indicator.startTracking();

    // Add some logs
    indicator.addLog("Requirements", "Loading requirements.prompt.md", "info");
    indicator.addLog(
        "Requirements",
        "Generating EARS-compliant requirements",
        "info"
    );
    indicator.addLog(
        "Requirements",
        "Created requirements.md successfully",
        "info"
    );

    indicator.recordStepStart(0);

    // Simulate step completion
    setTimeout(() => {
        indicator.recordStepStart(1);
        indicator.addLog(
            "Steering Setup",
            "Checking for steering files",
            "info"
        );
        indicator.addLog(
            "Steering Setup",
            "Missing product.md, creating with template",
            "warning"
        );
    }, 1000);

    const progress: WorkflowProgress = {
        workflowName: "Spec Mode",
        totalSteps: 5,
        currentStep: 1,
        currentStepName: "Steering Setup",
        status: "in-progress",
        message: "Checking and generating steering files",
    };

    // Render with details
    const markdown = indicator.renderProgress(progress, {
        showDetails: true,
        includeTimestamps: true,
    });

    console.log("Progress with Details:");
    console.log(markdown);
}

// Example 3: Progress through multiple steps
function exampleMultiStepProgress() {
    const indicator = new ProgressIndicator();
    indicator.startTracking();

    const steps = [
        "Requirements",
        "Steering Setup",
        "Design",
        "Create Tasks",
        "Execute Tasks",
    ];

    // Simulate step 0 completed, step 1 in progress
    indicator.recordStepStart(0);
    indicator.addLog(steps[0], "Step completed successfully", "info");

    indicator.recordStepStart(1);
    indicator.addLog(steps[1], "Step started", "info");

    const progress: WorkflowProgress = {
        workflowName: "Spec Mode",
        totalSteps: steps.length,
        currentStep: 1,
        currentStepName: steps[1],
        status: "in-progress",
        message: "Analyzing workspace for steering content",
    };

    const markdown = indicator.renderProgress(progress);
    console.log("Multi-Step Progress:");
    console.log(markdown);
    console.log("\n---\n");

    // Show elapsed time
    const elapsed = indicator.getTotalElapsedTime();
    console.log(`Total elapsed time: ${elapsed}`);
}

// Example 4: Progress with approval waiting
function exampleApprovalWaiting() {
    const indicator = new ProgressIndicator();

    const progress: WorkflowProgress = {
        workflowName: "Spec Mode",
        totalSteps: 5,
        currentStep: 2,
        currentStepName: "Design",
        status: "waiting-approval",
        message: "Waiting for user approval to proceed with design phase",
    };

    const markdown = indicator.renderProgress(progress);
    console.log("Approval Waiting:");
    console.log(markdown);
}

// Example 5: Progress with error
function exampleProgressWithError() {
    const indicator = new ProgressIndicator();

    indicator.addLog("Design", "Loading design.prompt.md", "info");
    indicator.addLog("Design", "Requirements file not found", "error");
    indicator.addLog("Design", "Cannot proceed without requirements", "error");

    const progress: WorkflowProgress = {
        workflowName: "Spec Mode",
        totalSteps: 5,
        currentStep: 2,
        currentStepName: "Design",
        status: "failed",
        message: "Step failed: Requirements must be created before design",
    };

    const markdown = indicator.renderProgress(progress, {
        showDetails: true,
    });

    console.log("Progress with Error:");
    console.log(markdown);
    console.log("\n---\n");

    // Check for errors
    console.log(`Has errors: ${indicator.hasErrors()}`);
    console.log(`Error count: ${indicator.getLogsByLevel("error").length}`);
}

// Example 6: Compact mode for inline display
function exampleCompactMode() {
    const indicator = new ProgressIndicator();

    const progress: WorkflowProgress = {
        workflowName: "Spec Mode",
        totalSteps: 5,
        currentStep: 3,
        currentStepName: "Create Tasks",
        status: "in-progress",
        message: "Generating implementation task list",
    };

    const markdown = indicator.renderProgress(progress, {
        compactMode: true,
    });

    console.log("Compact Mode:");
    console.log(markdown);
}

// Run examples
if (require.main === module) {
    console.log("=== ProgressIndicator Examples ===\n");

    console.log("Example 1: Basic Progress\n");
    exampleBasicProgress();

    console.log("\n\nExample 2: Progress with Logs\n");
    exampleProgressWithLogs();

    console.log("\n\nExample 3: Multi-Step Progress\n");
    exampleMultiStepProgress();

    console.log("\n\nExample 4: Approval Waiting\n");
    exampleApprovalWaiting();

    console.log("\n\nExample 5: Progress with Error\n");
    exampleProgressWithError();

    console.log("\n\nExample 6: Compact Mode\n");
    exampleCompactMode();
}

export {
    exampleBasicProgress,
    exampleProgressWithLogs,
    exampleMultiStepProgress,
    exampleApprovalWaiting,
    exampleProgressWithError,
    exampleCompactMode,
};
