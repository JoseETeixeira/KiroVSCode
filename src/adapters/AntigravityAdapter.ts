/**
 * Antigravity Adapter Implementation (Stub)
 * 
 * This adapter implements IPlatformAdapter for Antigravity IDE by delegating
 * operations to the Antigravity extension API.
 * 
 * This is a stub file that will be fully implemented in Task 5.
 * Currently, it provides placeholder implementations that throw 
 * PlatformFeatureUnavailableError for features that need Antigravity API access.
 * 
 * @module adapters/AntigravityAdapter
 */

import type { IPlatformAdapter } from './IPlatformAdapter';
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
    EventEmitter as AdapterEventEmitter
} from './types';

import { 
    StatusBarAlignment, 
    ConfigurationTarget
} from './types';

import { PlatformFeatureUnavailableError } from './errors';

// ============================================================================
// Antigravity API Type Declarations (assumptions)
// ============================================================================

/**
 * Assumed structure of the Antigravity global object.
 * These types will be refined as we learn more about the actual API.
 */
interface AntigravityGlobal {
    version: string;
    ui: {
        showNotification(options: {
            type: 'info' | 'warning' | 'error';
            message: string;
            actions?: string[];
        }): Promise<string | undefined>;
        showInputBox(options: unknown): Promise<string | undefined>;
        showQuickPick<T>(items: T[], options?: unknown): Promise<T | undefined>;
        registerTreeView(id: string, provider: unknown): Disposable;
        createStatusBarItem(alignment?: string, priority?: number): unknown;
        createOutputChannel(name: string): unknown;
    };
    config: {
        get(section?: string): {
            get<T>(key: string, defaultValue?: T): T | undefined;
            set(key: string, value: unknown): Promise<void>;
            has(key: string): boolean;
        };
        onDidChange(listener: (event: unknown) => void): Disposable;
    };
    fs: {
        readFile(uri: unknown): Promise<Uint8Array>;
        writeFile(uri: unknown, content: Uint8Array): Promise<void>;
        stat(uri: unknown): Promise<FileStat>;
        readDirectory(uri: unknown): Promise<[string, FileType][]>;
        createDirectory(uri: unknown): Promise<void>;
        delete(uri: unknown, options?: { recursive?: boolean }): Promise<void>;
        watch(pattern: string): FileSystemWatcher;
    };
    workspace: {
        folders: WorkspaceFolder[] | undefined;
        activeEditor: TextEditor | undefined;
        onDidChangeActiveEditor(listener: (editor: TextEditor | undefined) => void): Disposable;
        findFiles(include: string, exclude?: string, maxResults?: number): Promise<Uri[]>;
        onDidCreateFiles(listener: (event: { files: readonly Uri[] }) => void): Disposable;
        onDidDeleteFiles(listener: (event: { files: readonly Uri[] }) => void): Disposable;
    };
    window: {
        withProgress<T>(
            options: { location: string; title?: string; cancellable?: boolean },
            task: (progress: { report: (value: { message?: string; increment?: number }) => void }) => Promise<T>
        ): Promise<T>;
    };
    commands: {
        register(command: string, callback: (...args: unknown[]) => unknown): Disposable;
        execute<T>(command: string, ...args: unknown[]): Promise<T>;
    };
    chat?: {
        createParticipant(id: string, handler: unknown): ChatParticipant;
    };
    clipboard: {
        write(text: string): Promise<void>;
        read(): Promise<string>;
    };
    Uri: {
        file(path: string): Uri;
        parse(value: string): Uri;
        joinPath(base: Uri, ...segments: string[]): Uri;
    };
}

/**
 * Gets the Antigravity global object.
 */
function getAntigravity(): AntigravityGlobal | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).antigravity as AntigravityGlobal | undefined;
}

/**
 * Antigravity implementation of IPlatformAdapter.
 * 
 * This adapter provides mappings from the platform-agnostic interface
 * to Antigravity's specific API structure. Where features are not
 * available, it throws PlatformFeatureUnavailableError.
 * 
 * **Note**: This is currently a stub implementation. The actual Antigravity
 * API structure is assumed based on common IDE patterns. This will be
 * refined when actual Antigravity documentation is available.
 * 
 * @example
 * ```typescript
 * const adapter = new AntigravityAdapter(context);
 * await adapter.showInformationMessage('Hello from Antigravity!');
 * ```
 */
export class AntigravityAdapter implements IPlatformAdapter {
    // ========================================================================
    // Environment Metadata
    // ========================================================================
    
    public readonly platformName = 'antigravity' as const;
    public readonly version: string;
    
    // ========================================================================
    // Private State
    // ========================================================================
    
    private readonly context: ExtensionContext;
    private readonly antigravity: AntigravityGlobal;
    
    // ========================================================================
    // Constructor
    // ========================================================================
    
    /**
     * Creates a new AntigravityAdapter.
     * 
     * @param context The Antigravity extension context
     * @throws Error if Antigravity global is not available
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(context: any) {
        this.context = context as ExtensionContext;
        
        const antigravity = getAntigravity();
        if (!antigravity) {
            throw new Error('Antigravity global object not found. Ensure the extension is running in Antigravity IDE.');
        }
        
        this.antigravity = antigravity;
        this.version = antigravity.version || 'unknown';
    }
    
    // ========================================================================
    // Notifications / Messages
    // ========================================================================
    
    async showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
        return this.antigravity.ui.showNotification({
            type: 'info',
            message,
            actions: items.length > 0 ? items : undefined
        });
    }
    
    async showWarningMessage(message: string, ...args: unknown[]): Promise<string | undefined> {
        // Check if first arg is options object (modal option)
        let items: string[];
        if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null && 'modal' in args[0]) {
            // Antigravity may handle modal differently - for now just use items
            items = args.slice(1) as string[];
        } else {
            items = args as string[];
        }
        
        return this.antigravity.ui.showNotification({
            type: 'warning',
            message,
            actions: items.length > 0 ? items : undefined
        });
    }
    
    async showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
        return this.antigravity.ui.showNotification({
            type: 'error',
            message,
            actions: items.length > 0 ? items : undefined
        });
    }
    
    // ========================================================================
    // Input
    // ========================================================================
    
    async showInputBox(options: InputBoxOptions): Promise<string | undefined> {
        return this.antigravity.ui.showInputBox(options);
    }
    
    async showQuickPick<T extends QuickPickItem>(
        items: T[] | Promise<T[]>, 
        options?: QuickPickOptions
    ): Promise<T | undefined> {
        const resolvedItems = await items;
        return this.antigravity.ui.showQuickPick(resolvedItems, options);
    }
    
    // ========================================================================
    // UI Components
    // ========================================================================
    
    registerTreeDataProvider<T>(viewId: string, provider: TreeDataProvider<T>): Disposable {
        return this.antigravity.ui.registerTreeView(viewId, provider);
    }
    
    createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem {
        const alignmentStr = alignment === StatusBarAlignment.Left ? 'left' : 'right';
        const item = this.antigravity.ui.createStatusBarItem(alignmentStr, priority);
        return item as unknown as StatusBarItem;
    }
    
    createOutputChannel(name: string): OutputChannel {
        return this.antigravity.ui.createOutputChannel(name) as unknown as OutputChannel;
    }
    
    // ========================================================================
    // Configuration
    // ========================================================================
    
    getConfiguration(section?: string): Configuration {
        const config = this.antigravity.config.get(section);
        return {
            get: <T>(key: string, defaultValue?: T): T | undefined => {
                return config.get(key, defaultValue);
            },
            update: async (key: string, value: unknown, _target?: ConfigurationTarget): Promise<void> => {
                void _target; // Antigravity may not support configuration targets
                await config.set(key, value);
            },
            has: (key: string): boolean => {
                return config.has(key);
            },
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            inspect: function<T>(_key: string) {
                // Antigravity may not support configuration inspection
                // Return undefined to indicate this feature is not available
                return undefined;
            }
        };
    }
    
    onDidChangeConfiguration(listener: (event: ConfigurationChangeEvent) => void): Disposable {
        return this.antigravity.config.onDidChange(() => {
            // Adapt Antigravity's event format to our interface
            listener({
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                affectsConfiguration: (_section: string, _scope?: { uri?: Uri; languageId?: string }) => {
                    // Antigravity may have a different way of checking affected sections
                    // For now, return true to indicate all sections may be affected
                    return true;
                }
            });
        });
    }
    
    // ========================================================================
    // File System
    // ========================================================================
    
    async readFile(uri: Uri): Promise<Uint8Array> {
        return this.antigravity.fs.readFile(uri);
    }
    
    async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
        await this.antigravity.fs.writeFile(uri, content);
    }
    
    async stat(uri: Uri): Promise<FileStat> {
        return this.antigravity.fs.stat(uri);
    }
    
    async readDirectory(uri: Uri): Promise<[string, FileType][]> {
        return this.antigravity.fs.readDirectory(uri);
    }
    
    async createDirectory(uri: Uri): Promise<void> {
        await this.antigravity.fs.createDirectory(uri);
    }
    
    async delete(uri: Uri, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void> {
        // Antigravity may not support useTrash option
        await this.antigravity.fs.delete(uri, { recursive: options?.recursive });
    }
    
    async copy(source: Uri, target: Uri, options?: { overwrite?: boolean }): Promise<void> {
        // Antigravity implementation - copy file by reading and writing
        // (Antigravity may have a native copy method to use instead)
        const content = await this.antigravity.fs.readFile(source);
        if (!options?.overwrite) {
            try {
                await this.antigravity.fs.stat(target);
                // File exists and overwrite is false, skip
                return;
            } catch {
                // File doesn't exist, proceed with copy
            }
        }
        await this.antigravity.fs.writeFile(target, content);
    }
    
    async exists(uri: Uri): Promise<boolean> {
        try {
            await this.antigravity.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }
    
    createFileSystemWatcher(
        globPattern: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ignoreCreateEvents?: boolean,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ignoreChangeEvents?: boolean,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ignoreDeleteEvents?: boolean
    ): FileSystemWatcher {
        // Antigravity implementation - may need to handle ignore flags differently
        return this.antigravity.fs.watch(globPattern);
    }
    
    createRelativePatternWatcher(
        workspaceFolder: WorkspaceFolder,
        pattern: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ignoreCreateEvents?: boolean,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ignoreChangeEvents?: boolean,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ignoreDeleteEvents?: boolean
    ): FileSystemWatcher {
        // Create a relative pattern for Antigravity
        const fullPattern = `${workspaceFolder.uri.fsPath}/${pattern}`;
        return this.antigravity.fs.watch(fullPattern);
    }
    
    // ========================================================================
    // Workspace
    // ========================================================================
    
    getWorkspaceFolders(): WorkspaceFolder[] | undefined {
        return this.antigravity.workspace.folders;
    }
    
    getActiveTextEditor(): TextEditor | undefined {
        return this.antigravity.workspace.activeEditor;
    }
    
    onDidChangeActiveTextEditor(listener: (editor: TextEditor | undefined) => void): Disposable {
        return this.antigravity.workspace.onDidChangeActiveEditor(listener);
    }
    
    // ========================================================================
    // Commands
    // ========================================================================
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCommand(command: string, callback: (...args: any[]) => any): Disposable {
        return this.antigravity.commands.register(command, callback);
    }
    
    executeCommand<T = unknown>(command: string, ...args: unknown[]): Promise<T> {
        return this.antigravity.commands.execute<T>(command, ...args);
    }
    
    // ========================================================================
    // Chat
    // ========================================================================
    
    createChatParticipant(id: string, handler: ChatRequestHandler): ChatParticipant {
        if (!this.antigravity.chat) {
            throw new PlatformFeatureUnavailableError(
                'Chat Participants',
                'antigravity',
                this.version,
                'Chat participants may not be available in this version of Antigravity. ' +
                'Consider using command-based interactions as a fallback.'
            );
        }
        return this.antigravity.chat.createParticipant(id, handler);
    }
    
    // ========================================================================
    // Clipboard
    // ========================================================================
    
    async writeToClipboard(text: string): Promise<void> {
        await this.antigravity.clipboard.write(text);
    }
    
    async readFromClipboard(): Promise<string> {
        return this.antigravity.clipboard.read();
    }
    
    // ========================================================================
    // Context
    // ========================================================================
    
    getExtensionContext(): ExtensionContext {
        return this.context;
    }
    
    // ========================================================================
    // URI Factory
    // ========================================================================
    
    createFileUri(path: string): Uri {
        return this.antigravity.Uri.file(path);
    }
    
    parseUri(value: string): Uri {
        return this.antigravity.Uri.parse(value);
    }
    
    joinPath(base: Uri, ...pathSegments: string[]): Uri {
        return this.antigravity.Uri.joinPath(base, ...pathSegments);
    }
    
    // ========================================================================
    // Workspace File Operations
    // ========================================================================
    
    async findFiles(include: string, exclude?: string, maxResults?: number): Promise<Uri[]> {
        // Antigravity implementation would use its file search API
        return this.antigravity.workspace.findFiles(include, exclude, maxResults);
    }
    
    onDidCreateFiles(listener: (files: readonly Uri[]) => void): Disposable {
        return this.antigravity.workspace.onDidCreateFiles((event: { files: readonly Uri[] }) => {
            listener(event.files);
        });
    }
    
    onDidDeleteFiles(listener: (files: readonly Uri[]) => void): Disposable {
        return this.antigravity.workspace.onDidDeleteFiles((event: { files: readonly Uri[] }) => {
            listener(event.files);
        });
    }
    
    // ========================================================================
    // Progress Reporting
    // ========================================================================
    
    async withProgress<T>(
        options: {
            location: 'notification' | 'window' | 'scm';
            title?: string;
            cancellable?: boolean;
        },
        task: (progress: { report: (value: { message?: string; increment?: number }) => void }) => Promise<T>
    ): Promise<T> {
        // Antigravity implementation would use its progress API
        return this.antigravity.window.withProgress(options, task);
    }
    
    // ========================================================================
    // Event Emitters
    // ========================================================================
    
    createEventEmitter<T>(): AdapterEventEmitter<T> {
        // Create a simple event emitter implementation
        // Antigravity may have its own EventEmitter, but for now we create one
        const listeners: Array<(e: T) => void> = [];
        
        return {
            event: (listener: (e: T) => void) => {
                listeners.push(listener);
                return {
                    dispose: () => {
                        const index = listeners.indexOf(listener);
                        if (index >= 0) {
                            listeners.splice(index, 1);
                        }
                    }
                };
            },
            fire: (data: T) => {
                listeners.forEach(listener => listener(data));
            },
            dispose: () => {
                listeners.length = 0;
            }
        };
    }
}
