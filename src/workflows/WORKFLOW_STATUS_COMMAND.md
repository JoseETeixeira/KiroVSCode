# Workflow Status Command Implementation

## Overview

The `kiro-copilot.showWorkflowStatus` command provides a comprehensive view of the current workflow execution state, including completed, current, and upcoming steps, along with time tracking and the ability to resume interrupted workflows.

## Features Implemented

### 1. Comprehensive Step Summary

The command displays:

-   **Completed Steps**: All steps that have been successfully completed (marked with ✓)
-   **Current Step**: The step currently being executed (marked with ⟳) with its description
-   **Upcoming Steps**: All remaining steps in the workflow (marked with ○)

### 2. Time Tracking

-   **Elapsed Time**: Shows how long the workflow has been running
-   **Estimated Remaining Time**: Calculates average time per step and estimates remaining time based on:
    -   Average time per completed step
    -   Number of remaining steps
    -   Shows "Calculating..." if no steps have been completed yet

### 3. Resume Interrupted Workflows

-   Detects if a workflow is interrupted (saved state exists but not currently running)
-   Provides action buttons:
    -   **Resume Workflow**: Continues the workflow from where it left off
    -   **Cancel Workflow**: Cancels the workflow and clears state
    -   **Close**: Simply closes the dialog

### 4. Progress Information

-   Workflow name and description
-   Progress percentage
-   Current step number out of total steps
-   Associated spec name (if applicable)

## Usage

### Via Command Palette

1. Open Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
2. Type "Kiro: Show Workflow Status"
3. Press Enter

### Via Code

```typescript
await vscode.commands.executeCommand("kiro-copilot.showWorkflowStatus");
```

## Example Output

```
**Workflow Status**

**Name:** Spec Mode
**Progress:** 40% (Step 2/5)
**Spec:** user-authentication
**Elapsed Time:** 8 minutes
**Estimated Remaining:** 12 minutes

**Steps:**

*Completed:*
  ✓ 1. Requirements

*Current:*
  ⟳ 2. Steering Setup
     Check and generate steering files if needed

*Upcoming:*
  ○ 3. Design
  ○ 4. Create Tasks
  ○ 5. Execute Tasks
```

## Implementation Details

### Location

-   **File**: `src/extension.ts`
-   **Command ID**: `kiro-copilot.showWorkflowStatus`
-   **Registration**: Lines 625-725 (approximately)

### Dependencies

-   `WorkflowOrchestrator.getWorkflowState()`: Gets current workflow state
-   `WorkflowOrchestrator.getProgress()`: Gets progress percentage
-   `WorkflowOrchestrator.isWorkflowRunning()`: Checks if workflow is active
-   `ModeManager.getWorkflowElapsedTime()`: Gets elapsed time in minutes

### Algorithm for Estimated Time

```typescript
const avgTimePerStep = currentStepIndex > 0 ? elapsed / currentStepIndex : 0;
const remainingSteps = totalSteps - currentStepIndex;
const estimatedRemaining =
    avgTimePerStep > 0 ? Math.round(avgTimePerStep * remainingSteps) : null;
```

## Requirements Satisfied

This implementation satisfies Requirement 5.6:

-   ✓ Display summary of completed/current/upcoming steps
-   ✓ Show time elapsed and estimated remaining time
-   ✓ Allow resuming interrupted workflows

## Related Files

-   `src/workflows/workflowOrchestrator.ts`: Core workflow orchestration
-   `src/workflows/progressIndicator.ts`: Progress rendering utilities
-   `src/services/modeManager.ts`: Workflow state persistence
-   `package.json`: Command registration (line 69-72)

## Testing

To test the command:

1. Start a Spec mode workflow:

    ```typescript
    await vscode.commands.executeCommand("kiro-copilot.startWorkflow");
    ```

2. During workflow execution, run:

    ```typescript
    await vscode.commands.executeCommand("kiro-copilot.showWorkflowStatus");
    ```

3. Verify:
    - All completed steps show with ✓
    - Current step shows with ⟳ and description
    - Upcoming steps show with ○
    - Time calculations are reasonable
    - Resume button appears if workflow is interrupted

## Future Enhancements

Potential improvements for future iterations:

-   Add step-by-step time breakdown
-   Show detailed logs for each step
-   Export workflow status to file
-   Add visual progress bar
-   Show workflow history
