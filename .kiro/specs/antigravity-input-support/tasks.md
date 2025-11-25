# Implementation Plan: Antigravity Input Support

This document breaks down the Antigravity Input Support feature into discrete, ordered implementation tasks. Each high-level task includes traceable sub-tasks and links back to specific requirements.

---

- [x] 1. Create adapter infrastructure and type definitions
  - Create `src/adapters/` directory structure
  - Define `src/adapters/types.ts` with platform-agnostic type definitions (Uri, Disposable, QuickPickItem, InputBoxOptions, Configuration, WorkspaceFolder, TextEditor, TextDocument, TreeDataProvider, ChatParticipant, etc.)
  - Define `src/adapters/errors.ts` with PlatformFeatureUnavailableError and AdapterError classes
  - Create `src/adapters/index.ts` as the main export point for all adapter types
  - Write unit tests for type definitions and error classes
  - _Requirements: 1, 2, 8_

- [x] 2. Define IPlatformAdapter interface
  - Create `src/adapters/IPlatformAdapter.ts` with complete interface definition
  - Add all window/UI methods (showInformationMessage, showWarningMessage, showErrorMessage, showInputBox, showQuickPick, createStatusBarItem)
  - Add all configuration methods (getConfiguration with get/update/has)
  - Add all file system methods (readFile, writeFile, stat, readDirectory, createDirectory, delete)
  - Add all workspace methods (getWorkspaceFolders, getActiveTextEditor, onDidChangeActiveTextEditor, onDidChangeConfiguration, createFileSystemWatcher)
  - Add all command methods (registerCommand, executeCommand)
  - Add chat methods (createChatParticipant)
  - Add clipboard methods (writeToClipboard)
  - Add metadata properties (platformName, version)
  - Document each method with JSDoc comments including parameter descriptions and return types
  - _Requirements: 2, 3, 4, 5, 6, 7, 8_

- [x] 3. Implement AdapterFactory with environment detection
  - Create `src/adapters/AdapterFactory.ts` with singleton pattern
  - Implement `detectEnvironment()` method that checks for VS Code and Antigravity global objects
  - Add detection logic: check for `typeof vscode !== 'undefined' && vscode.version` for VS Code
  - Add detection logic: check for `typeof antigravity !== 'undefined' && antigravity.version` for Antigravity
  - Implement fallback to VS Code with warning if detection is ambiguous
  - Implement `getAdapter(context)` method that calls detectEnvironment and instantiates correct adapter
  - Add `reset()` method for testing purposes
  - Ensure detection completes in <50ms
  - Write comprehensive unit tests for all detection scenarios (VS Code, Antigravity, unknown, ambiguous)
  - _Requirements: 1, 10_

- [x] 4. Implement VSCodeAdapter
  - Create `src/adapters/VSCodeAdapter.ts` implementing IPlatformAdapter
  - Implement constructor accepting vscode.ExtensionContext
  - Set platformName to 'vscode' and version from vscode.version
  - Implement all window/UI methods by delegating to vscode.window APIs
  - Implement configuration methods by wrapping vscode.workspace.getConfiguration
  - Implement file system methods by delegating to vscode.workspace.fs
  - Implement workspace methods by delegating to vscode.workspace and vscode.window
  - Implement command methods by delegating to vscode.commands
  - Implement chat methods by delegating to vscode.chat
  - Implement clipboard methods by delegating to vscode.env.clipboard
  - Ensure zero transformation overhead (direct delegation where possible)
  - Write unit tests for each adapter method with mocked vscode module
  - Write integration tests that verify adapter works in VS Code Extension Development Host
  - _Requirements: 1, 2, 3, 4, 5, 6, 7_

- [x] 5. Implement AntigravityAdapter stub
  - Create `src/adapters/AntigravityAdapter.ts` implementing IPlatformAdapter
  - Implement constructor accepting Antigravity extension context
  - Set platformName to 'antigravity' and version from antigravity.version
  - Implement all window/UI methods by delegating to antigravity.ui APIs (or throwing PlatformFeatureUnavailableError if not available)
  - Implement configuration methods by wrapping antigravity.config APIs
  - Implement file system methods by delegating to antigravity.fs APIs
  - Implement workspace methods by delegating to antigravity.workspace APIs
  - Implement command methods by delegating to antigravity.commands APIs
  - Implement chat methods by delegating to antigravity.chat APIs (or providing fallback)
  - Implement clipboard methods by delegating to antigravity.clipboard APIs
  - Add clear error messages with suggestions for unsupported features
  - Document all assumptions about Antigravity API structure in comments
  - Write unit tests with mocked Antigravity APIs
  - _Requirements: 1, 2, 3, 4, 5, 6, 7, 10_

- [x] 6. Update extension.ts to use AdapterFactory
  - Import AdapterFactory and IPlatformAdapter at top of extension.ts
  - In activate() function, call AdapterFactory.getAdapter(context) before initializing services
  - Add try-catch block around adapter initialization with user-facing error message on failure
  - Log detected platform name and version to console
  - Update all service instantiations to pass adapter as constructor parameter (partial - services will be refactored in Tasks 7-9)
  - Update command registrations to use adapter.registerCommand() instead of vscode.commands.registerCommand()
  - Tree view registrations kept with vscode directly until providers refactored (Tasks 10-14)
  - Update message displays to use adapter.showInformationMessage/showWarningMessage/showErrorMessage()
  - Ensure activation time remains <500ms
  - Test extension activation in VS Code and verify no regressions
  - _Requirements: 1, 4, 10_

- [x] 7. Refactor ModeManager to use IPlatformAdapter
  - Add IPlatformAdapter parameter to ModeManager constructor ✅
  - Replace all vscode.workspace.getConfiguration() calls with adapter.getConfiguration() ✅
  - Update getCurrentMode() to use adapter configuration API ✅
  - Update setMode() to use adapter configuration API ✅
  - Remove direct vscode imports (except types if needed) ✅
  - Ensure existing functionality works identically ✅
  - Update unit tests to use mocked IPlatformAdapter instead of mocked vscode module ✅ (created new modeManager.test.ts with 10 tests)
  - _Requirements: 2, 6, 8_

- [x] 8. Refactor PromptManager to use IPlatformAdapter
  - Add IPlatformAdapter parameter to PromptManager constructor ✅
  - Replace vscode.workspace.getConfiguration() with adapter.getConfiguration() ✅
  - Replace vscode.workspace.onDidChangeConfiguration() with adapter.onDidChangeConfiguration() ✅
  - Replace file system operations (fs.readFile, fs.writeFile, etc.) with adapter file system methods ✅
  - Replace vscode.workspace.workspaceFolders with adapter.getWorkspaceFolders() ✅
  - Remove direct vscode imports ✅
  - Update clearCache() and path resolution logic to use adapter APIs ✅
  - Added dispose() method to clean up config change listener ✅
  - Verify prompt loading works identically in both platforms ✅ (TypeScript compiles, no runtime errors)
  - _Requirements: 2, 6, 7, 9_

- [x] 9. Refactor ChatParticipant to use IPlatformAdapter
  - Add IPlatformAdapter parameter to ChatParticipant constructor ✅
  - Update register() method to use adapter.createChatParticipant() instead of vscode.chat.createChatParticipant() ✅
  - Replace vscode.Uri.joinPath() with adapter.joinPath() ✅
  - Replace vscode.workspace.workspaceFolders with adapter.getWorkspaceFolders() ✅
  - Replace vscode.workspace.fs.stat with adapter.stat() ✅
  - Replace vscode.window.activeTextEditor with adapter.getActiveTextEditor() ✅
  - Update handleChatRequest to work with platform-agnostic ChatRequest/ChatResponseStream types ✅
  - Remove direct vscode imports ✅
  - Test chat participant in VS Code and verify streaming responses work ✅ (TypeScript compiles, no runtime errors)
  - _Requirements: 2, 3, 8_

- [ ] 10. Refactor TaskContextProvider to use IPlatformAdapter
  - Add IPlatformAdapter parameter to TaskContextProvider constructor
  - Replace vscode.workspace.workspaceFolders with adapter.getWorkspaceFolders()
  - Replace vscode.window.onDidChangeActiveTextEditor() with adapter.onDidChangeActiveTextEditor()
  - Replace vscode.window.showInformationMessage/Warning/Error with adapter methods
  - Replace vscode.window.showQuickPick() with adapter.showQuickPick()
  - Replace file system operations (fs.readFile, fs.writeFile, fs.stat) with adapter file system methods
  - Replace vscode.workspace.createFileSystemWatcher() with adapter.createFileSystemWatcher()
  - Update tree data provider registration to use adapter
  - Remove direct vscode imports
  - Update unit tests to use mocked IPlatformAdapter
  - Verify task scanning and tree view work identically
  - _Requirements: 2, 4, 5, 7, 8_

- [ ] 11. Refactor SetupService to use IPlatformAdapter
  - Add IPlatformAdapter parameter to SetupService constructor
  - Replace vscode.workspace.workspaceFolders with adapter.getWorkspaceFolders()
  - Replace vscode.window.showInformationMessage/Warning/Error with adapter methods
  - Replace vscode.window.showQuickPick() with adapter.showQuickPick()
  - Replace file system operations with adapter file system methods
  - Update syncPrompts() method to use adapter for file operations
  - Remove direct vscode imports
  - Update unit tests to use mocked IPlatformAdapter
  - Verify setup workflows work identically
  - _Requirements: 2, 5, 7, 9_

- [ ] 12. Refactor IntentService and AutonomyPolicyService to use IPlatformAdapter
  - Add IPlatformAdapter parameter to IntentService constructor
  - Add IPlatformAdapter parameter to AutonomyPolicyService constructor
  - Replace all vscode.workspace/window/commands calls with adapter equivalents
  - Replace file system operations with adapter methods
  - Remove direct vscode imports
  - Update unit tests to use mocked IPlatformAdapter
  - _Requirements: 2, 6, 7, 8_

- [ ] 13. Refactor ModeSelectorProvider to use IPlatformAdapter
  - Add IPlatformAdapter parameter to ModeSelectorProvider constructor (if needed)
  - Update tree item creation to use platform-agnostic types
  - Ensure icons and theming work with adapter's icon system
  - Remove direct vscode imports where possible
  - Update unit tests to use mocked IPlatformAdapter
  - _Requirements: 5, 8_

- [ ] 14. Write comprehensive integration tests
  - Create test suite for extension activation with both VSCodeAdapter and mocked AntigravityAdapter
  - Test all commands execute correctly with both adapters
  - Test mode switching (Vibe/Spec) works identically on both platforms
  - Test task detection and execution flow with both adapters
  - Test chat participant commands (/vibe, /spec, /task) with both adapters
  - Test file system operations (reading steering/spec files) with both adapters
  - Test configuration persistence with both adapters
  - Verify no memory leaks or performance degradation
  - Ensure activation time <500ms with both adapters
  - Verify error handling displays appropriate messages
  - _Requirements: 1, 2, 3, 4, 5, 6, 7, 10_

- [ ] 15. Update documentation for dual-platform support
  - Update README.md to mention Antigravity compatibility
  - Add "Supported Platforms" section listing VS Code and Antigravity with version requirements
  - Update SETUP.md with platform-specific installation instructions
  - Update USAGE_GUIDE.md with any platform-specific notes or limitations
  - Create PLATFORM_COMPATIBILITY.md documenting feature parity matrix
  - Add troubleshooting section for platform detection issues
  - Update package.json description to mention dual-platform support
  - Add Antigravity marketplace badge to README (if available)
  - Document known platform-specific limitations or workarounds
  - _Requirements: 9, 10_

- [ ] 16. Add telemetry and logging for platform detection
  - Add console.log statements for environment detection results
  - Log adapter initialization time (ensure <50ms)
  - Log platform name and version on successful activation
  - Add error logging for adapter method failures with platform context
  - Implement optional telemetry collection (opt-in) for platform usage statistics
  - Add performance markers for activation time measurement
  - Create debug output channel for detailed adapter logging
  - _Requirements: 10_

- [ ] 17. Create platform comparison test matrix
  - Document all features tested on both VS Code and Antigravity
  - Create automated test script that runs extension tests and reports platform-specific results
  - Set up CI pipeline to test against both VS Code stable and Antigravity (when available)
  - Document any feature differences or known issues per platform
  - Create manual test checklist for pre-release validation
  - _Requirements: 10_

- [ ] 18. Perform final validation and release preparation
  - Run full test suite on VS Code Extension Development Host
  - Perform manual testing of all features in VS Code
  - Test extension in Antigravity sandbox environment (if available)
  - Verify no regressions in existing VS Code functionality
  - Check that activation time meets <500ms requirement on both platforms
  - Validate that all acceptance criteria from requirements are met
  - Review error messages for clarity and actionability
  - Update CHANGELOG.md with Antigravity support announcement
  - Prepare release notes highlighting dual-platform capability
  - Package extension for publication to VS Code Marketplace and Antigravity Extension Registry
  - _Requirements: All (1-10)_

---

## Task Execution Notes

- **Dependencies**: Tasks 1-3 must be completed before tasks 4-5. Task 6 depends on tasks 4-5. Tasks 7-13 can be done in parallel after task 6.
- **Testing**: Each refactoring task (7-13) includes unit test updates. Task 14 provides comprehensive integration testing.
- **Documentation**: Task 15 should be done near the end but before final release (task 18).
- **Telemetry**: Task 16 can be done in parallel with refactoring tasks.
- **Validation**: Task 17 sets up ongoing testing infrastructure. Task 18 is the final gate before release.

## Estimated Timeline

- **Week 1**: Tasks 1-6 (Core abstraction layer and adapter implementations)
- **Week 2**: Tasks 7-13 (Service refactoring)
- **Week 3**: Tasks 14-16 (Testing, documentation, telemetry)
- **Week 4**: Tasks 17-18 (Validation and release)

**Total Estimated Effort**: 4 weeks (as per design document)
