# Implementation Plan: Task Discovery and Prompt Integration Enhancement

## Overview
This implementation plan breaks down the approved technical design into ordered, executable tasks. Each high-level task includes specific sub-tasks and traces back to the original requirements.

---

- [x] 1. Setup and prepare development environment
  - Review current codebase structure and dependencies
  - Ensure TypeScript compilation is working (`npm run compile`)
  - Install any additional type definitions if needed
  - Create test workspace with sample `tasks.md` files at various depths
  - _Requirements: N/A (Setup)_

- [x] 2. Enhance TaskContextProvider with recursive scanning capability
  - Add `TaskScanResult` and `WorkspaceTaskMap` interfaces to `taskContextProvider.ts`
  - Implement `performInitialScan()` method using `vscode.workspace.findFiles` API
  - Add workspace scanning on extension activation with progress indicator for >10 files
  - Implement `scanSingleFile()` method to parse individual tasks.md files
  - Add task cache management (`taskCache: WorkspaceTaskMap`)
  - Update cache with file path, relative path, tasks, timestamp, and spec folder info
  - _Requirements: 1.1, 1.2, 1.6, 1.7_

- [x] **Task 3**: Implement file system watcher with debouncing
  - Add `vscode.workspace.createFileSystemWatcher` for `**/{tasks.md,.kiro/specs/**/tasks.md}`
  - Implement debouncing logic (1 second delay)
  - Update cache when files are created/modified/deleted
  - Trigger tree view refresh after changes

- [x] 4. Add task context extraction for active editor
  - Implement `getActiveTaskContext()` method
  - Check if active editor has a `tasks.md` file open
  - Extract cursor line position to identify active task
  - Get selected text from editor selection
  - Detect if file is within `.kiro/specs/[feature-name]/` directory structure
  - Return `TaskContext` object with all relevant metadata
  - Return undefined if no task context available
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8_

- [x] 5. Organize tasks by spec folders
  - Implement `getAllTasksBySpec()` method
  - Create Map structure organizing tasks by spec folder name
  - Handle both spec-folder tasks and root-level tasks
  - Return organized data structure for tree view consumption
  - _Requirements: 1.4, 1.6_

- [x] 6. Add error handling and user feedback to task scanning
  - Wrap file operations in try-catch blocks
  - Check for permission errors (EACCES) and show specific warning
  - Handle missing files gracefully without crashing
  - Log parsing errors for malformed task files
  - Display informative message when no tasks.md files found
  - Add console logging for successful scans
  - _Requirements: 6.1, 6.4, 6.5, 6.7, 6.8_

- [x] 7. Enhance PromptManager with path validation and resolution
  - Add `validatedPromptsPath` cache property
  - Implement `getPromptsPath()` with three-tier priority system
  - Priority 1: Check embedded prompts in extension directory
  - Priority 2: Check user-configured `kiroCopilot.promptsPath` setting
  - Priority 3: Check default path `%APPDATA%/Code/User/prompts`
  - Implement `expandEnvVars()` to expand environment variables like `%APPDATA%`
  - Resolve relative paths against workspace root
  - Throw descriptive error if no valid path found
  - _Requirements: 2.1, 2.2, 7.3, 7.4_

- [x] 8. Implement configuration change watching for prompts
  - Add `watchConfigurationChanges()` method in PromptManager constructor
  - Listen for `kiroCopilot.promptsPath` configuration changes
  - Invalidate `validatedPromptsPath` cache on change
  - Clear prompt cache when configuration changes
  - Log cache invalidation for debugging
  - _Requirements: 2.5, 7.2_

- [x] 9. Add mode-specific prompt loading with validation
  - Update `getPromptForMode()` to load mode-specific files
  - For vibe mode: load `executeTask.prompt.md` + `BASE_SYSTEM_PROMPT.instructions.md`
  - For spec mode: load `requirements.prompt.md` + `BASE_SYSTEM_PROMPT.instructions.md`
  - Track missing files and build list of failures
  - Concatenate prompts in correct order (mode-specific first, base second)
  - Show warning notification if files are missing with "Open Settings" action
  - Throw error if no prompt files could be loaded
  - _Requirements: 2.3, 2.4, 2.6, 3.3, 3.4, 3.8_

- [x] 10. Enhance prompt file loading with caching and invalidation
  - Update `loadPromptFile()` to cache with `PromptCacheEntry` interface
  - Check file modification time (`mtimeMs`) for cache invalidation
  - Reload file if modification time has changed
  - Validate file size and warn if exceeds 50KB
  - Return cached content if file hasn't been modified
  - Handle file read errors gracefully and return undefined
  - _Requirements: 2.5, 2.8, 6.3_

- [x] 11. Create executeTask.prompt.md if it doesn't exist
  - Check if `prompts/executeTask.prompt.md` exists in extension directory
  - Create file with appropriate vibe coding mode instructions
  - Include guidance for iterative task execution
  - Ensure file follows same format as other prompt files
  - _Requirements: 3.3_

- [x] 12. Enhance ChatParticipant with mode-aware prompt application
  - Restructure `handleChatRequest()` to check for slash commands first
  - If no slash command, call `handleModeSpecificChat()` for auto-prompt application
  - Implement `handleSlashCommand()` for explicit `/vibe`, `/spec`, `/task` commands
  - Keep existing slash command handlers (`switchToVibeMode`, etc.)
  - _Requirements: 3.5, 3.9_

- [x] 13. Implement automatic mode-specific prompt injection
  - In `handleModeSpecificChat()`, get current mode from ModeManager
  - Call `promptManager.getPromptForMode(mode)` to load appropriate prompts
  - Handle prompt loading errors with try-catch
  - Display error message and fallback to base prompt on failure
  - Attempt to load just `BASE_SYSTEM_PROMPT.instructions.md` as fallback
  - Show error if no prompts can be loaded at all
  - _Requirements: 3.1, 3.2, 3.8_

- [x] 14. Integrate task context into chat participant
  - Update ChatParticipant constructor to accept `taskContextProvider`
  - Call `taskContextProvider.getActiveTaskContext()` in chat handler
  - Pass task context to `showContextIndicator()` method
  - Pass task context to `buildSystemMessage()` method
  - _Requirements: 4.6_

- [x] 15. Build comprehensive system messages for LLM
  - Implement `buildSystemMessage()` method
  - Start with mode-specific system prompt
  - Append task context section if available (file path, spec folder)
  - Include active task details if cursor is on a task
  - Include all tasks list if no specific task is active
  - Include selected text if user has text selected
  - Append user's message at the end
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.7, 4.8_

- [x] 16. Add user-visible context indicators
  - Implement `showContextIndicator()` method
  - Display mode label and prompt label
  - Show task file relative path if task context exists
  - Display active task label if cursor is on a task
  - Show task count if multiple tasks available
  - Display spec folder name if applicable
  - Use markdown formatting for clear presentation
  - _Requirements: 3.7, 4.6, 4.10_

- [x] 17. Update extension.ts to wire new dependencies
  - Update ChatParticipant instantiation to pass `taskContextProvider`
  - Ensure ModeManager, PromptManager, and TaskContextProvider are all initialized
  - Verify ChatParticipant registration happens after all services ready
  - Test that all components communicate correctly
  - _Requirements: N/A (Integration)_

- [ ] 18. Add configuration options to package.json
  - Add `kiroCopilot.taskFilePatterns` setting (array of glob patterns)
  - Set default value to `["**/tasks.md"]`
  - Add description explaining custom task file pattern support
  - Ensure `kiroCopilot.promptsPath` setting already exists
  - Ensure `kiroCopilot.autoDetectTasks` setting already exists
  - _Requirements: 7.6_

- [ ] 19. Implement custom task pattern support (optional enhancement)
  - Read `kiroCopilot.taskFilePatterns` configuration
  - Use custom patterns in `vscode.workspace.findFiles()` call
  - Update file watcher to monitor custom patterns
  - Validate pattern format before using
  - _Requirements: 7.6, 7.7_

- [ ] 20. Add comprehensive error messages and logging
  - Update all error handlers to provide actionable messages
  - Add logging to output channel for debugging
  - Log successful prompt loading with file paths
  - Log task scanning progress and results
  - Log cache operations (hit/miss/invalidation)
  - Ensure no generic "something went wrong" messages
  - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.7, 6.8_

- [ ] 21. Test with sample workspace structure
  - Create test workspace with nested directories
  - Add `tasks.md` files at various depths (root, 2 levels, 4 levels deep)
  - Add `.kiro/specs/feature-a/tasks.md` and `.kiro/specs/feature-b/tasks.md`
  - Verify all tasks are discovered and displayed
  - Test tree view organization by spec folders
  - Verify file watching triggers updates correctly
  - _Requirements: 1.1, 1.4, 1.5_

- [ ] 22. Test mode-specific prompt application
  - Switch to vibe mode and type `@Kiro test message`
  - Verify executeTask.prompt.md is loaded
  - Verify indicator shows "Execute Task workflow + Base instructions"
  - Switch to spec mode and type `@Kiro test message`
  - Verify requirements.prompt.md is loaded
  - Verify indicator shows "Requirements workflow + Base instructions"
  - _Requirements: 3.1, 3.2, 3.7_

- [ ] 23. Test task context integration
  - Open a `tasks.md` file
  - Place cursor on a specific task
  - Type `@Kiro help with this task`
  - Verify task context indicator shows the active task
  - Verify system message includes task details
  - Select multiple tasks and test with selection
  - _Requirements: 4.1, 4.2, 4.3, 4.8_

- [ ] 24. Test configuration and error scenarios
  - Configure invalid `promptsPath` and verify error message
  - Configure relative `promptsPath` and verify resolution
  - Configure path with environment variables (e.g., `%APPDATA%/prompts`)
  - Delete required prompt file and verify fallback behavior
  - Test with workspace containing no tasks.md files
  - Test with tasks.md file with permission errors
  - _Requirements: 2.2, 6.2, 6.3, 7.3, 7.4_

- [ ] 25. Performance testing with large workspace
  - Create test workspace with 1000+ files
  - Create 50+ tasks.md files at various locations
  - Verify initial scan completes in under 5 seconds
  - Verify progress indicator appears during scan
  - Make rapid file changes and verify debouncing works
  - Check memory usage remains reasonable
  - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [ ] 26. Final integration testing
  - Test complete workflow: Open workspace → Tasks discovered → Switch modes → Use @Kiro
  - Verify backward compatibility with existing tasks.md usage
  - Test with workspace folders (multi-root workspace)
  - Verify extension doesn't break without .kiro/specs folder
  - Test all slash commands still work correctly
  - Verify tree view updates correctly on all file operations
  - _Requirements: 1.1, 1.4, 1.5, 3.5, 3.9_

- [ ] 27. Update documentation
  - Update README.md with new recursive task discovery feature
  - Document prompt configuration requirements
  - Add examples of mode-specific @Kiro usage
  - Document task context features
  - Add troubleshooting section for common configuration issues
  - _Requirements: 6.2, 6.6_

- [ ] 28. Code cleanup and final review
  - Remove any debug console.log statements
  - Ensure all TypeScript types are properly defined
  - Run linter and fix any issues (`npm run lint`)
  - Run compiler and ensure no errors (`npm run compile`)
  - Review code for security considerations
  - Ensure all error paths are tested
  - _Requirements: 6.1, 6.2, 6.3_

---

## Implementation Order Notes

- Tasks 1-6 focus on TaskContextProvider enhancements
- Tasks 7-11 focus on PromptManager enhancements
- Tasks 12-16 focus on ChatParticipant enhancements
- Tasks 17-20 focus on integration and configuration
- Tasks 21-26 focus on testing and validation
- Tasks 27-28 focus on documentation and cleanup

Each task can be implemented and tested incrementally, with regular commits to track progress.
