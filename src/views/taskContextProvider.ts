import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PromptManager } from '../services/promptManager';
import { ModeManager } from '../services/modeManager';

export type TaskStatus = 'pending' | 'completed' | 'failed';

export interface TaskItem {
    label: string;
    description: string;
    lineNumber: number;
    taskContent: string;
    status: TaskStatus;
    specFolder?: string;
    filePath: string;
}

interface TaskScanResult {
    filePath: string;
    relativePath: string;
    tasks: TaskItem[];
    lastModified: number;
    specFolder?: string;
}

interface WorkspaceTaskMap {
    [filePath: string]: TaskScanResult;
}

export interface TaskContext {
    filePath: string;
    relativePath: string;
    specFolder?: string;
    allTasks: TaskItem[];
    activeTask?: TaskItem;
    selectedText?: string;
}

interface SpecFolderInfo {
    name: string;
    path: string;
    tasks: TaskItem[];
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
}

interface TaskGroup {
    label: string;
    relativePath: string;
    tasks: TaskItem[];
    completedCount: number;
    failedCount: number;
    isSpec: boolean;
}

export class TaskContextProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private taskCache: WorkspaceTaskMap = {};
    private scanInProgress: boolean = false;
    private initialScanComplete: boolean = false;
    private lastScanTimestamp: number = 0;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private readonly DEBOUNCE_DELAY = 1000; // 1 second

    constructor(
        private promptManager: PromptManager,
        private modeManager: ModeManager
    ) {
        // Initialize file system watcher
        this.initializeFileWatcher();

        // Perform initial scan
        this.performInitialScan();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            console.log('[TaskContextProvider] No workspace folders found');
            return [];
        }

        // Wait for initial scan to complete
        if (!this.initialScanComplete) {
            console.log('[TaskContextProvider] Waiting for initial scan to complete...');
            // Wait up to 5 seconds for scan to complete
            const maxWait = 5000;
            const startTime = Date.now();
            while (!this.initialScanComplete && (Date.now() - startTime) < maxWait) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (!this.initialScanComplete) {
                console.warn('[TaskContextProvider] Initial scan did not complete within timeout');
            }
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        if (!element) {
            // Root level - show mode indicator and all task groups
            const mode = this.modeManager.getCurrentMode();
            const allTaskGroups = this.getAllTaskGroups(workspaceRoot);

            const totalTasks = allTaskGroups.reduce((sum, group) => sum + group.tasks.length, 0);
            console.log(`[TaskContextProvider] Building root tree view: ${allTaskGroups.length} task groups, ${totalTasks} total tasks`);

            const items: TaskTreeItem[] = [
                new TaskTreeItem(
                    `Mode: ${mode === 'vibe' ? 'Vibe Coding 🎯' : 'Spec 📋'}`,
                    'Current coding mode',
                    vscode.TreeItemCollapsibleState.None,
                    'mode-indicator',
                    undefined,
                    new vscode.ThemeIcon('symbol-namespace')
                )
            ];

            // Add all task groups from cache
            for (const group of allTaskGroups) {
                items.push(this.createTaskGroupItem(group));
            }

            return items;
        } else if (element.contextValue === 'task-group') {
            // Show tasks within a task group
            const groupItem = element as TaskGroupTreeItem;
            console.log(`[TaskContextProvider] Expanding task group '${groupItem.label}': ${groupItem.taskGroup.tasks.length} tasks`);
            return groupItem.taskGroup.tasks.map(task => this.createTaskItem(task));
        }

        return [];
    }

    private createSpecFolderItem(spec: SpecFolderInfo): SpecFolderTreeItem {
        const statusIcon = this.getSpecFolderIcon(spec);
        const statusText = this.getSpecFolderStatus(spec);

        return new SpecFolderTreeItem(
            spec.name,
            `${statusText} • ${spec.tasks.length} task(s)`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'spec-folder',
            spec,
            undefined,
            statusIcon
        );
    }

    private createTaskItem(task: TaskItem): TaskTreeItem {
        const icon = this.getTaskIcon(task.status);
        const statusLabel = this.getTaskStatusLabel(task);

        return new TaskTreeItem(
            statusLabel,
            `${task.description} • ${task.status}`,
            vscode.TreeItemCollapsibleState.None,
            'task',
            {
                command: 'kiro-copilot.startTaskFromFile',
                title: 'Start Task',
                arguments: [task]
            },
            icon
        );
    }

    private getTaskIcon(status: TaskStatus): vscode.ThemeIcon {
        switch (status) {
            case 'completed':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
            case 'failed':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
            case 'pending':
            default:
                return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('testing.iconQueued'));
        }
    }

    private getTaskStatusLabel(task: TaskItem): string {
        const symbols = {
            'pending': '○',
            'completed': '✓',
            'failed': '✗'
        };
        return `${symbols[task.status]} ${task.label}`;
    }

    private getSpecFolderIcon(spec: SpecFolderInfo): vscode.ThemeIcon {
        if (spec.failedTasks > 0) {
            return new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconFailed'));
        } else if (spec.completedTasks === spec.totalTasks && spec.totalTasks > 0) {
            return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
        } else {
            return new vscode.ThemeIcon('folder', new vscode.ThemeColor('testing.iconQueued'));
        }
    }

    private getSpecFolderStatus(spec: SpecFolderInfo): string {
        if (spec.failedTasks > 0) {
            return `${spec.completedTasks}/${spec.totalTasks} completed, ${spec.failedTasks} failed`;
        }
        return `${spec.completedTasks}/${spec.totalTasks} completed`;
    }

    /**
     * Get all task groups from cache for tree view display
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private getAllTaskGroups(_workspaceRoot: string): TaskGroup[] {
        const groups: TaskGroup[] = [];

        for (const scanResult of Object.values(this.taskCache)) {
            const completedCount = scanResult.tasks.filter(t => t.status === 'completed').length;
            const failedCount = scanResult.tasks.filter(t => t.status === 'failed').length;

            // Determine the display label based on path
            let label: string;
            let isSpec = false;

            if (scanResult.specFolder) {
                // Spec folder task
                label = `📋 ${scanResult.specFolder}`;
                isSpec = true;
            } else if (scanResult.relativePath === 'tasks.md') {
                // Root tasks.md
                label = '📄 Root Tasks';
            } else {
                // Other nested tasks.md files
                const dir = path.dirname(scanResult.relativePath);
                label = `📁 ${dir}`;
            }

            groups.push({
                label,
                relativePath: scanResult.relativePath,
                tasks: scanResult.tasks,
                completedCount,
                failedCount,
                isSpec
            });
        }

        // Sort: spec folders first, then alphabetically
        groups.sort((a, b) => {
            if (a.isSpec && !b.isSpec) return -1;
            if (!a.isSpec && b.isSpec) return 1;
            return a.label.localeCompare(b.label);
        });

        return groups;
    }

    /**
     * Create a tree item for a task group
     */
    private createTaskGroupItem(group: TaskGroup): TaskGroupTreeItem {
        const icon = this.getTaskGroupIcon(group);
        const statusText = this.getTaskGroupStatus(group);

        return new TaskGroupTreeItem(
            group.label,
            `${statusText} • ${group.tasks.length} task(s)`,
            vscode.TreeItemCollapsibleState.Collapsed,
            'task-group',
            group,
            undefined,
            icon
        );
    }

    private getTaskGroupIcon(group: TaskGroup): vscode.ThemeIcon {
        if (group.failedCount > 0) {
            return new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconFailed'));
        } else if (group.completedCount === group.tasks.length && group.tasks.length > 0) {
            return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
        } else {
            return new vscode.ThemeIcon('folder', new vscode.ThemeColor('testing.iconQueued'));
        }
    }

    private getTaskGroupStatus(group: TaskGroup): string {
        if (group.failedCount > 0) {
            return `${group.completedCount}/${group.tasks.length} completed, ${group.failedCount} failed`;
        }
        return `${group.completedCount}/${group.tasks.length} completed`;
    }

    /**
     * Scan .kiro/specs/ directory for spec folders with tasks.md files
     */
    private async scanSpecFolders(workspaceRoot: string): Promise<SpecFolderInfo[]> {
        const specsPath = path.join(workspaceRoot, '.kiro', 'specs');
        const specFolders: SpecFolderInfo[] = [];

        try {
            const entries = await fs.readdir(specsPath, { withFileTypes: true });
            console.log(`[TaskContextProvider] Found ${entries.length} entries in .kiro/specs`);

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const specPath = path.join(specsPath, entry.name);
                    const tasksPath = path.join(specPath, 'tasks.md');

                    try {
                        await fs.access(tasksPath);
                        const tasks = await this.parseTasksFromFile(tasksPath, entry.name);

                        const completedCount = tasks.filter(t => t.status === 'completed').length;
                        const failedCount = tasks.filter(t => t.status === 'failed').length;

                        specFolders.push({
                            name: entry.name,
                            path: specPath,
                            tasks,
                            totalTasks: tasks.length,
                            completedTasks: completedCount,
                            failedTasks: failedCount
                        });

                        console.log(`[TaskContextProvider] Spec folder '${entry.name}': ${tasks.length} tasks (${completedCount} completed, ${failedCount} failed)`);
                    } catch {
                        // No tasks.md in this spec folder, skip it
                        console.log(`[TaskContextProvider] Spec folder '${entry.name}' has no tasks.md, skipping`);
                    }
                }
            }
        } catch (error) {
            // .kiro/specs doesn't exist, return empty array
            console.log(`[TaskContextProvider] .kiro/specs directory not found or not accessible`);
        }

        console.log(`[TaskContextProvider] Total spec folders with tasks: ${specFolders.length}`);
        return specFolders;
    }

    /**
     * Get tasks from root-level tasks.md (backward compatibility)
     */
    private async getRootTasks(workspaceRoot: string): Promise<TaskItem[]> {
        const rootTasksPath = path.join(workspaceRoot, 'tasks.md');

        try {
            await fs.access(rootTasksPath);
            return await this.parseTasksFromFile(rootTasksPath);
        } catch {
            return [];
        }
    }

    /**
     * Parse tasks from a tasks.md file
     */
    private async parseTasksFromFile(filePath: string, specFolder?: string): Promise<TaskItem[]> {
        const tasks: TaskItem[] = [];

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Match markdown checkboxes with status detection
                // - [ ] task (pending)
                // - [x] task (completed)
                // - [x] task [failed] or - [ ] task [FAILED] (failed)
                const checkboxMatch = line.match(/^[\s-]*\[([x ])\]\s*(.+)/i);
                if (checkboxMatch) {
                    const isChecked = checkboxMatch[1].toLowerCase() === 'x';
                    const taskText = checkboxMatch[2].trim();
                    const hasFailed = /\[failed\]/i.test(taskText);

                    let status: TaskStatus;
                    if (hasFailed) {
                        status = 'failed';
                    } else if (isChecked) {
                        status = 'completed';
                    } else {
                        status = 'pending';
                    }

                    // Remove [failed] tag from label
                    const cleanLabel = taskText.replace(/\[failed\]/gi, '').trim();

                    tasks.push({
                        label: cleanLabel,
                        description: `Line ${i + 1}`,
                        lineNumber: i,
                        taskContent: cleanLabel,
                        status,
                        specFolder,
                        filePath
                    });
                    continue;
                }

                // Match numbered tasks: 1. task or [ ] 5. task
                const numberedMatch = line.match(/^[\s-]*(?:\[([x ])\]\s*)?(\d+)\.\s*(.+)/i);
                if (numberedMatch) {
                    const isChecked = numberedMatch[1]?.toLowerCase() === 'x';
                    const taskNumber = numberedMatch[2];
                    const taskText = numberedMatch[3].trim();
                    const hasFailed = /\[failed\]/i.test(taskText);

                    let status: TaskStatus;
                    if (hasFailed) {
                        status = 'failed';
                    } else if (isChecked) {
                        status = 'completed';
                    } else {
                        status = 'pending';
                    }

                    const cleanLabel = taskText.replace(/\[failed\]/gi, '').trim();

                    tasks.push({
                        label: `${taskNumber}. ${cleanLabel}`,
                        description: `Line ${i + 1}`,
                        lineNumber: i,
                        taskContent: cleanLabel,
                        status,
                        specFolder,
                        filePath
                    });
                    continue;
                }
            }
        } catch (error) {
            console.error(`[TaskContextProvider] Failed to parse tasks from ${filePath}:`, error);
            // Don't throw - return empty array to allow other files to be processed
            vscode.window.showWarningMessage(
                `Failed to parse tasks from ${path.basename(filePath)}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }

        return tasks;
    }

    /**
     * Recursively scan workspace for all tasks.md files
     */
    private async performInitialScan(): Promise<void> {
        if (this.scanInProgress) {
            return;
        }

        this.scanInProgress = true;
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
            this.scanInProgress = false;
            return;
        }

        try {
            // Use VS Code's findFiles API which respects .gitignore
            const taskFiles = await vscode.workspace.findFiles(
                '**/tasks.md',
                '**/node_modules/**',
                10000 // max results
            );

            // Log and handle case where no tasks.md files are found
            if (taskFiles.length === 0) {
                console.log('[TaskContextProvider] No tasks.md files found in workspace');
                this.initialScanComplete = true;
                this.scanInProgress = false;
                this.refresh();
                return;
            }

            console.log(`[TaskContextProvider] Found ${taskFiles.length} tasks.md file(s), starting scan...`);

            // Show progress if more than 10 files
            if (taskFiles.length > 10) {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Scanning workspace for tasks...',
                    cancellable: false
                }, async (progress) => {
                    for (let i = 0; i < taskFiles.length; i++) {
                        await this.scanSingleFile(taskFiles[i].fsPath);
                        progress.report({
                            increment: (100 / taskFiles.length),
                            message: `${i + 1}/${taskFiles.length} files`
                        });
                    }
                });
            } else {
                // Scan without progress indicator
                await Promise.all(
                    taskFiles.map(file => this.scanSingleFile(file.fsPath))
                );
            }

            // Log successful scan completion
            const totalTasks = Object.values(this.taskCache).reduce(
                (sum, result) => sum + result.tasks.length,
                0
            );
            console.log(`[TaskContextProvider] Scan complete: ${totalTasks} task(s) from ${taskFiles.length} file(s)`);

            this.initialScanComplete = true;
            this.refresh();
        } catch (error) {
            console.error('[TaskContextProvider] Failed to scan workspace for tasks:', error);
            vscode.window.showErrorMessage(
                `Failed to scan workspace for tasks: ${error instanceof Error ? error.message : String(error)}`
            );
        } finally {
            this.scanInProgress = false;
        }
    }

    /**
     * Initialize file system watcher for tasks.md files
     */
    private initializeFileWatcher(): void {
        // Watch pattern: **/tasks.md and .kiro/specs/**/tasks.md
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            '**/{tasks.md,.kiro/specs/**/tasks.md}'
        );

        this.fileWatcher.onDidCreate((uri) => this.handleFileChange(uri, 'create'));
        this.fileWatcher.onDidChange((uri) => this.handleFileChange(uri, 'change'));
        this.fileWatcher.onDidDelete((uri) => this.handleFileChange(uri, 'delete'));
    }

    /**
     * Handle file system changes with debouncing
     */
    private async handleFileChange(
        uri: vscode.Uri,
        changeType: 'create' | 'change' | 'delete'
    ): Promise<void> {
        const now = Date.now();

        // Debounce rapid changes
        if (now - this.lastScanTimestamp < this.DEBOUNCE_DELAY) {
            return;
        }

        this.lastScanTimestamp = now;

        const fileName = path.basename(uri.fsPath);
        console.log(`[TaskContextProvider] File ${changeType}: ${fileName}`);

        if (changeType === 'delete') {
            // Remove from cache
            delete this.taskCache[uri.fsPath];
            console.log(`[TaskContextProvider] Removed ${fileName} from cache`);
        } else {
            // Handle creation or modification by rescanning the file
            await this.scanSingleFile(uri.fsPath);
        }

        // Trigger tree view refresh
        this.refresh();
    }

    /**
     * Scan a single tasks.md file and update cache
     */
    private async scanSingleFile(filePath: string): Promise<void> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                console.warn('[TaskContextProvider] No workspace folder found for scanning');
                return;
            }

            const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);

            // Check if file exists before trying to stat it
            try {
                await fs.access(filePath);
            } catch (accessError) {
                console.warn(`[TaskContextProvider] File not accessible: ${relativePath}`);
                // Remove from cache if it was previously there
                delete this.taskCache[filePath];
                return;
            }

            const stat = await fs.stat(filePath);

            // Determine if this is part of a spec folder
            const specFolderMatch = relativePath.match(/\.kiro[\\/]specs[\\/]([^\\/]+)/);
            const specFolder = specFolderMatch ? specFolderMatch[1] : undefined;

            // Parse tasks from file
            const tasks = await this.parseTasksFromFile(filePath, specFolder);

            // Update cache
            this.taskCache[filePath] = {
                filePath,
                relativePath,
                tasks,
                lastModified: stat.mtimeMs,
                specFolder
            };

            console.log(`[TaskContextProvider] Scanned ${relativePath}: ${tasks.length} task(s)${specFolder ? ` in spec '${specFolder}'` : ''}`);

        } catch (error) {
            const errorCode = (error as NodeJS.ErrnoException).code;
            const fileName = path.basename(filePath);

            console.error(`[TaskContextProvider] Failed to scan file ${filePath}:`, error);

            // Check for specific error types
            if (errorCode === 'EACCES') {
                vscode.window.showWarningMessage(
                    `Permission denied reading ${fileName}. Check file permissions.`
                );
            } else if (errorCode === 'ENOENT') {
                console.warn(`[TaskContextProvider] File not found: ${filePath}`);
                // Remove from cache if it was deleted
                delete this.taskCache[filePath];
            } else {
                // Generic error - log but don't show to user to avoid spam
                console.error(`[TaskContextProvider] Error scanning ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    /**
     * Get active task context from currently open editor
     * Returns undefined if no tasks.md file is active or if file not in cache
     */
    public getActiveTaskContext(): TaskContext | undefined {
        const editor = vscode.window.activeTextEditor;

        // Check if active editor exists and is a tasks.md file
        if (!editor || !editor.document.fileName.endsWith('tasks.md')) {
            return undefined;
        }

        const filePath = editor.document.fileName;
        const scanResult = this.taskCache[filePath];

        if (!scanResult) {
            return undefined;
        }

        // Get task at cursor position
        const cursorLine = editor.selection.active.line;
        const taskAtCursor = scanResult.tasks.find(
            task => task.lineNumber === cursorLine
        );

        // Get selected text if any
        const selectedText = editor.document.getText(editor.selection);

        return {
            filePath,
            relativePath: scanResult.relativePath,
            specFolder: scanResult.specFolder,
            allTasks: scanResult.tasks,
            activeTask: taskAtCursor,
            selectedText: selectedText || undefined
        };
    }

    /**
     * Get all available task context from workspace
     * Returns all tasks from all specs and root-level tasks.md files
     * This method doesn't require a tasks.md file to be open in the editor
     */
    public getAllTaskContext(): TaskContext[] {
        const contexts: TaskContext[] = [];

        for (const scanResult of Object.values(this.taskCache)) {
            contexts.push({
                filePath: scanResult.filePath,
                relativePath: scanResult.relativePath,
                specFolder: scanResult.specFolder,
                allTasks: scanResult.tasks,
                activeTask: undefined,
                selectedText: undefined
            });
        }

        return contexts;
    }

    /**
     * Get task context from all .kiro/specs folders
     * Returns only tasks that are part of spec folders, excluding root-level tasks
     */
    public getSpecTasksContext(): TaskContext[] {
        const contexts: TaskContext[] = [];

        for (const scanResult of Object.values(this.taskCache)) {
            // Only include tasks that are part of a spec folder
            if (scanResult.specFolder) {
                contexts.push({
                    filePath: scanResult.filePath,
                    relativePath: scanResult.relativePath,
                    specFolder: scanResult.specFolder,
                    allTasks: scanResult.tasks,
                    activeTask: undefined,
                    selectedText: undefined
                });
            }
        }

        return contexts;
    }

    /**
     * Get all tasks organized by spec folder
     * Returns a Map where keys are spec folder names (or undefined for root-level tasks)
     * and values are arrays of TaskScanResult objects
     */
    public getAllTasksBySpec(): Map<string | undefined, TaskScanResult[]> {
        const organized = new Map<string | undefined, TaskScanResult[]>();

        for (const scanResult of Object.values(this.taskCache)) {
            const key = scanResult.specFolder || undefined;

            if (!organized.has(key)) {
                organized.set(key, []);
            }

            organized.get(key)!.push(scanResult);
        }

        return organized;
    }
}

class TaskTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.contextValue = contextValue;
    }
}

class SpecFolderTreeItem extends TaskTreeItem {
    constructor(
        label: string,
        tooltip: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        contextValue: string,
        public readonly specInfo: SpecFolderInfo,
        command?: vscode.Command,
        iconPath?: vscode.ThemeIcon
    ) {
        super(label, tooltip, collapsibleState, contextValue, command, iconPath);
    }
}

class TaskGroupTreeItem extends TaskTreeItem {
    constructor(
        label: string,
        tooltip: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        contextValue: string,
        public readonly taskGroup: TaskGroup,
        command?: vscode.Command,
        iconPath?: vscode.ThemeIcon
    ) {
        super(label, tooltip, collapsibleState, contextValue, command, iconPath);
    }
}
