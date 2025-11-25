import * as vscode from 'vscode';
import * as path from 'path';
import { PromptManager } from '../services/promptManager';
import { ModeManager } from '../services/modeManager';
import { IntentService, IntentStatusEvent } from '../services/intentService';
import { AutonomyPolicyService, AutonomyPolicy } from '../services/autonomyPolicyService';
import { IPlatformAdapter } from '../adapters';

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
    specFolderName?: string;
    autonomyInfo?: AutonomyBadgeInfo;
}

interface AutonomyBadgeInfo {
    state: 'ready' | 'consent-required' | 'setup-required' | 'running' | 'failed' | 'cancelled';
    label: string;
    tooltip: string;
}

export class TaskContextProvider implements vscode.TreeDataProvider<TaskTreeItem>, vscode.Disposable {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private taskCache: WorkspaceTaskMap = {};
    private scanInProgress: boolean = false;
    private initialScanComplete: boolean = false;
    private lastScanTimestamp: number = 0;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private specFolderWatcher: vscode.FileSystemWatcher | undefined;
    private disposables: vscode.Disposable[] = [];
    private intentStatusBySpec: Map<string, IntentStatusEvent> = new Map();
    private latestPolicy?: AutonomyPolicy;
    private readonly DEBOUNCE_DELAY = 1000; // 1 second

    constructor(
        private adapter: IPlatformAdapter,
        private promptManager: PromptManager,
        private modeManager: ModeManager,
        private intentService: IntentService,
        private autonomyPolicyService: AutonomyPolicyService
    ) {
        // Initialize file system watcher
        this.initializeFileWatcher();

        // Perform initial scan
        this.performInitialScan();
        this.registerDisposable(this.intentService.onDidChangeStatus(event => this.handleIntentStatusEvent(event)));
        this.registerDisposable(this.autonomyPolicyService.onDidUpdatePolicy(() => {
            void this.hydrateAutonomyContext();
        }));
        void this.hydrateAutonomyContext();
    }

    private handleIntentStatusEvent(event: IntentStatusEvent): void {
        const specSlug = event.payload?.specSlug ?? event.specSlug;
        if (!specSlug) {
            return;
        }

        this.intentStatusBySpec.set(specSlug, event);
        this.refresh();

        if (event.stage === 'dispatched' || event.stage === 'failed' || event.stage === 'cancelled' || event.stage === 'completed') {
            setTimeout(() => {
                const current = this.intentStatusBySpec.get(specSlug);
                if (current && current.timestamp === event.timestamp) {
                    this.intentStatusBySpec.delete(specSlug);
                    this.refresh();
                }
            }, 4000);
        }
    }

    private async hydrateAutonomyContext(): Promise<void> {
        const workspaceFolders = this.adapter.getWorkspaceFolders();
        const workspaceFolder = workspaceFolders?.[0];
        if (!workspaceFolder) {
            this.latestPolicy = undefined;
            this.refresh();
            return;
        }

        // Cast to vscode.WorkspaceFolder for AutonomyPolicyService compatibility
        const result = await this.autonomyPolicyService.getPolicy(workspaceFolder as vscode.WorkspaceFolder);
        if (result.policy) {
            this.latestPolicy = result.policy;
        } else {
            this.latestPolicy = undefined;
        }
        this.refresh();
    }

    private registerDisposable(disposable?: vscode.Disposable): void {
        if (disposable) {
            this.disposables.push(disposable);
        }
    }

    dispose(): void {
        this.fileWatcher?.dispose();
        this.specFolderWatcher?.dispose();
        for (const disposable of this.disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                console.error('[TaskContextProvider] Failed to dispose resource:', error);
            }
        }
        this.disposables = [];
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TaskTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
        const workspaceFolders = this.adapter.getWorkspaceFolders();
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
        } else if (element instanceof TaskGroupTreeItem) {
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
                isSpec,
                specFolderName: scanResult.specFolder,
                autonomyInfo: isSpec ? this.getAutonomyBadge(scanResult.specFolder) : undefined
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

    private getAutonomyBadge(specFolder?: string): AutonomyBadgeInfo | undefined {
        if (!specFolder) {
            return undefined;
        }

        const statusEvent = this.intentStatusBySpec.get(specFolder);
        if (statusEvent) {
            return this.formatIntentStage(statusEvent);
        }

        if (!this.latestPolicy) {
            return {
                state: 'setup-required',
                label: 'Autonomy setup required',
                tooltip: 'Run Kiro: Setup Project to sync prompts and manifest files.'
            };
        }

        const workspaceFolders = this.adapter.getWorkspaceFolders();
        const workspaceFolder = workspaceFolders?.[0];
        if (!workspaceFolder) {
            return {
                state: 'setup-required',
                label: 'No workspace detected',
                tooltip: 'Open a workspace folder to enable autonomy.'
            };
        }

        const action = this.latestPolicy?.actions.find(a => a.id === 'executeTask.next');
        if (action && !action.requiresConsent) {
            return {
                state: 'ready',
                label: 'Autonomy ready',
                tooltip: 'Policy allows executeTask.next without additional consent.'
            };
        }

        // Cast to vscode.WorkspaceFolder for AutonomyPolicyService compatibility
        const consent = this.autonomyPolicyService.getConsentState(workspaceFolder as vscode.WorkspaceFolder, 'executeTask.next');
        if (consent) {
            const expiry = new Date(consent.expiresAt).toLocaleTimeString();
            return {
                state: 'ready',
                label: 'Autonomy ready',
                tooltip: `Consent active until ${expiry}.`
            };
        }

        return {
            state: 'consent-required',
            label: 'Consent required',
            tooltip: 'Run Kiro: Enable Autonomy to grant consent.'
        };
    }

    private formatIntentStage(event: IntentStatusEvent): AutonomyBadgeInfo {
        switch (event.stage) {
            case 'failed':
                return {
                    state: 'failed',
                    label: 'Autonomy failed',
                    tooltip: event.message
                };
            case 'cancelled':
                return {
                    state: 'cancelled',
                    label: 'Autonomy cancelled',
                    tooltip: event.message
                };
            case 'running':
                return {
                    state: 'running',
                    label: 'Autonomy running',
                    tooltip: event.message
                };
            case 'completed':
                return {
                    state: 'ready',
                    label: 'Autonomy completed',
                    tooltip: event.message
                };
            case 'dispatched':
                return {
                    state: 'ready',
                    label: 'Intent dispatched',
                    tooltip: event.message
                };
            case 'consentRequested':
                return {
                    state: 'running',
                    label: 'Consent requested',
                    tooltip: event.message
                };
            case 'consentGranted':
                return {
                    state: 'running',
                    label: 'Consent granted',
                    tooltip: event.message
                };
            case 'dispatching':
                return {
                    state: 'running',
                    label: 'Dispatching intent',
                    tooltip: event.message
                };
            case 'queued':
                return {
                    state: 'running',
                    label: 'Autonomy queued',
                    tooltip: event.message
                };
            default:
                return {
                    state: 'running',
                    label: 'Autonomy update',
                    tooltip: event.message
                };
        }
    }

    /**
     * Create a tree item for a task group
     */
    private createTaskGroupItem(group: TaskGroup): TaskGroupTreeItem {
        const statusText = this.getTaskGroupStatus(group);
        const contextValue = group.isSpec ? this.getSpecContextValue(group) : 'task-group';
        const tooltipParts = [`${statusText} • ${group.tasks.length} task(s)`];
        let icon = this.getTaskGroupIcon(group);
        let description: string | undefined;

        if (group.autonomyInfo) {
            description = group.autonomyInfo.label;
            tooltipParts.push(`Autonomy: ${group.autonomyInfo.tooltip}`);
            if (group.autonomyInfo.state === 'running') {
                icon = new vscode.ThemeIcon('sync~spin');
            } else if (group.autonomyInfo.state === 'failed') {
                icon = new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconFailed'));
            }
        }

        return new TaskGroupTreeItem(
            group.label,
            tooltipParts.join('\n'),
            vscode.TreeItemCollapsibleState.Collapsed,
            contextValue,
            group,
            undefined,
            icon,
            description
        );
    }

    private getSpecContextValue(group: TaskGroup): string {
        const autonomyState = group.autonomyInfo?.state ?? 'unknown';
        return `spec-task-group:${autonomyState}`;
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
            const specsUri = this.adapter.createFileUri(specsPath);
            const entries = await this.adapter.readDirectory(specsUri);
            console.log(`[TaskContextProvider] Found ${entries.length} entries in .kiro/specs`);

            for (const [name, fileType] of entries) {
                // Check if it's a directory (FileType.Directory = 2)
                if (fileType === 2) {
                    const specPath = path.join(specsPath, name);
                    const tasksPath = path.join(specPath, 'tasks.md');

                    try {
                        await this.adapter.stat(this.adapter.createFileUri(tasksPath));
                        const tasks = await this.parseTasksFromFile(tasksPath, name);

                        const completedCount = tasks.filter(t => t.status === 'completed').length;
                        const failedCount = tasks.filter(t => t.status === 'failed').length;

                        specFolders.push({
                            name: name,
                            path: specPath,
                            tasks,
                            totalTasks: tasks.length,
                            completedTasks: completedCount,
                            failedTasks: failedCount
                        });

                        console.log(`[TaskContextProvider] Spec folder '${name}': ${tasks.length} tasks (${completedCount} completed, ${failedCount} failed)`);
                    } catch {
                        // No tasks.md in this spec folder, skip it
                        console.log(`[TaskContextProvider] Spec folder '${name}' has no tasks.md, skipping`);
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
            await this.adapter.stat(this.adapter.createFileUri(rootTasksPath));
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
            const fileUri = this.adapter.createFileUri(filePath);
            const contentBytes = await this.adapter.readFile(fileUri);
            const content = new TextDecoder().decode(contentBytes);
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Match markdown checkboxes with status detection
                // - [ ] task (pending)
                // - [x] task (completed)
                // - [x] task [failed] or - [ ] task [FAILED] (failed)
                const checkboxMatch = line.match(/^\s*(?:[-*+>]\s*)?\[([x ])\]\s*(.+)/i);
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
                const numberedMatch = line.match(/^\s*(?:[-*+>]\s*)?(?:\[([x ])\]\s*)?(\d+)[.)]\s*(.+)/i);
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
            await this.adapter.showWarningMessage(
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
        const workspaceFolders = this.adapter.getWorkspaceFolders();

        if (!workspaceFolders) {
            this.scanInProgress = false;
            return;
        }

        try {
            // Use adapter's findFiles API which respects .gitignore
            const taskFiles = await this.adapter.findFiles(
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
                await this.adapter.withProgress({
                    location: 'notification',
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
            await this.adapter.showErrorMessage(
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
        // Dispose any existing watchers before creating new ones
        this.fileWatcher?.dispose();
        this.specFolderWatcher?.dispose();

        // Watch all tasks.md files across the workspace
        const fileWatcher = this.adapter.createFileSystemWatcher('**/tasks.md');
        this.fileWatcher = fileWatcher as unknown as vscode.FileSystemWatcher;
        this.registerDisposable(this.fileWatcher);
        this.registerDisposable(fileWatcher.onDidCreate((uri) => this.handleFileChange(uri as vscode.Uri, 'create')));
        this.registerDisposable(fileWatcher.onDidChange((uri) => this.handleFileChange(uri as vscode.Uri, 'change')));
        this.registerDisposable(fileWatcher.onDidDelete((uri) => this.handleFileChange(uri as vscode.Uri, 'delete')));

        // Watch for spec folder creation/deletion to keep spec list in sync
        const workspaceFolders = this.adapter.getWorkspaceFolders();
        const workspaceFolder = workspaceFolders?.[0];
        if (workspaceFolder) {
            const specWatcher = this.adapter.createRelativePatternWatcher(workspaceFolder, '.kiro/specs/*', false, true, false);
            this.specFolderWatcher = specWatcher as unknown as vscode.FileSystemWatcher;
            this.registerDisposable(this.specFolderWatcher);
            this.registerDisposable(specWatcher.onDidCreate((uri) => this.handleSpecFolderChange(uri as vscode.Uri, 'create')));
            this.registerDisposable(specWatcher.onDidDelete((uri) => this.handleSpecFolderChange(uri as vscode.Uri, 'delete')));
        }

        // Listen for file create/delete events (covers actions triggered via the explorer)
        this.registerDisposable(
            this.adapter.onDidCreateFiles(files => this.handleWorkspaceFilesEvent(files as readonly vscode.Uri[], 'create'))
        );
        this.registerDisposable(
            this.adapter.onDidDeleteFiles(files => this.handleWorkspaceFilesEvent(files as readonly vscode.Uri[], 'delete'))
        );
    }

    private async handleWorkspaceFilesEvent(
        files: readonly vscode.Uri[],
        changeType: 'create' | 'delete'
    ): Promise<void> {
        const affectedSpecs = new Set<string>();

        for (const uri of files) {
            const specName = this.extractSpecFolderName(uri.fsPath);
            if (specName) {
                affectedSpecs.add(specName);
            }
        }

        if (affectedSpecs.size === 0) {
            return;
        }

        for (const specName of affectedSpecs) {
            await this.synchronizeSpecFolder(specName, changeType);
        }
    }

    private async handleSpecFolderChange(
        uri: vscode.Uri,
        changeType: 'create' | 'delete'
    ): Promise<void> {
        const specName = this.extractSpecFolderName(uri.fsPath);
        if (!specName) {
            return;
        }

        await this.synchronizeSpecFolder(specName, changeType);
    }

    private async synchronizeSpecFolder(
        specName: string,
        changeType: 'create' | 'delete'
    ): Promise<void> {
        if (changeType === 'delete') {
            this.removeSpecFromCache(specName);
        } else {
            await this.scanSpecTasks(specName);
        }

        this.refresh();
    }

    private async scanSpecTasks(specName: string): Promise<void> {
        const workspaceFolders = this.adapter.getWorkspaceFolders();
        const workspaceFolder = workspaceFolders?.[0];
        if (!workspaceFolder) {
            return;
        }

        const tasksPath = path.join(workspaceFolder.uri.fsPath, '.kiro', 'specs', specName, 'tasks.md');

        try {
            await this.adapter.stat(this.adapter.createFileUri(tasksPath));
        } catch {
            // No tasks file yet for this spec - ensure cache is cleared to avoid stale entries
            this.removeSpecFromCache(specName);
            return;
        }

        await this.scanSingleFile(tasksPath);
    }

    private removeSpecFromCache(specName: string): void {
        let removed = false;

        for (const [filePath, result] of Object.entries(this.taskCache)) {
            if (result.specFolder === specName) {
                delete this.taskCache[filePath];
                removed = true;
            }
        }

        if (removed) {
            console.log(`[TaskContextProvider] Removed spec '${specName}' from cache`);
        }
    }

    private extractSpecFolderName(filePath: string): string | undefined {
        const normalized = path.normalize(filePath);
        const match = normalized.match(/\.kiro[\\/]specs[\\/]([^\\/]+)/);
        return match ? match[1] : undefined;
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
            const workspaceFolders = this.adapter.getWorkspaceFolders();
            const workspaceFolder = workspaceFolders?.[0];
            if (!workspaceFolder) {
                console.warn('[TaskContextProvider] No workspace folder found for scanning');
                return;
            }

            const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
            const fileUri = this.adapter.createFileUri(filePath);

            // Check if file exists before trying to stat it
            let fileStat;
            try {
                fileStat = await this.adapter.stat(fileUri);
            } catch (accessError) {
                console.warn(`[TaskContextProvider] File not accessible: ${relativePath}`);
                // Remove from cache if it was previously there
                delete this.taskCache[filePath];
                return;
            }

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
                lastModified: fileStat.mtime,
                specFolder
            };

            console.log(`[TaskContextProvider] Scanned ${relativePath}: ${tasks.length} task(s)${specFolder ? ` in spec '${specFolder}'` : ''}`);

        } catch (error) {
            const errorCode = (error as NodeJS.ErrnoException).code;
            const fileName = path.basename(filePath);

            console.error(`[TaskContextProvider] Failed to scan file ${filePath}:`, error);

            // Check for specific error types
            if (errorCode === 'EACCES') {
                await this.adapter.showWarningMessage(
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
        const editor = this.adapter.getActiveTextEditor();

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

    public async handleExecuteNextAutonomyCommand(treeItem?: TaskTreeItem): Promise<void> {
        const specName = this.getSpecNameFromTreeItem(treeItem);
        if (!specName) {
            await this.adapter.showWarningMessage('Select a spec in the Task Context view to execute autonomously.');
            return;
        }

        const pendingTask = this.findNextPendingTask(specName);
        if (!pendingTask) {
            await this.adapter.showInformationMessage(`Spec '${specName}' has no pending tasks to execute.`);
            return;
        }

        await this.intentService.dispatchIntent({
            actionId: 'executeTask.next',
            activationSource: 'taskTree',
            specSlug: specName,
            userMessage: `Execute the next unchecked task (${pendingTask.label}) for spec '${specName}'.`,
            taskLabel: pendingTask.label,
            metadata: {
                source: 'taskContext',
                filePath: pendingTask.filePath,
                lineNumber: pendingTask.lineNumber
            },
            instructionsVersion: this.latestPolicy?.version
        });
    }

    public async handleRetryAutonomyCommand(treeItem?: TaskTreeItem): Promise<void> {
        const specName = this.getSpecNameFromTreeItem(treeItem);
        if (!specName) {
            await this.adapter.showWarningMessage('Select a spec in the Task Context view to retry a task.');
            return;
        }

        const retryTask = this.findRetryCandidateTask(specName);
        if (!retryTask) {
            await this.adapter.showInformationMessage(`Spec '${specName}' has no failed tasks to retry.`);
            return;
        }

        const tasks = this.getTasksForSpec(specName);
        const taskIndex = Math.max(1, tasks.indexOf(retryTask) + 1);

        await this.intentService.dispatchIntent({
            actionId: 'executeTask.retry',
            activationSource: 'taskTree',
            specSlug: specName,
            taskId: taskIndex,
            taskLabel: retryTask.label,
            userMessage: `Retry task ${retryTask.label} for spec '${specName}'.`,
            metadata: {
                source: 'taskContext',
                filePath: retryTask.filePath,
                lineNumber: retryTask.lineNumber
            },
            instructionsVersion: this.latestPolicy?.version
        });
    }

    private getSpecNameFromTreeItem(treeItem?: TaskTreeItem): string | undefined {
        if (!treeItem || !(treeItem instanceof TaskGroupTreeItem)) {
            return undefined;
        }

        if (!treeItem.taskGroup.isSpec) {
            return undefined;
        }

        return treeItem.taskGroup.specFolderName ?? treeItem.taskGroup.tasks[0]?.specFolder;
    }

    private findNextPendingTask(specName: string): TaskItem | undefined {
        const tasks = this.getTasksForSpec(specName);
        return tasks.find(task => task.status === 'pending') ?? tasks.find(task => task.status === 'failed');
    }

    private findRetryCandidateTask(specName: string): TaskItem | undefined {
        const tasks = this.getTasksForSpec(specName);
        for (let i = tasks.length - 1; i >= 0; i--) {
            if (tasks[i].status === 'failed') {
                return tasks[i];
            }
        }
        return undefined;
    }

    private getTasksForSpec(specName: string): TaskItem[] {
        for (const scanResult of Object.values(this.taskCache)) {
            if (scanResult.specFolder === specName) {
                return scanResult.tasks;
            }
        }
        return [];
    }

    public async handleDeleteSpecCommand(treeItem?: TaskTreeItem): Promise<void> {
        if (!treeItem || !(treeItem instanceof TaskGroupTreeItem) || !treeItem.taskGroup.isSpec) {
            await this.adapter.showWarningMessage('Select a spec in the Task Context view to delete it.');
            return;
        }

        const specName = treeItem.taskGroup.specFolderName ?? treeItem.taskGroup.tasks[0]?.specFolder;
        if (!specName) {
            await this.adapter.showErrorMessage('Unable to determine spec folder for the selected item.');
            return;
        }

        const confirmation = await this.adapter.showWarningMessage(
            `Delete spec '${specName}'? This will remove the folder .kiro/specs/${specName}.`,
            { modal: true },
            'Delete'
        );

        if (confirmation !== 'Delete') {
            return;
        }

        const success = await this.deleteSpecByName(specName);
        if (success) {
            await this.adapter.showInformationMessage(`Spec '${specName}' deleted.`);
        }
    }

    private async deleteSpecByName(specName: string): Promise<boolean> {
        const workspaceFolders = this.adapter.getWorkspaceFolders();
        const workspaceFolder = workspaceFolders?.[0];
        if (!workspaceFolder) {
            await this.adapter.showErrorMessage('No workspace folder found for deleting the spec.');
            return false;
        }

        const specPath = path.join(workspaceFolder.uri.fsPath, '.kiro', 'specs', specName);

        try {
            await this.adapter.delete(this.adapter.createFileUri(specPath), { recursive: true });
            this.removeSpecFromCache(specName);
            this.refresh();
            console.log(`[TaskContextProvider] Deleted spec '${specName}' at ${specPath}`);
            return true;
        } catch (error) {
            console.error(`[TaskContextProvider] Failed to delete spec '${specName}':`, error);
            await this.adapter.showErrorMessage(
                `Failed to delete spec '${specName}': ${error instanceof Error ? error.message : String(error)}`
            );
            return false;
        }
    }
}

class TaskTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon,
        public readonly descriptionText?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.contextValue = contextValue;
        if (descriptionText) {
            this.description = descriptionText;
        }
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
        iconPath?: vscode.ThemeIcon,
        descriptionText?: string
    ) {
        super(label, tooltip, collapsibleState, contextValue, command, iconPath, descriptionText);
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
        iconPath?: vscode.ThemeIcon,
        descriptionText?: string
    ) {
        super(label, tooltip, collapsibleState, contextValue, command, iconPath, descriptionText);
    }
}
