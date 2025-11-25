/**
 * VS Code Adapter Implementation
 * 
 * This adapter implements IPlatformAdapter for Visual Studio Code by delegating
 * all operations to the native `vscode` module.
 * 
 * This is a stub file that will be fully implemented in Task 4.
 * 
 * @module adapters/VSCodeAdapter
 */

import * as vscode from 'vscode';
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

import { StatusBarAlignment, ConfigurationTarget } from './types';

/**
 * VS Code implementation of IPlatformAdapter.
 * 
 * This adapter provides zero-overhead delegation to VS Code APIs,
 * ensuring that existing functionality remains intact while enabling
 * platform abstraction.
 * 
 * @example
 * ```typescript
 * const adapter = new VSCodeAdapter(context);
 * await adapter.showInformationMessage('Hello from VS Code!');
 * ```
 */
export class VSCodeAdapter implements IPlatformAdapter {
    // ========================================================================
    // Environment Metadata
    // ========================================================================
    
    public readonly platformName = 'vscode' as const;
    public readonly version: string;
    
    // ========================================================================
    // Private State
    // ========================================================================
    
    private readonly context: vscode.ExtensionContext;
    
    // ========================================================================
    // Constructor
    // ========================================================================
    
    /**
     * Creates a new VSCodeAdapter.
     * 
     * @param context The VS Code extension context
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(context: any) {
        this.context = context as vscode.ExtensionContext;
        this.version = vscode.version;
    }
    
    // ========================================================================
    // Notifications / Messages
    // ========================================================================
    
    async showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
        return vscode.window.showInformationMessage(message, ...items);
    }
    
    async showWarningMessage(message: string, ...args: unknown[]): Promise<string | undefined> {
        // Check if first arg is options object
        if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null && 'modal' in args[0]) {
            const options = args[0] as { modal: boolean };
            const items = args.slice(1) as string[];
            return vscode.window.showWarningMessage(message, options, ...items);
        }
        return vscode.window.showWarningMessage(message, ...(args as string[]));
    }
    
    async showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
        return vscode.window.showErrorMessage(message, ...items);
    }
    
    // ========================================================================
    // Input
    // ========================================================================
    
    async showInputBox(options: InputBoxOptions): Promise<string | undefined> {
        return vscode.window.showInputBox(options as vscode.InputBoxOptions);
    }
    
    async showQuickPick<T extends QuickPickItem>(
        items: T[] | Promise<T[]>, 
        options?: QuickPickOptions
    ): Promise<T | undefined> {
        return vscode.window.showQuickPick(
            items as vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>,
            options as vscode.QuickPickOptions
        ) as Promise<T | undefined>;
    }
    
    // ========================================================================
    // UI Components
    // ========================================================================
    
    registerTreeDataProvider<T>(viewId: string, provider: TreeDataProvider<T>): Disposable {
        return vscode.window.registerTreeDataProvider(
            viewId, 
            provider as vscode.TreeDataProvider<T>
        );
    }
    
    createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem {
        const vscodeAlignment = alignment === StatusBarAlignment.Left 
            ? vscode.StatusBarAlignment.Left 
            : vscode.StatusBarAlignment.Right;
        return vscode.window.createStatusBarItem(vscodeAlignment, priority) as unknown as StatusBarItem;
    }
    
    createOutputChannel(name: string): OutputChannel {
        return vscode.window.createOutputChannel(name) as unknown as OutputChannel;
    }
    
    // ========================================================================
    // Configuration
    // ========================================================================
    
    getConfiguration(section?: string): Configuration {
        const config = vscode.workspace.getConfiguration(section);
        return {
            get: <T>(key: string, defaultValue?: T): T | undefined => {
                return config.get<T>(key, defaultValue!);
            },
            update: async (key: string, value: unknown, target?: ConfigurationTarget): Promise<void> => {
                const vscodeTarget = this.mapConfigurationTarget(target);
                await config.update(key, value, vscodeTarget);
            },
            has: (key: string): boolean => {
                return config.has(key);
            },
            inspect: function<T>(key: string) {
                const result = config.inspect<T>(key);
                return result;
            }
        };
    }
    
    onDidChangeConfiguration(listener: (event: ConfigurationChangeEvent) => void): Disposable {
        return vscode.workspace.onDidChangeConfiguration((e) => {
            listener({
                affectsConfiguration: (section: string, scope?: { uri?: Uri; languageId?: string }) => {
                    return e.affectsConfiguration(section, scope?.uri as vscode.Uri);
                }
            });
        });
    }
    
    // ========================================================================
    // File System
    // ========================================================================
    
    async readFile(uri: Uri): Promise<Uint8Array> {
        return vscode.workspace.fs.readFile(uri as vscode.Uri);
    }
    
    async writeFile(uri: Uri, content: Uint8Array): Promise<void> {
        await vscode.workspace.fs.writeFile(uri as vscode.Uri, content);
    }
    
    async stat(uri: Uri): Promise<FileStat> {
        const stat = await vscode.workspace.fs.stat(uri as vscode.Uri);
        return {
            type: stat.type as unknown as FileType,
            ctime: stat.ctime,
            mtime: stat.mtime,
            size: stat.size,
            permissions: stat.permissions
        };
    }
    
    async readDirectory(uri: Uri): Promise<[string, FileType][]> {
        const entries = await vscode.workspace.fs.readDirectory(uri as vscode.Uri);
        return entries.map(([name, type]) => [name, type as unknown as FileType]);
    }
    
    async createDirectory(uri: Uri): Promise<void> {
        await vscode.workspace.fs.createDirectory(uri as vscode.Uri);
    }
    
    async delete(uri: Uri, options?: { recursive?: boolean; useTrash?: boolean }): Promise<void> {
        await vscode.workspace.fs.delete(uri as vscode.Uri, options);
    }
    
    async copy(source: Uri, target: Uri, options?: { overwrite?: boolean }): Promise<void> {
        await vscode.workspace.fs.copy(source as vscode.Uri, target as vscode.Uri, options);
    }
    
    async exists(uri: Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri as vscode.Uri);
            return true;
        } catch {
            return false;
        }
    }
    
    createFileSystemWatcher(
        globPattern: string,
        ignoreCreateEvents?: boolean,
        ignoreChangeEvents?: boolean,
        ignoreDeleteEvents?: boolean
    ): FileSystemWatcher {
        const watcher = vscode.workspace.createFileSystemWatcher(
            globPattern,
            ignoreCreateEvents,
            ignoreChangeEvents,
            ignoreDeleteEvents
        );
        return {
            onDidCreate: watcher.onDidCreate as unknown as FileSystemWatcher['onDidCreate'],
            onDidChange: watcher.onDidChange as unknown as FileSystemWatcher['onDidChange'],
            onDidDelete: watcher.onDidDelete as unknown as FileSystemWatcher['onDidDelete'],
            dispose: () => watcher.dispose()
        };
    }
    
    createRelativePatternWatcher(
        workspaceFolder: WorkspaceFolder,
        pattern: string,
        ignoreCreateEvents?: boolean,
        ignoreChangeEvents?: boolean,
        ignoreDeleteEvents?: boolean
    ): FileSystemWatcher {
        const relativePattern = new vscode.RelativePattern(workspaceFolder as vscode.WorkspaceFolder, pattern);
        const watcher = vscode.workspace.createFileSystemWatcher(
            relativePattern,
            ignoreCreateEvents,
            ignoreChangeEvents,
            ignoreDeleteEvents
        );
        return {
            onDidCreate: watcher.onDidCreate as unknown as FileSystemWatcher['onDidCreate'],
            onDidChange: watcher.onDidChange as unknown as FileSystemWatcher['onDidChange'],
            onDidDelete: watcher.onDidDelete as unknown as FileSystemWatcher['onDidDelete'],
            dispose: () => watcher.dispose()
        };
    }
    
    // ========================================================================
    // Workspace
    // ========================================================================
    
    getWorkspaceFolders(): WorkspaceFolder[] | undefined {
        return vscode.workspace.workspaceFolders as unknown as WorkspaceFolder[] | undefined;
    }
    
    getActiveTextEditor(): TextEditor | undefined {
        return vscode.window.activeTextEditor as unknown as TextEditor | undefined;
    }
    
    onDidChangeActiveTextEditor(listener: (editor: TextEditor | undefined) => void): Disposable {
        return vscode.window.onDidChangeActiveTextEditor((editor) => {
            listener(editor as unknown as TextEditor | undefined);
        });
    }
    
    // ========================================================================
    // Commands
    // ========================================================================
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerCommand(command: string, callback: (...args: any[]) => any): Disposable {
        return vscode.commands.registerCommand(command, callback);
    }
    
    executeCommand<T = unknown>(command: string, ...args: unknown[]): Promise<T> {
        return Promise.resolve(vscode.commands.executeCommand<T>(command, ...args));
    }
    
    // ========================================================================
    // Chat
    // ========================================================================
    
    createChatParticipant(id: string, handler: ChatRequestHandler): ChatParticipant {
        return vscode.chat.createChatParticipant(
            id,
            handler as unknown as vscode.ChatRequestHandler
        ) as unknown as ChatParticipant;
    }
    
    // ========================================================================
    // Clipboard
    // ========================================================================
    
    async writeToClipboard(text: string): Promise<void> {
        await vscode.env.clipboard.writeText(text);
    }
    
    async readFromClipboard(): Promise<string> {
        return vscode.env.clipboard.readText();
    }
    
    // ========================================================================
    // Context
    // ========================================================================
    
    getExtensionContext(): ExtensionContext {
        return this.context as unknown as ExtensionContext;
    }
    
    // ========================================================================
    // URI Factory
    // ========================================================================
    
    createFileUri(path: string): Uri {
        return vscode.Uri.file(path) as unknown as Uri;
    }
    
    parseUri(value: string): Uri {
        return vscode.Uri.parse(value) as unknown as Uri;
    }
    
    joinPath(base: Uri, ...pathSegments: string[]): Uri {
        return vscode.Uri.joinPath(base as vscode.Uri, ...pathSegments) as unknown as Uri;
    }
    
    // ========================================================================
    // Workspace File Operations
    // ========================================================================
    
    async findFiles(include: string, exclude?: string, maxResults?: number): Promise<Uri[]> {
        const uris = await vscode.workspace.findFiles(include, exclude, maxResults);
        return uris as unknown as Uri[];
    }
    
    onDidCreateFiles(listener: (files: readonly Uri[]) => void): Disposable {
        return vscode.workspace.onDidCreateFiles(event => {
            listener(event.files as unknown as readonly Uri[]);
        }) as unknown as Disposable;
    }
    
    onDidDeleteFiles(listener: (files: readonly Uri[]) => void): Disposable {
        return vscode.workspace.onDidDeleteFiles(event => {
            listener(event.files as unknown as readonly Uri[]);
        }) as unknown as Disposable;
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
        const locationMap: Record<string, vscode.ProgressLocation> = {
            'notification': vscode.ProgressLocation.Notification,
            'window': vscode.ProgressLocation.Window,
            'scm': vscode.ProgressLocation.SourceControl
        };
        
        return vscode.window.withProgress(
            {
                location: locationMap[options.location] ?? vscode.ProgressLocation.Notification,
                title: options.title,
                cancellable: options.cancellable
            },
            async (progress) => task(progress)
        );
    }
    
    // ========================================================================
    // Event Emitters
    // ========================================================================
    
    createEventEmitter<T>(): AdapterEventEmitter<T> {
        const emitter = new vscode.EventEmitter<T>();
        return {
            event: emitter.event as unknown as AdapterEventEmitter<T>['event'],
            fire: (data: T) => emitter.fire(data),
            dispose: () => emitter.dispose()
        };
    }
    
    // ========================================================================
    // Private Helpers
    // ========================================================================
    
    private mapConfigurationTarget(target?: ConfigurationTarget): vscode.ConfigurationTarget | undefined {
        if (target === undefined) {
            return undefined;
        }
        switch (target) {
            case ConfigurationTarget.Global:
                return vscode.ConfigurationTarget.Global;
            case ConfigurationTarget.Workspace:
                return vscode.ConfigurationTarget.Workspace;
            case ConfigurationTarget.WorkspaceFolder:
                return vscode.ConfigurationTarget.WorkspaceFolder;
            default:
                return undefined;
        }
    }
}
