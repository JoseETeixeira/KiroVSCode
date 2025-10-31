# Workflow Orchestrator

The `WorkflowOrchestrator` manages multi-step workflow execution based on the selected coding mode (Vibe or Spec).

## Features

-   **Mode-aware workflows**: Different workflow definitions for Vibe and Spec modes
-   **State persistence**: Workflow state is saved using VS Code Memento API
-   **Progress tracking**: Real-time progress updates during workflow execution
-   **Approval gates**: Steps can require user approval before proceeding
-   **Resume capability**: Workflows can be resumed after VS Code restart

## Architecture

### Workflow Components

1. **WorkflowStep**: Represents a single step in a workflow

    - `id`: Unique identifier
    - `name`: Display name
    - `description`: Step description
    - `promptFile`: Optional prompt file to load
    - `requiresApproval`: Whether step requires user approval
    - `onExecute`: Async function to execute step logic

2. **Workflow**: Complete workflow definition

    - `name`: Workflow name
    - `description`: Workflow description
    - `steps`: Array of WorkflowStep objects

3. **WorkflowContext**: Context passed to steps during execution
    - `mode`: Current coding mode
    - `specName`: Optional spec name (for Spec mode)
    - `command`: Command that triggered workflow
    - `stepData`: Map for sharing data between steps

## Workflow Definitions

### Vibe Mode Workflow

Single-step workflow for rapid, exploratory development:

```
1. Execute Task
   - Load executeTask.prompt.md
   - Execute task directly with iterative exploration
```

### Spec Mode Workflow

Multi-step workflow for structured development:

```
1. Requirements
   - Load requirements.prompt.md
   - Generate requirements document using EARS format
   - Requires approval

2. Steering Setup
   - Check for steering files
   - Create missing steering files
   - Auto-continues

3. Design
   - Load design.prompt.md
   - Create technical design document
   - Requires approval

4. Create Tasks
   - Load createTasks.prompt.md
   - Generate implementation task list
   - Requires approval

5. Execute Tasks
   - Load executeTask.prompt.md
   - Execute tasks from task list
   - Auto-continues
```

## Usage

### Starting a Workflow

```typescript
// Start Vibe mode workflow
await workflowOrchestrator.startWorkflow("vibe", "implement feature");

// Start Spec mode workflow
await workflowOrchestrator.startWorkflow(
    "spec",
    "create feature",
    "user-authentication"
);
```

### Registering Progress Callbacks

```typescript
workflowOrchestrator.onProgress((progress) => {
    console.log(
        `Step ${progress.currentStep}/${progress.totalSteps}: ${progress.currentStepName}`
    );
    console.log(`Status: ${progress.status}`);
});
```

### Registering Approval Callbacks

```typescript
workflowOrchestrator.onApprovalRequired(async (request) => {
    const response = await vscode.window.showQuickPick(request.options, {
        placeHolder: request.message,
    });
    return response || "Reject";
});
```

### Resuming a Workflow

```typescript
// Check if workflow is in progress
if (modeManager.isWorkflowInProgress()) {
    await workflowOrchestrator.resumeWorkflow();
}
```

### Cancelling a Workflow

```typescript
await workflowOrchestrator.cancelWorkflow();
```

### Checking Workflow Status

```typescript
const state = workflowOrchestrator.getWorkflowState();
const progress = workflowOrchestrator.getProgress();
const isRunning = workflowOrchestrator.isWorkflowRunning();
```

## State Persistence

Workflow state is automatically persisted using VS Code's Memento API:

-   **Workflow name**: Current workflow being executed
-   **Current step**: Index of current step
-   **Total steps**: Total number of steps
-   **Spec name**: Spec name (for Spec mode)
-   **Started at**: Workflow start timestamp
-   **Last updated**: Last state update timestamp

State is stored in `kiro.workflowState` workspace state key.

## Integration with Chat Participant

The workflow orchestrator is designed to work with the chat participant:

1. User starts a workflow via command or chat
2. Orchestrator loads appropriate prompts for each step
3. Chat participant receives prompts and executes them
4. Orchestrator tracks progress and manages state
5. Approval gates pause execution for user input
6. Workflow completes or can be resumed later

## Error Handling

-   Step execution errors are caught and logged
-   Failed steps emit progress updates with error details
-   Workflow state is cleared on failure
-   Users can retry or cancel failed workflows

## Future Enhancements

-   [ ] Parallel step execution
-   [ ] Conditional step execution
-   [ ] Custom workflow definitions
-   [ ] Workflow templates
-   [ ] Step retry logic
-   [ ] Workflow history and analytics

---

## ProgressIndicator

The `ProgressIndicator` provides visual progress displays for multi-step workflows with support for markdown rendering, detailed logs, and time tracking.

### Features

-   **Visual step icons**: Uses icons (✓ ⟳ ○ ✗ ⏸) to indicate step status
-   **Multiple display formats**: Full, compact, and status bar formats
-   **Time tracking**: Tracks execution time per step and total elapsed time
-   **Detailed logging**: Maintains logs with timestamps and severity levels
-   **Expandable details**: Provides "Show Details" section for verbose output
-   **Real-time updates**: Supports streaming to VS Code chat

### Display Formats

#### Full Progress Display

```markdown
### Spec Mode

✓ 1. Requirements _(2s)_
⟳ 2. Design - Analyzing requirements and defining architecture
○ 3. Create Tasks
○ 4. Execute Tasks
○ 5. Execute Tasks

_Creating technical design document_

<details>
<summary>Show Details</summary>

#### Execution Log

`10:30:15` ℹ️ **Requirements**: Loading requirements.prompt.md
`10:30:16` ℹ️ **Requirements**: Generated requirements successfully
`10:30:20` ℹ️ **Design**: Starting design phase

</details>
```

#### Compact Display

```
⟳ Spec Mode: 2/5 (40%)
```

#### Status Bar Display

```
⟳ Design (2/5)
```

### Usage

#### Basic Progress Rendering

```typescript
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

// Render compact progress
const compact = indicator.renderCompact(progress);

// Render status bar text
const statusBar = indicator.renderStatusBar(progress);
```

#### Progress with Detailed Logs

```typescript
const indicator = new ProgressIndicator();

// Start tracking
indicator.startTracking();

// Add logs
indicator.addLog("Requirements", "Loading requirements.prompt.md", "info");
indicator.addLog("Requirements", "Generated requirements successfully", "info");
indicator.addLog("Design", "Missing requirements file", "error");

// Record step timing
indicator.recordStepStart(0);
indicator.recordStepStart(1);

// Render with details
const markdown = indicator.renderProgress(progress, {
    showDetails: true,
    includeTimestamps: true,
});
```

#### Streaming to Chat

```typescript
const indicator = new ProgressIndicator();

// Render directly to chat stream
indicator.renderToStream(progress, chatStream, {
    showDetails: true,
});
```

#### Integration with WorkflowOrchestrator

```typescript
const indicator = new ProgressIndicator();
indicator.startTracking();

orchestrator.onProgress((progress) => {
    // Record step timing
    indicator.recordStepStart(progress.currentStep);

    // Add log entry
    indicator.addLog(
        progress.currentStepName,
        progress.message || "Step in progress",
        progress.status === "failed" ? "error" : "info"
    );

    // Render to UI
    const markdown = indicator.renderProgress(progress, {
        showDetails: true,
    });

    // Display in chat or webview
    displayProgress(markdown);
});
```

### API Reference

#### Constructor

```typescript
new ProgressIndicator();
```

#### Rendering Methods

-   `renderProgress(progress, options?)`: Render full progress display as markdown
-   `renderCompact(progress)`: Render compact progress summary
-   `renderStatusBar(progress)`: Render status bar text
-   `renderToStream(progress, stream, options?)`: Render to VS Code chat stream

#### Logging Methods

-   `addLog(stepName, message, level?)`: Add a log entry
-   `clearLogs()`: Clear all logs
-   `getLogs()`: Get all log entries
-   `getLogsByLevel(level)`: Get logs filtered by level
-   `hasErrors()`: Check if there are error logs
-   `hasWarnings()`: Check if there are warning logs

#### Time Tracking Methods

-   `startTracking()`: Start tracking workflow execution time
-   `recordStepStart(stepIndex)`: Record when a step starts
-   `getTotalElapsedTime()`: Get formatted total elapsed time

#### Utility Methods

-   `reset()`: Reset all tracking data

### Render Options

```typescript
interface ProgressRenderOptions {
    showDetails?: boolean; // Show expandable details section
    includeTimestamps?: boolean; // Include timestamps in logs
    compactMode?: boolean; // Use compact rendering
}
```

### Log Levels

-   `info` (ℹ️): General information
-   `warning` (⚠️): Warnings and non-critical issues
-   `error` (❌): Errors and failures

### Step Status Icons

-   `✓` - Completed
-   `⟳` - In Progress
-   `○` - Pending
-   `✗` - Failed
-   `⏸` - Waiting for Approval

### Examples

See `progressIndicator.example.ts` for comprehensive usage examples including:

-   Basic progress rendering
-   Progress with detailed logs
-   Multi-step progress tracking
-   Approval waiting states
-   Error handling
-   Compact mode for inline display

### Time Formatting

Durations are automatically formatted as:

-   Less than 1 minute: `Xs` (e.g., "45s")
-   Less than 1 hour: `Xm Ys` (e.g., "2m 30s")
-   1 hour or more: `Xh Ym` (e.g., "1h 15m")
