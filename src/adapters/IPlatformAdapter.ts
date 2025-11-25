/**
 * Platform Adapter Interface Definition
 * 
 * This module defines the core `IPlatformAdapter` interface that all IDE platform
 * adapters must implement. This interface provides a unified API surface for
 * extension services to interact with the host IDE (VS Code, Antigravity, etc.).
 * 
 * The interface is designed to:
 * - Mirror VS Code's extension API structure for minimal refactoring
 * - Support graceful degradation when features are unavailable
 * - Enable type-safe, testable code through dependency injection
 * 
 * @module adapters/IPlatformAdapter
 */

import type {
    Uri,
    Disposable,
    InputBoxOptions,
    QuickPickItem,
    QuickPickOptions,
    StatusBarItem,
    TreeDataProvider,
    Configuration,
    FileStat,
    FileType,
    WorkspaceFolder,
    TextEditor,
    FileSystemWatcher,
    ConfigurationChangeEvent,
    ChatParticipant,
    ChatRequestHandler,
    ExtensionContext,
    OutputChannel,
    PlatformName,
    EventEmitter
} from './types';

import { StatusBarAlignment } from './types';

/**
 * Core platform adapter interface that all IDE adapters must implement.
 * Provides a unified API surface for extension services to interact with the host IDE.
 * 
 * This interface is the primary abstraction boundary between the extension's
 * business logic and platform-specific APIs. Services should depend on this
 * interface rather than directly importing `vscode` or other platform modules.
 * 
 * @example
 * ```typescript
 * // Service using the adapter for platform independence
 * class ModeManager {
 *     constructor(
 *         private context: ExtensionContext,
 *         private adapter: IPlatformAdapter
 *     ) {}
 *     
 *     async setMode(mode: 'vibe' | 'spec') {
 *         const config = this.adapter.getConfiguration('kiroCopilot');
 *         await config.update('mode', mode);
 *         await this.adapter.showInformationMessage(`Switched to ${mode} mode`);
 *     }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Testing with a mock adapter
 * const mockAdapter: IPlatformAdapter = {
 *     platformName: 'vscode',
 *     version: '1.85.0',
 *     showInformationMessage: jest.fn(),
 *     // ... other methods
 * };
 * const modeManager = new ModeManager(mockContext, mockAdapter);
 * ```
 */
export interface IPlatformAdapter {
    // ========================================================================
    // Environment Metadata
    // ========================================================================
    
    /**
     * The name of the current platform.
     * Used for conditional logic and logging.
     * 
     * @example
     * ```typescript
     * if (adapter.platformName === 'antigravity') {
     *     // Use Antigravity-specific optimizations
     * }
     * ```
     */
    readonly platformName: PlatformName;
    
    /**
     * The version of the current platform (e.g., '1.85.0' for VS Code).
     * Useful for feature detection based on platform version.
     */
    readonly version: string;
    
    // ========================================================================
    // Notifications / Messages
    // ========================================================================
    
    /**
     * Show an information message to the user.
     * 
     * Information messages are used for non-critical notifications that
     * don't require user action. They typically appear in a notification
     * popup and auto-dismiss after a timeout.
     * 
     * @param message The message to show
     * @param items Optional action buttons to show in the message
     * @returns A promise that resolves to the selected button text, or undefined if dismissed
     * 
     * @example
     * ```typescript
     * // Simple notification
     * await adapter.showInformationMessage('Task completed successfully');
     * 
     * // With action buttons
     * const result = await adapter.showInformationMessage(
     *     'Would you like to view the changes?',
     *     'View',
     *     'Dismiss'
     * );
     * if (result === 'View') {
     *     // Open diff view
     * }
     * ```
     */
    showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
    
    /**
     * Show a warning message to the user.
     * 
     * Warning messages are used for important notifications that may
     * require user attention but are not errors. They typically have
     * a yellow/orange visual indicator.
     * 
     * @param message The message to show
     * @param items Optional action buttons to show in the message
     * @returns A promise that resolves to the selected button text, or undefined if dismissed
     * 
     * @example
     * ```typescript
     * const result = await adapter.showWarningMessage(
     *     'This action will overwrite existing files',
     *     'Continue',
     *     'Cancel'
     * );
     * ```
     */
    showWarningMessage(message: string, ...items: string[]): Promise<string | undefined>;
    
    /**
     * Show a warning message with options (e.g., modal dialog).
     * 
     * @param message The message to show
     * @param options Message options (e.g., modal: true for modal dialog)
     * @param items Action buttons to show in the message
     * @returns A promise that resolves to the selected button text, or undefined if dismissed
     * 
     * @example
     * ```typescript
     * const result = await adapter.showWarningMessage(
     *     'Delete this item?',
     *     { modal: true },
     *     'Delete',
     *     'Cancel'
     * );
     * ```
     */
    showWarningMessage(message: string, options: { modal: boolean }, ...items: string[]): Promise<string | undefined>;
    
    /**
     * Show an error message to the user.
     * 
     * Error messages are used for critical failures that need user attention.
     * They typically have a red visual indicator and may persist longer
     * than information messages.
     * 
     * @param message The message to show
     * @param items Optional action buttons to show in the message
     * @returns A promise that resolves to the selected button text, or undefined if dismissed
     * 
     * @example
     * ```typescript
     * try {
     *     await riskyOperation();
     * } catch (error) {
     *     await adapter.showErrorMessage(
     *         `Operation failed: ${error.message}`,
     *         'Retry',
     *         'Report Issue'
     *     );
     * }
     * ```
     */
    showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>;
    
    // ========================================================================
    // Input
    // ========================================================================
    
    /**
     * Show an input box to collect text input from the user.
     * 
     * Input boxes provide a single-line text input with optional validation,
     * placeholder text, and password masking.
     * 
     * @param options Configuration options for the input box
     * @returns A promise that resolves to the entered text, or undefined if cancelled
     * 
     * @example
     * ```typescript
     * const specName = await adapter.showInputBox({
     *     prompt: 'Enter the name for the new spec',
     *     placeHolder: 'e.g., user-authentication',
     *     validateInput: (value) => {
     *         if (!value.match(/^[a-z][a-z0-9-]*$/)) {
     *             return 'Name must be lowercase with hyphens';
     *         }
     *         return undefined; // Valid
     *     }
     * });
     * ```
     */
    showInputBox(options: InputBoxOptions): Promise<string | undefined>;
    
    /**
     * Show a quick pick list to let the user select an item.
     * 
     * Quick picks display a filterable list of items for the user to choose from.
     * They can optionally support multi-selection.
     * 
     * @param items The items to pick from (can be a promise for async loading)
     * @param options Configuration options for the quick pick
     * @returns A promise that resolves to the selected item, or undefined if cancelled
     * 
     * @example
     * ```typescript
     * const modes = [
     *     { label: '$(rocket) Vibe Coding', description: 'Chat first, then build', mode: 'vibe' },
     *     { label: '$(notebook) Spec', description: 'Plan first, then build', mode: 'spec' }
     * ];
     * 
     * const selected = await adapter.showQuickPick(modes, {
     *     placeHolder: 'Select your coding mode'
     * });
     * 
     * if (selected) {
     *     await setMode(selected.mode);
     * }
     * ```
     */
    showQuickPick<T extends QuickPickItem>(items: T[] | Promise<T[]>, options?: QuickPickOptions): Promise<T | undefined>;
    
    // ========================================================================
    // UI Components
    // ========================================================================
    
    /**
     * Register a tree data provider for a view.
     * 
     * Tree views display hierarchical data in the sidebar. This method
     * connects a data provider to a view defined in package.json.
     * 
     * @param viewId The ID of the view (must match an entry in package.json contributes.views)
     * @param provider The tree data provider implementation
     * @returns A disposable that unregisters the provider when disposed
     * 
     * @example
     * ```typescript
     * const taskProvider = new TaskContextProvider();
     * const disposable = adapter.registerTreeDataProvider(
     *     'kiro-copilot.taskContext',
     *     taskProvider
     * );
     * context.subscriptions.push(disposable);
     * ```
     */
    registerTreeDataProvider<T>(viewId: string, provider: TreeDataProvider<T>): Disposable;
    
    /**
     * Create a status bar item.
     * 
     * Status bar items appear at the bottom of the IDE window and can
     * display text, icons, and react to clicks.
     * 
     * @param alignment Whether to align left or right (default: left)
     * @param priority Higher priority items appear closer to the edge
     * @returns The created status bar item
     * 
     * @example
     * ```typescript
     * const statusItem = adapter.createStatusBarItem(StatusBarAlignment.Left, 100);
     * statusItem.text = '$(notebook) Spec Mode';
     * statusItem.tooltip = 'Click to change mode';
     * statusItem.command = 'kiro-copilot.openModeSelector';
     * statusItem.show();
     * ```
     */
    createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
    
    /**
     * Create an output channel for displaying output.
     * 
     * Output channels provide a way to display logs and messages in
     * a dedicated panel that users can view for debugging.
     * 
     * @param name The name of the output channel (appears in the output panel dropdown)
     * @returns The created output channel
     * 
     * @example
     * ```typescript
     * const output = adapter.createOutputChannel('Kiro Extension');
     * output.appendLine('Extension activated');
     * output.appendLine(`Platform: ${adapter.platformName} v${adapter.version}`);
     * ```
     */
    createOutputChannel(name: string): OutputChannel;
    
    // ========================================================================
    // Configuration
    // ========================================================================
    
    /**
     * Get a configuration object for reading and writing settings.
     * 
     * Configuration is organized in sections (e.g., 'kiroCopilot.mode').
     * Pass a section name to scope the configuration object.
     * 
     * @param section Optional configuration section prefix
     * @returns A configuration object with get, update, and has methods
     * 
     * @example
     * ```typescript
     * // Get the current mode
     * const config = adapter.getConfiguration('kiroCopilot');
     * const mode = config.get<string>('mode', 'vibe');
     * 
     * // Update a setting
     * await config.update('mode', 'spec', ConfigurationTarget.Global);
     * ```
     */
    getConfiguration(section?: string): Configuration;
    
    /**
     * Register a listener for configuration changes.
     * 
     * Use this to react when users change settings that affect
     * extension behavior.
     * 
     * @param listener The callback function invoked when configuration changes
     * @returns A disposable that removes the listener when disposed
     * 
     * @example
     * ```typescript
     * const disposable = adapter.onDidChangeConfiguration(event => {
     *     if (event.affectsConfiguration('kiroCopilot.promptsPath')) {
     *         // Reload prompts from new path
     *         promptManager.reload();
     *     }
     * });
     * ```
     */
    onDidChangeConfiguration(listener: (event: ConfigurationChangeEvent) => void): Disposable;
    
    // ========================================================================
    // File System
    // ========================================================================
    
    /**
     * Read the contents of a file.
     * 
     * @param uri The URI of the file to read
     * @returns A promise that resolves to the file contents as a Uint8Array
     * @throws FileSystemOperationError if the file cannot be read
     * 
     * @example
     * ```typescript
     * const uri = adapter.createFileUri('/path/to/tasks.md');
     * const content = await adapter.readFile(uri);
     * const text = new TextDecoder().decode(content);
     * ```
     */
    readFile(uri: Uri): Promise<Uint8Array>;
    
    /**
     * Write content to a file.
     * 
     * Creates the file if it doesn't exist, or overwrites if it does.
     * Parent directories must exist.
     * 
     * @param uri The URI of the file to write
     * @param content The content to write as a Uint8Array
     * @throws FileSystemOperationError if the file cannot be written
     * 
     * @example
     * ```typescript
     * const uri = adapter.createFileUri('/path/to/output.md');
     * const content = new TextEncoder().encode('# Generated Content\n');
     * await adapter.writeFile(uri, content);
     * ```
     */
    writeFile(uri: Uri, content: Uint8Array): Promise<void>;
    
    /**
     * Get file or directory statistics.
     * 
     * @param uri The URI of the file or directory
     * @returns A promise that resolves to file statistics
     * @throws FileSystemOperationError if the path doesn't exist
     * 
     * @example
     * ```typescript
     * try {
     *     const stats = await adapter.stat(uri);
     *     if (stats.type === FileType.Directory) {
     *         console.log('It is a directory');
     *     }
     * } catch (e) {
     *     console.log('Path does not exist');
     * }
     * ```
     */
    stat(uri: Uri): Promise<FileStat>;
    
    /**
     * Read the contents of a directory.
     * 
     * @param uri The URI of the directory to read
     * @returns A promise that resolves to an array of [name, type] tuples
     * @throws FileSystemOperationError if the directory cannot be read
     * 
     * @example
     * ```typescript
     * const entries = await adapter.readDirectory(specsUri);
     * const specs = entries
     *     .filter(([name, type]) => type === FileType.Directory)
     *     .map(([name]) => name);
     * ```
     */
    readDirectory(uri: Uri): Promise<[string, FileType][]>;
    
    /**
     * Create a directory.
     * 
     * Creates parent directories if they don't exist (like mkdir -p).
     * 
     * @param uri The URI of the directory to create
     * @throws FileSystemOperationError if the directory cannot be created
     * 
     * @example
     * ```typescript
     * const specDir = adapter.joinPath(kiroUri, 'specs', 'new-feature');
     * await adapter.createDirectory(specDir);
     * ```
     */
    createDirectory(uri: Uri): Promise<void>;
    
    /**
     * Delete a file or directory.
     * 
     * @param uri The URI of the file or directory to delete
     * @param options Optional delete options
     * @param options.recursive Whether to delete directories recursively
     * @param options.useTrash Whether to move to trash instead of permanent delete
     * @throws FileSystemOperationError if the deletion fails
     * 
     * @example
     * ```typescript
     * // Delete a spec folder and all its contents
     * await adapter.delete(specUri, { recursive: true, useTrash: true });
     * ```
     */
    delete(uri: Uri, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void>;
    
    /**
     * Copy a file or directory.
     * 
     * @param source The source URI to copy from
     * @param target The target URI to copy to
     * @param options Optional copy options
     * @param options.overwrite Whether to overwrite existing files
     * @throws FileSystemOperationError if the copy fails
     * 
     * @example
     * ```typescript
     * // Copy a file
     * const source = adapter.createFileUri('/path/to/source.md');
     * const target = adapter.createFileUri('/path/to/target.md');
     * await adapter.copy(source, target, { overwrite: false });
     * ```
     */
    copy(source: Uri, target: Uri, options?: { overwrite?: boolean }): Promise<void>;
    
    /**
     * Check if a file or directory exists.
     * 
     * @param uri The URI to check
     * @returns A promise that resolves to true if the path exists, false otherwise
     * 
     * @example
     * ```typescript
     * const exists = await adapter.exists(adapter.createFileUri('/path/to/file.md'));
     * if (!exists) {
     *     await adapter.createDirectory(parentUri);
     * }
     * ```
     */
    exists(uri: Uri): Promise<boolean>;
    
    /**
     * Create a file system watcher for a glob pattern.
     * 
     * File system watchers notify when files matching the pattern
     * are created, changed, or deleted.
     * 
     * @param globPattern The glob pattern to watch (e.g., '**\/*.md')
     * @param ignoreCreateEvents Whether to ignore file creation events
     * @param ignoreChangeEvents Whether to ignore file change events
     * @param ignoreDeleteEvents Whether to ignore file deletion events
     * @returns A file system watcher with onCreate, onChange, onDelete events
     * 
     * @example
     * ```typescript
     * const watcher = adapter.createFileSystemWatcher('**\/tasks.md');
     * watcher.onDidChange(uri => {
     *     console.log('Tasks file changed:', uri.fsPath);
     *     taskProvider.refresh();
     * });
     * context.subscriptions.push(watcher);
     * ```
     */
    createFileSystemWatcher(
        globPattern: string,
        ignoreCreateEvents?: boolean,
        ignoreChangeEvents?: boolean,
        ignoreDeleteEvents?: boolean
    ): FileSystemWatcher;
    
    /**
     * Create a file system watcher for a relative pattern within a workspace folder.
     * 
     * @param workspaceFolder The workspace folder to watch within
     * @param pattern The relative glob pattern within the folder
     * @param ignoreCreateEvents Whether to ignore file creation events
     * @param ignoreChangeEvents Whether to ignore file change events
     * @param ignoreDeleteEvents Whether to ignore file deletion events
     * @returns A file system watcher with onCreate, onChange, onDelete events
     * 
     * @example
     * ```typescript
     * const watcher = adapter.createRelativePatternWatcher(folders[0], '.kiro/specs/*');
     * watcher.onDidCreate(uri => {
     *     console.log('Spec folder created:', uri.fsPath);
     * });
     * ```
     */
    createRelativePatternWatcher(
        workspaceFolder: WorkspaceFolder,
        pattern: string,
        ignoreCreateEvents?: boolean,
        ignoreChangeEvents?: boolean,
        ignoreDeleteEvents?: boolean
    ): FileSystemWatcher;
    
    // ========================================================================
    // Workspace
    // ========================================================================
    
    /**
     * Get the workspace folders currently open in the IDE.
     * 
     * @returns An array of workspace folders, or undefined if no workspace is open
     * 
     * @example
     * ```typescript
     * const folders = adapter.getWorkspaceFolders();
     * if (!folders || folders.length === 0) {
     *     adapter.showErrorMessage('Please open a workspace folder');
     *     return;
     * }
     * const rootUri = folders[0].uri;
     * ```
     */
    getWorkspaceFolders(): WorkspaceFolder[] | undefined;
    
    /**
     * Get the currently active text editor.
     * 
     * The active editor is the one that has focus or was most recently focused.
     * 
     * @returns The active text editor, or undefined if no editor is active
     * 
     * @example
     * ```typescript
     * const editor = adapter.getActiveTextEditor();
     * if (editor) {
     *     const document = editor.document;
     *     console.log('Active file:', document.fileName);
     * }
     * ```
     */
    getActiveTextEditor(): TextEditor | undefined;
    
    /**
     * Register a listener for active editor changes.
     * 
     * @param listener The callback function invoked when the active editor changes
     * @returns A disposable that removes the listener when disposed
     * 
     * @example
     * ```typescript
     * const disposable = adapter.onDidChangeActiveTextEditor(editor => {
     *     if (editor?.document.fileName.endsWith('tasks.md')) {
     *         taskProvider.refresh();
     *     }
     * });
     * ```
     */
    onDidChangeActiveTextEditor(listener: (editor: TextEditor | undefined) => void): Disposable;
    
    // ========================================================================
    // Commands
    // ========================================================================
    
    /**
     * Register a command handler.
     * 
     * Commands are actions that can be invoked via the command palette,
     * keyboard shortcuts, or programmatically.
     * 
     * @param command The command ID (should match package.json contributes.commands)
     * @param callback The function to execute when the command is invoked
     * @returns A disposable that unregisters the command when disposed
     * 
     * @example
     * ```typescript
     * const disposable = adapter.registerCommand(
     *     'kiro-copilot.switchToVibeMode',
     *     async () => {
     *         await modeManager.setMode('vibe');
     *         await adapter.showInformationMessage('Switched to Vibe mode');
     *     }
     * );
     * context.subscriptions.push(disposable);
     * ```
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCommand(command: string, callback: (...args: any[]) => any): Disposable;
    
    /**
     * Execute a command by ID.
     * 
     * Can execute both built-in IDE commands and extension-registered commands.
     * 
     * @param command The command ID to execute
     * @param args Arguments to pass to the command handler
     * @returns A promise that resolves to the command's return value
     * 
     * @example
     * ```typescript
     * // Open a file in the editor
     * await adapter.executeCommand('vscode.open', fileUri);
     * 
     * // Execute a custom command
     * await adapter.executeCommand('kiro-copilot.refreshTasks');
     * ```
     */
    executeCommand<T = unknown>(command: string, ...args: unknown[]): Promise<T>;
    
    // ========================================================================
    // Chat
    // ========================================================================
    
    /**
     * Create a chat participant for conversational AI interactions.
     * 
     * Chat participants respond to @-mentions in the IDE's chat interface
     * and can process slash commands.
     * 
     * @param id The unique identifier for the participant (e.g., 'kiro-copilot.assistant')
     * @param handler The function that processes chat requests
     * @returns The created chat participant
     * @throws PlatformFeatureUnavailableError if chat is not supported
     * 
     * @example
     * ```typescript
     * const participant = adapter.createChatParticipant(
     *     'kiro-copilot.assistant',
     *     async (request, context, stream, token) => {
     *         if (request.command === 'vibe') {
     *             stream.markdown('Switching to **Vibe Coding** mode 🎯\n');
     *             await modeManager.setMode('vibe');
     *         }
     *     }
     * );
     * participant.iconPath = adapter.joinPath(extensionUri, 'resources', 'icon.svg');
     * ```
     */
    createChatParticipant(id: string, handler: ChatRequestHandler): ChatParticipant;
    
    // ========================================================================
    // Clipboard
    // ========================================================================
    
    /**
     * Write text to the system clipboard.
     * 
     * @param text The text to write to the clipboard
     * 
     * @example
     * ```typescript
     * await adapter.writeToClipboard(generatedCode);
     * await adapter.showInformationMessage('Code copied to clipboard');
     * ```
     */
    writeToClipboard(text: string): Promise<void>;
    
    /**
     * Read text from the system clipboard.
     * 
     * @returns A promise that resolves to the clipboard contents
     * 
     * @example
     * ```typescript
     * const clipboardText = await adapter.readFromClipboard();
     * if (clipboardText.startsWith('```')) {
     *     // Process code block
     * }
     * ```
     */
    readFromClipboard(): Promise<string>;
    
    // ========================================================================
    // Context
    // ========================================================================
    
    /**
     * Get the extension context.
     * 
     * The extension context provides access to extension-specific storage,
     * paths, and the subscriptions array for disposable management.
     * 
     * @returns The extension context
     * 
     * @example
     * ```typescript
     * const context = adapter.getExtensionContext();
     * const storagePath = context.globalStoragePath;
     * context.subscriptions.push(someDisposable);
     * ```
     */
    getExtensionContext(): ExtensionContext;
    
    // ========================================================================
    // URI Factory
    // ========================================================================
    
    /**
     * Create a file URI from a file system path.
     * 
     * @param path The file system path (e.g., '/home/user/project/file.ts')
     * @returns A Uri representing the file
     * 
     * @example
     * ```typescript
     * const uri = adapter.createFileUri('C:\\Users\\dev\\project\\tasks.md');
     * const content = await adapter.readFile(uri);
     * ```
     */
    createFileUri(path: string): Uri;
    
    /**
     * Parse a URI from its string representation.
     * 
     * @param value The URI string (e.g., 'file:///path/to/file' or 'untitled:Untitled-1')
     * @returns The parsed Uri
     * 
     * @example
     * ```typescript
     * const uri = adapter.parseUri('file:///home/user/project/file.ts');
     * console.log(uri.fsPath); // '/home/user/project/file.ts'
     * ```
     */
    parseUri(value: string): Uri;
    
    /**
     * Join path segments to a base URI.
     * 
     * @param base The base URI
     * @param pathSegments The path segments to join
     * @returns A new URI with the joined path
     * 
     * @example
     * ```typescript
     * const workspaceUri = folders[0].uri;
     * const kiroUri = adapter.joinPath(workspaceUri, '.kiro');
     * const specsUri = adapter.joinPath(kiroUri, 'specs');
     * const featureUri = adapter.joinPath(specsUri, 'new-feature', 'requirements.md');
     * ```
     */
    joinPath(base: Uri, ...pathSegments: string[]): Uri;
    
    // ========================================================================
    // Workspace File Operations
    // ========================================================================
    
    /**
     * Find files across the workspace matching a glob pattern.
     * 
     * @param include A glob pattern that defines files to search for
     * @param exclude A glob pattern that defines files to exclude
     * @param maxResults Limits the number of results
     * @returns An array of URIs that match the glob pattern
     * 
     * @example
     * ```typescript
     * const taskFiles = await adapter.findFiles(
     *     '**\/.kiro/specs/**\/tasks.md',
     *     '**\/node_modules\/**',
     *     100
     * );
     * ```
     */
    findFiles(include: string, exclude?: string, maxResults?: number): Promise<Uri[]>;
    
    /**
     * Register a listener for file creation events.
     * 
     * @param listener The callback function invoked when files are created
     * @returns A disposable that removes the listener when disposed
     * 
     * @example
     * ```typescript
     * const disposable = adapter.onDidCreateFiles(files => {
     *     for (const uri of files) {
     *         console.log('File created:', uri.fsPath);
     *     }
     * });
     * ```
     */
    onDidCreateFiles(listener: (files: readonly Uri[]) => void): Disposable;
    
    /**
     * Register a listener for file deletion events.
     * 
     * @param listener The callback function invoked when files are deleted
     * @returns A disposable that removes the listener when disposed
     * 
     * @example
     * ```typescript
     * const disposable = adapter.onDidDeleteFiles(files => {
     *     for (const uri of files) {
     *         console.log('File deleted:', uri.fsPath);
     *     }
     * });
     * ```
     */
    onDidDeleteFiles(listener: (files: readonly Uri[]) => void): Disposable;
    
    // ========================================================================
    // Progress Reporting
    // ========================================================================
    
    /**
     * Show a progress indicator while running a task.
     * 
     * @param options Options for the progress indicator
     * @param task The task to run with progress
     * @returns The result of the task
     * 
     * @example
     * ```typescript
     * await adapter.withProgress({
     *     location: 'notification',
     *     title: 'Scanning tasks...',
     *     cancellable: false
     * }, async (progress) => {
     *     progress.report({ increment: 50 });
     *     await scanTasks();
     *     progress.report({ increment: 50 });
     * });
     * ```
     */
    withProgress<T>(
        options: {
            location: 'notification' | 'window' | 'scm';
            title?: string;
            cancellable?: boolean;
        },
        task: (progress: { report: (value: { message?: string; increment?: number }) => void }) => Promise<T>
    ): Promise<T>;
    
    // ========================================================================
    // Event Emitters (for adapter implementations)
    // ========================================================================
    
    /**
     * Create an event emitter.
     * 
     * Event emitters allow adapters to create custom events that
     * services can subscribe to.
     * 
     * @returns A new event emitter
     * 
     * @example
     * ```typescript
     * const emitter = adapter.createEventEmitter<string>();
     * const disposable = emitter.event(value => console.log(value));
     * emitter.fire('Hello!');
     * ```
     */
    createEventEmitter<T>(): EventEmitter<T>;
}

/**
 * Capabilities that may vary between platforms.
 * Used for feature detection and graceful degradation.
 * 
 * Check these capabilities before using features that may not
 * be available on all platforms.
 * 
 * @example
 * ```typescript
 * if (capabilities.supportsChatParticipants) {
 *     const participant = adapter.createChatParticipant(...);
 * } else {
 *     console.log('Chat not available, using command palette fallback');
 * }
 * ```
 */
export interface PlatformCapabilities {
    /** Whether the platform supports chat participants (@-mentions) */
    supportsChatParticipants: boolean;
    
    /** Whether the platform supports tree views in the sidebar */
    supportsTreeViews: boolean;
    
    /** Whether the platform supports file system watchers */
    supportsFileSystemWatchers: boolean;
    
    /** Whether the platform supports custom editor types */
    supportsCustomEditors: boolean;
    
    /** Whether the platform supports webview panels */
    supportsWebviews: boolean;
    
    /** Whether the platform supports status bar items */
    supportsStatusBar: boolean;
    
    /** Whether the platform supports output channels */
    supportsOutputChannels: boolean;
}

/**
 * Metadata about the current platform.
 * Combines identification with capability information.
 */
export interface PlatformMetadata {
    /** The name of the platform ('vscode', 'antigravity', or 'unknown') */
    name: PlatformName;
    
    /** The version string of the platform */
    version: string;
    
    /** The capabilities supported by this platform */
    capabilities: PlatformCapabilities;
}
