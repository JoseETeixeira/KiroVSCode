# Requirements: Enhanced Task Management System

## Introduction

The current Kiro-Style Copilot extension provides basic task detection from `tasks.md` files but lacks advanced task management capabilities. This enhancement aims to solve three key problems:

1. **Task Organization**: Tasks are not categorized by their associated specification folders, making it difficult to track which tasks belong to which features.
2. **Status Visibility**: There are no visual indicators showing whether tasks are pending, completed, or have failed, reducing the ability to quickly assess project progress.
3. **Prompt Management**: The extension currently relies on prompts stored in the user's AppData folder, creating deployment and portability issues.
4. **Mode-Based Execution**: Chat interactions don't automatically execute the appropriate prompts based on the selected mode.

**Objectives:**
- Provide automatic task categorization based on `.kiro/specs/` folder structure
- Display clear visual indicators for task status (pending, completed, failed)
- Embed all necessary prompts within the extension package for portability
- Enable automatic prompt execution when using @kiro in chat based on the current mode

---

## Requirements

### Requirement 1: Task Discovery and Categorization

**As a** developer working on multiple features,  
**I want** tasks to be automatically discovered and organized by their associated spec folders,  
**so that** I can easily see which tasks belong to which features and navigate the project structure efficiently.

**Acceptance Criteria:**

1. WHEN the extension activates, THEN the system SHALL scan the `.kiro/specs/` directory for all subdirectories.
2. IF a spec folder contains a `tasks.md` file, THEN the system SHALL parse and extract all tasks from that file.
3. WHEN displaying tasks in the Task Context view, THEN the system SHALL group tasks by their parent spec folder name.
4. IF no spec folders exist, THEN the system SHALL fall back to detecting tasks from a root-level `tasks.md` file.
5. WHEN a new spec folder is created, THEN the system SHALL automatically detect and display tasks from any `tasks.md` files within it.
6. IF a spec folder is deleted or renamed, THEN the system SHALL update the task categorization accordingly.
7. WHEN multiple spec folders exist, THEN each category SHALL display the spec folder name as a collapsible tree node.
8. IF a task file is modified, THEN the system SHALL re-parse and update the task list within 500 milliseconds.

---

### Requirement 2: Task Status Indicators

**As a** developer tracking project progress,  
**I want** visual indicators showing the status of each task (pending, completed, failed),  
**so that** I can quickly assess what work is done, what's in progress, and what needs attention.

**Acceptance Criteria:**

1. WHEN a task is marked with `- [ ]`, THEN the system SHALL display a pending indicator (circle icon or "○" symbol).
2. WHEN a task is marked with `- [x]`, THEN the system SHALL display a completed indicator (checkmark icon or "✓" symbol).
3. IF a task contains a `[failed]` or `[FAILED]` tag, THEN the system SHALL display a failed indicator (error icon or "✗" symbol).
4. WHEN displaying task status, THEN the system SHALL use distinct colors: gray for pending, green for completed, red for failed.
5. IF a spec folder contains tasks, THEN the folder node SHALL display a summary count (e.g., "3/10 completed").
6. WHEN all tasks in a spec folder are completed, THEN the folder node SHALL display a completed indicator.
7. IF any task in a spec folder has failed, THEN the folder node SHALL display a warning indicator.
8. WHEN a task status changes, THEN the tree view SHALL refresh and update indicators within 200 milliseconds.

---

### Requirement 3: Embedded Prompt System

**As an** extension user or developer,  
**I want** all necessary prompts to be embedded within the extension package,  
**so that** the extension works out-of-the-box without requiring external prompt files and is portable across installations.

**Acceptance Criteria:**

1. WHEN the extension is packaged, THEN all prompt files from the `prompts/` folder SHALL be included in the distribution.
2. IF the `prompts/` folder contains `requirements.prompt.md`, THEN the system SHALL embed this file for Spec mode.
3. IF the `prompts/` folder contains `BASE_SYSTEM_PROMPT.instructions.md`, THEN the system SHALL embed this file for base instructions.
4. WHEN loading prompts, THEN the system SHALL first check the embedded prompts directory within the extension.
5. IF a user has custom prompts in their AppData folder, THEN the system SHALL use those as an override (optional).
6. WHEN the PromptManager initializes, THEN it SHALL load prompts from the extension's embedded resources using `context.extensionPath`.
7. IF an embedded prompt file is missing, THEN the system SHALL log a warning and continue with fallback behavior.
8. WHEN prompts are loaded, THEN the system SHALL cache them in memory to avoid repeated file reads.
9. IF the extension is updated with new prompt versions, THEN the system SHALL automatically use the updated embedded prompts.

---

### Requirement 4: Mode-Based Chat Execution

**As a** developer using the chat interface,  
**I want** the @kiro chat participant to automatically execute appropriate prompts based on my selected mode,  
**so that** I receive context-aware guidance without manually specifying which workflow to follow.

**Acceptance Criteria:**

1. WHEN a user sends a message to `@kiro` in chat, THEN the system SHALL check the current mode (Vibe or Spec).
2. IF the current mode is "vibe", THEN the system SHALL load and apply the `BASE_SYSTEM_PROMPT.instructions.md` prompt.
3. IF the current mode is "spec", THEN the system SHALL load and apply both `requirements.prompt.md` and `BASE_SYSTEM_PROMPT.instructions.md` prompts in sequence.
4. WHEN a task is referenced in the chat context, THEN the system SHALL include task details and spec folder context in the prompt.
5. IF the user switches modes during a chat session, THEN subsequent messages SHALL use the new mode's prompts.
6. WHEN using Spec mode with a feature request, THEN the system SHALL follow the requirements generation workflow (create spec folder, generate requirements.md, request approval).
7. IF a user executes `/task` command in chat, THEN the system SHALL load prompts appropriate for the current mode and selected task.
8. WHEN generating responses, THEN the chat participant SHALL format output according to mode-specific guidelines (exploratory for Vibe, structured for Spec).
9. IF the user is working in a spec folder context, THEN the system SHALL read any existing `.kiro/steering/` files and include them in the prompt context.

---

### Requirement 5: Status Persistence and Tracking

**As a** developer managing long-running projects,  
**I want** task statuses to be persisted and tracked over time,  
**so that** I can maintain an accurate record of task completion and failures across extension restarts.

**Acceptance Criteria:**

1. WHEN a task status changes, THEN the system SHALL update the corresponding `tasks.md` file on disk.
2. IF the extension is reloaded, THEN all task statuses SHALL be restored from the `tasks.md` files.
3. WHEN a task is marked as failed, THEN the system SHALL optionally store failure metadata (timestamp, error message).
4. IF a task transitions from failed to completed, THEN the system SHALL clear the failed indicator.
5. WHEN displaying task history, THEN the system SHALL show the last modified timestamp for each task.

---

### Requirement 6: Integration with Existing Features

**As a** current extension user,  
**I want** these enhancements to integrate seamlessly with existing functionality,  
**so that** I don't lose any current capabilities and the learning curve is minimal.

**Acceptance Criteria:**

1. WHEN the enhanced extension is installed, THEN all existing commands SHALL continue to function.
2. IF a user has a root-level `tasks.md` file, THEN it SHALL still be detected and displayed (backward compatibility).
3. WHEN switching between modes, THEN the behavior SHALL remain consistent with current functionality.
4. IF custom prompts exist in the user's AppData folder, THEN they SHALL take precedence over embedded prompts (for customization).
5. WHEN the Mode Selector view is displayed, THEN it SHALL show the same information as before.
6. IF the Task Context view is already open, THEN the enhanced categorization SHALL be displayed automatically.

---

## Edge Cases and Error Handling

### Edge Case 1: Malformed Task Files
- IF a `tasks.md` file contains invalid markdown syntax, THEN the system SHALL skip malformed lines and log a warning.
- WHEN encountering unparseable content, THEN the system SHALL continue processing valid tasks.

### Edge Case 2: Circular References
- IF spec folders create circular directory structures, THEN the system SHALL detect and prevent infinite loops.
- WHEN scanning directories, THEN the system SHALL limit recursion depth to 5 levels.

### Edge Case 3: Large Projects
- IF a workspace contains more than 100 spec folders, THEN the system SHALL implement lazy loading for performance.
- WHEN displaying large task lists, THEN the system SHALL virtualize the tree view to maintain responsiveness.

### Edge Case 4: Concurrent Modifications
- IF multiple processes modify `tasks.md` simultaneously, THEN the system SHALL use file watchers to detect changes.
- WHEN conflicts are detected, THEN the system SHALL reload and re-parse the file.

---

## Non-Functional Requirements

1. **Performance**: Task scanning and parsing SHALL complete within 1 second for projects with up to 50 spec folders.
2. **Reliability**: The extension SHALL not crash if prompt files are missing; it SHALL degrade gracefully.
3. **Usability**: Visual indicators SHALL be intuitive and follow VS Code's design language.
4. **Maintainability**: Embedded prompts SHALL be stored in a dedicated directory structure that's easy to update.
5. **Compatibility**: The extension SHALL work with VS Code 1.85.0 and higher.
