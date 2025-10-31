# Progress Display Integration

This document describes how the progress display is integrated with workflows in the Kiro extension.

## Overview

The progress display integration connects the `WorkflowOrchestrator` with the `ProgressIndicator` to provide real-time visual feedback during multi-step workflow execution. Progress is displayed in the chat interface and can be toggled to show detailed logs.

## Components

### 1. ProgressIndicator

Located in `src/workflows/progressIndicator.ts`, this class manages and renders visual progress indicators for multi-step workflows.

**Key Features:**

-   Renders progress as markdown with step icons (✓ ⟳ ○ ✗ ⏸)
-   Tracks execution time for each step
-   Maintains detailed logs for verbose output
-   Supports expandable "Show Details" section
-   Provides multiple rendering formats (full, compact, status bar)

**Key Methods:**

-   `renderProgress()` - Render progress as markdown
-   `renderToStream()` - Render directly to VS Code chat stream
-   `addLog()` - Add detailed log entries
-   `recordStepStart()` - Track step timing
-   `getTotalElapsedTime()` - Get workflow duration

### 2. WorkflowOrchestrator Integration

Located in `src/workflows/workflowOrchestrator.ts`, the orchestrator now integrates with ProgressIndicator.

**Integration Points:**

1. **Initialization**: Creates a ProgressIndicator instance in constructor
2. **Workflow Start**: Resets and starts progress tracking
3. **Step Execution**: Records step start times and adds logs
4. **Progress Updates**: Emits progress updates on step transitions
5. **Error Handling**: Logs errors and failures
6. **Completion**: Logs total elapsed time

**New Methods:**

-   `getProgressIndicator()` - Get the ProgressIndicator instance
-   `renderProgressToStream()` - Render progress to chat stream
-   `getCurrentProgress()` - Get current progress state

### 3. ChatParticipant Integration

Located in `src/chat/chatParticipant.ts`, the chat participant displays workflow progress.

**Integration Points:**

1. **Constructor**: Accepts WorkflowOrchestrator as optional parameter
2. **Chat Handler**: Displays progress when workflow is running
3. **Progress Display**: Renders progress with optional details

**New Methods:**

-   `displayWorkflowProgress()` - Display progress in chat stream
-   `getWorkflowOrchestrator()` - Get orchestrator instance
-   `setWorkflowOrchestrator()` - Set orchestrator instance

### 4. Extension Activation

Located in `src/extension.ts`, the extension wires everything together.

**Integration Points:**

1. **Orchestrator Creation**: Creates WorkflowOrchestrator with all dependencies
2. **Progress Callback**: Registers callback for real-time progress updates
3. **ChatParticipant**: Passes orchestrator to chat participant
4. **Commands**: Adds `showWorkflowProgress` command

## Usage

### Displaying Progress in Chat

When a workflow is running, progress is automatically displayed in the chat interface:

```
### Spec Mode

✓ 1. Requirements
✓ 2. Steering Setup
⟳ 3. Design (in progress...)
○ 4. Create Tasks
○ 5. Execute Tasks

*Creating technical design document*
```

### Showing Detailed Logs

Users can expand the "Show Details" section to see verbose logs:

```
<details>
<summary>Show Details</summary>

#### Execution Log

`10:30:15` ℹ️ **Workflow**: Started workflow: Spec Mode
`10:30:16` ℹ️ **Requirements**: Starting step: Generate requirements document using EARS format
`10:30:45` ℹ️ **Requirements**: Step completed successfully (29s)
`10:30:46` ℹ️ **Steering Setup**: Starting step: Check and generate steering files if needed
`10:31:02` ℹ️ **Steering Setup**: Step completed successfully (16s)
`10:31:03` ℹ️ **Design**: Starting step: Create technical design document

</details>
```

### Commands

-   `kiro-copilot.showWorkflowStatus` - Show workflow status summary
-   `kiro-copilot.showWorkflowProgress` - Open chat with detailed progress

## Progress Callback

The WorkflowOrchestrator emits progress updates through registered callbacks:

```typescript
workflowOrchestrator.onProgress((progress) => {
    console.log(
        `${progress.workflowName}: Step ${progress.currentStep + 1}/${
            progress.totalSteps
        }`
    );

    if (progress.status === "completed") {
        vscode.window.showInformationMessage(`✓ Workflow completed!`);
    }
});
```

## Progress States

The progress indicator supports the following states:

-   `in-progress` (⟳) - Step is currently executing
-   `completed` (✓) - Step completed successfully
-   `failed` (✗) - Step failed with error
-   `waiting-approval` (⏸) - Waiting for user approval
-   `pending` (○) - Step not yet started

## Real-Time Updates

Progress updates are emitted at key points:

1. **Workflow Start**: Initial progress with all steps pending
2. **Step Start**: Step transitions to in-progress
3. **Step Complete**: Step transitions to completed
4. **Step Failed**: Step transitions to failed
5. **Approval Required**: Step transitions to waiting-approval
6. **Workflow Complete**: All steps completed

## Performance Considerations

-   Progress rendering is lightweight (markdown-based)
-   Logs are stored in memory during workflow execution
-   Logs are cleared when workflow completes or is cancelled
-   Step timing uses minimal overhead (Date objects)

## Future Enhancements

Potential improvements for the progress display:

1. **Persistent History**: Save progress history to disk
2. **Progress Bar UI**: Add graphical progress bar in status bar
3. **Notifications**: Configurable notifications for step completion
4. **Export Logs**: Export detailed logs to file
5. **Progress Streaming**: Stream progress updates to webview panel
6. **Estimated Time**: Calculate estimated time remaining
7. **Step Dependencies**: Visualize step dependencies in progress display

## Testing

To test the progress integration:

1. Start a Spec mode workflow: `kiro-copilot.startWorkflow`
2. Observe progress in chat interface
3. Check console logs for progress updates
4. Use `kiro-copilot.showWorkflowStatus` to see summary
5. Verify step timing and elapsed time
6. Test with workflow failures and cancellations

## Troubleshooting

**Progress not displaying:**

-   Ensure WorkflowOrchestrator is passed to ChatParticipant
-   Check that workflow is actually running
-   Verify progress callbacks are registered

**Logs not showing:**

-   Ensure `showDetails` parameter is true
-   Check that logs are being added during step execution
-   Verify ProgressIndicator is not reset prematurely

**Timing incorrect:**

-   Ensure `startTracking()` is called at workflow start
-   Verify `recordStepStart()` is called for each step
-   Check that step transitions are properly sequenced
