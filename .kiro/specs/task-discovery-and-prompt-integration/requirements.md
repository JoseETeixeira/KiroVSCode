# Requirements: Task Discovery and Prompt Integration Enhancement

## Introduction

This specification addresses the need to enhance the Kiro VS Code extension's task discovery and prompt integration capabilities. Currently, the extension has limited task discovery functionality and inconsistent prompt application. The goal is to create a robust system that automatically discovers tasks.md files across all workspace directories and subdirectories, ensures proper prompt integration from the configured prompts folder, and provides mode-specific behavior when using the @Kiro chat participant.

This enhancement will improve developer experience by providing comprehensive task visibility, consistent prompt-driven workflows, and intelligent mode-aware chat interactions that align with Kiro IDE's dual-mode philosophy.

---

## Requirements

### Requirement 1: Automatic Task Discovery Across Workspace

**User Story:** As a developer, I want the extension to automatically find and list all tasks from tasks.md files in any directory or subdirectory of my workspace, so that I can see all my tasks regardless of where they are located in my project structure.

**Acceptance Criteria:**

1. WHEN the extension activates, THEN the system SHALL recursively scan all directories and subdirectories in the workspace for files named `tasks.md`.

2. WHEN a `tasks.md` file is found at any depth in the workspace, THEN the system SHALL parse its contents and extract all task items.

3. WHEN extracting tasks, THEN the system SHALL recognize the following task formats:
   - Markdown checkboxes: `- [ ]` for pending tasks
   - Completed checkboxes: `- [x]` for completed tasks  
   - Numbered tasks: `1.`, `2.`, etc.
   - Combined formats: `- [ ] 1. task description`

4. WHEN multiple `tasks.md` files exist in different directories, THEN the system SHALL display all tasks organized by their source file location.

5. WHEN a `tasks.md` file is created, modified, or deleted in any directory, THEN the system SHALL automatically update the task list within 2 seconds.

6. WHERE a task exists within a `.kiro/specs/[feature-name]/` directory structure, THEN the system SHALL associate that task with its parent spec folder.

7. WHEN displaying tasks from different locations, THEN the system SHALL show the relative path from the workspace root to help users identify task context.

8. IF the workspace contains no `tasks.md` files, THEN the system SHALL display an informative message suggesting the user create one.

---

### Requirement 2: Prompt Configuration and Loading

**User Story:** As a developer, I want the extension to use the prompts defined in my configured prompts folder, so that the AI assistant behaves according to my custom workflows and instructions.

**Acceptance Criteria:**

1. WHEN the extension initializes, THEN the system SHALL read the `kiroCopilot.promptsPath` configuration setting to determine the prompts directory location.

2. IF the `kiroCopilot.promptsPath` is not configured, THEN the system SHALL default to checking the extension's embedded `prompts/` folder first, then fall back to `%APPDATA%\Code\User\prompts` on Windows.

3. WHEN loading prompts for a mode, THEN the system SHALL verify that all required prompt files exist in the configured prompts folder:
   - `BASE_SYSTEM_PROMPT.instructions.md` (required for all modes)
   - `requirements.prompt.md` (required for spec mode)
   - `executeTask.prompt.md` (required for vibe mode task execution)

4. IF a required prompt file is missing, THEN the system SHALL log a warning message specifying which file is missing and from which path it attempted to load.

5. WHEN prompt files are updated on disk, THEN the system SHALL invalidate any cached prompt content and reload the files on the next request.

6. WHEN combining multiple prompt files for a mode, THEN the system SHALL concatenate them in the following order:
   - Mode-specific prompt file first (e.g., `requirements.prompt.md` or `executeTask.prompt.md`)
   - `BASE_SYSTEM_PROMPT.instructions.md` second

7. WHERE prompt files contain markdown formatting, THEN the system SHALL preserve all formatting including headers, code blocks, and list structures.

8. WHEN a prompt file exceeds 50KB in size, THEN the system SHALL log a warning about potential token usage concerns.

---

### Requirement 3: Mode-Specific @Kiro Chat Behavior

**User Story:** As a developer, I want @Kiro to automatically use the appropriate prompt based on my current coding mode, so that I receive mode-specific guidance without manual prompt selection.

**Acceptance Criteria:**

1. WHEN a user types `@Kiro` followed by a message in vibe coding mode, THEN the system SHALL automatically apply the `/executeTask` prompt before processing the user's request.

2. WHEN a user types `@Kiro` followed by a message in spec mode, THEN the system SHALL automatically apply the `/requirements` prompt before processing the user's request.

3. WHEN the `/executeTask` prompt is applied in vibe mode, THEN the chat participant SHALL load the content from `executeTask.prompt.md` in the configured prompts folder.

4. WHEN the `/requirements` prompt is applied in spec mode, THEN the chat participant SHALL load the content from `requirements.prompt.md` in the configured prompts folder.

5. IF the user explicitly uses a slash command (e.g., `@Kiro /vibe`, `@Kiro /spec`, `@Kiro /task`), THEN the system SHALL process the slash command instead of applying the default mode-specific prompt.

6. WHEN applying a mode-specific prompt, THEN the system SHALL also include `BASE_SYSTEM_PROMPT.instructions.md` as foundational context.

7. WHEN the mode-specific prompt is applied, THEN the chat participant SHALL display a brief indicator message showing which mode and prompt combination is active (e.g., "Mode-specific prompt applied (Requirements workflow + Base instructions)").

8. WHERE the configured prompt file cannot be loaded, THEN the system SHALL display an error message to the user and fall back to using only the `BASE_SYSTEM_PROMPT.instructions.md`.

9. WHEN a user switches modes using `/vibe` or `/spec` commands, THEN the subsequent @Kiro interactions SHALL use the newly selected mode's default prompt.

10. IF a user is working in a `tasks.md` file and uses `@Kiro` in spec mode, THEN the system SHALL apply the requirements prompt and indicate that task context is available.

---

### Requirement 4: Task Context Integration with Prompts

**User Story:** As a developer, I want task context to be automatically included when I interact with @Kiro while viewing a tasks.md file, so that the AI assistant has relevant context about my current work.

**Acceptance Criteria:**

1. WHEN a user has a `tasks.md` file open in the active editor and types `@Kiro`, THEN the system SHALL detect the active file and mark it as task context.

2. WHEN task context is detected, THEN the system SHALL extract the current task being viewed (based on cursor position or selected text).

3. WHERE a specific task is identified from the active editor, THEN the system SHALL include the task description and associated metadata in the context sent to the chat participant.

4. WHEN multiple tasks exist in the active `tasks.md` file, THEN the system SHALL prioritize the task closest to the user's cursor position.

5. IF no specific task can be identified from cursor position, THEN the system SHALL include all tasks from the active `tasks.md` file as context.

6. WHEN task context is included, THEN the chat participant SHALL display a message indicating task context was loaded (e.g., "Working in **Spec** mode with tasks.md").

7. WHERE the active `tasks.md` file is located within a `.kiro/specs/[feature-name]/` directory, THEN the system SHALL also include references to associated spec files (e.g., `requirements.md`, `design.md`).

8. IF the user has selected text in the `tasks.md` file before invoking `@Kiro`, THEN the system SHALL treat the selected text as the primary task context.

---

### Requirement 5: Recursive File Watching and Performance

**User Story:** As a developer working on large projects, I want the extension to efficiently monitor tasks.md files without impacting IDE performance, so that I can work smoothly even with many files and directories.

**Acceptance Criteria:**

1. WHEN the extension activates, THEN the system SHALL create a file system watcher with the glob pattern `**/{tasks.md,.kiro/specs/**/tasks.md}`.

2. WHEN a file matching the watch pattern is created, modified, or deleted, THEN the system SHALL trigger a task list refresh.

3. WHERE the workspace contains more than 1000 files, THEN the file watcher SHALL still perform efficiently without blocking the UI thread.

4. WHEN multiple rapid file changes occur (e.g., during git operations), THEN the system SHALL debounce refresh operations to occur at most once per second.

5. IF scanning for tasks takes longer than 5 seconds, THEN the system SHALL display a progress indicator to inform the user.

6. WHEN caching task data, THEN the system SHALL invalidate the cache only for the specific file that changed, not all tasks.

7. WHERE a `.gitignore` or `.vscodeignore` file excludes certain directories, THEN the system SHALL respect these exclusions when scanning for tasks.md files.

8. WHEN calculating task statistics (total, completed, failed counts), THEN the system SHALL perform calculations incrementally rather than re-parsing all files.

---

### Requirement 6: Error Handling and User Feedback

**User Story:** As a developer, I want clear error messages and guidance when task discovery or prompt loading fails, so that I can quickly resolve configuration issues.

**Acceptance Criteria:**

1. WHEN the extension cannot read a `tasks.md` file due to permission errors, THEN the system SHALL log a warning with the file path and display a notification to the user.

2. IF the configured prompts path does not exist, THEN the system SHALL display an error notification with instructions on how to configure the correct path.

3. WHEN a prompt file contains invalid markdown or syntax errors, THEN the system SHALL log the parsing error and attempt to use the file content as-is with a warning.

4. WHERE task parsing encounters malformed markdown, THEN the system SHALL skip the malformed task and continue processing remaining tasks.

5. IF no tasks are found in a `tasks.md` file, THEN the system SHALL display a message indicating the file exists but contains no parseable tasks.

6. WHEN the @Kiro chat participant cannot load the mode-specific prompt, THEN the system SHALL inform the user which prompt file failed to load and suggest checking the configuration.

7. WHERE file system operations fail (e.g., during workspace scanning), THEN the system SHALL provide actionable error messages rather than generic failure notifications.

8. WHEN the extension successfully loads all prompts and discovers tasks, THEN the system SHALL log a success message to the output channel for debugging purposes.

---

### Requirement 7: Configuration and Customization

**User Story:** As a developer, I want to configure how task discovery and prompt integration work, so that I can adapt the extension to my team's workflow.

**Acceptance Criteria:**

1. WHEN the user opens VS Code settings, THEN the system SHALL provide a `kiroCopilot.promptsPath` setting with a text input field.

2. IF the user changes the `kiroCopilot.promptsPath` setting, THEN the system SHALL invalidate the prompt cache and reload prompts from the new location.

3. WHEN the user configures the prompts path using a relative path, THEN the system SHALL resolve it relative to the workspace root.

4. WHERE the prompts path is configured using environment variables (e.g., `%APPDATA%`), THEN the system SHALL expand the variables before attempting to load files.

5. WHEN the `kiroCopilot.autoDetectTasks` setting is disabled, THEN the system SHALL not automatically scan for or display tasks.

6. IF advanced users want custom task file patterns, THEN the system SHALL provide a `kiroCopilot.taskFilePatterns` setting accepting an array of glob patterns (default: `["**/tasks.md"]`).

7. WHEN users configure custom task patterns, THEN the system SHALL update the file watcher to monitor the new patterns.

8. WHERE multiple workspace folders are open, THEN the system SHALL apply workspace-specific prompt configurations if defined in `.vscode/settings.json`.

---

## Success Metrics

Upon successful implementation, the following outcomes will be achieved:

1. **Task Visibility:** All tasks.md files across workspace are discovered and displayed regardless of directory depth
2. **Prompt Consistency:** Mode-specific prompts are correctly loaded from the configured prompts folder 100% of the time
3. **Chat Integration:** @Kiro automatically applies `/executeTask` in vibe mode and `/requirements` in spec mode
4. **Performance:** Task scanning completes in under 2 seconds for workspaces with up to 10,000 files
5. **User Experience:** Clear error messages guide users to resolve any configuration issues within 1 minute
