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

interface SpecFolderInfo {
    name: string;
    path: string;
    tasks: TaskItem[];
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
}

export class TaskContextProvider implements vscode.TreeDataProvider<TaskTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private promptManager: PromptManager,
        private modeManager: ModeManager
    ) {
        // Watch for file changes in workspace
        const watcher = vscode.workspace.createFileSystemWatcher('**/{tasks.md,.kiro/specs/**/tasks.md}');
        watcher.onDidChange(() => this.refresh());
        watcher.onDidCreate(() => this.refresh());
        watcher.onDidDelete(() => this.refresh());
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
            return [];
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        if (!element) {
            // Root level - show mode indicator and spec folders
            const mode = this.modeManager.getCurrentMode();
            const specFolders = await this.scanSpecFolders(workspaceRoot);
            const rootTasks = await this.getRootTasks(workspaceRoot);

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

            // Add spec folder categories
            if (specFolders.length > 0) {
                items.push(
                    new TaskTreeItem(
                        'Spec Folders',
                        `${specFolders.length} feature spec(s)`,
                        vscode.TreeItemCollapsibleState.Expanded,
                        'spec-folders-header',
                        undefined,
                        new vscode.ThemeIcon('folder-library')
                    )
                );
            }

            // Add root-level tasks (backward compatibility)
            if (rootTasks.length > 0) {
                const completedCount = rootTasks.filter(t => t.status === 'completed').length;
                items.push(
                    new TaskTreeItem(
                        'Root Tasks',
                        `${completedCount}/${rootTasks.length} completed`,
                        vscode.TreeItemCollapsibleState.Expanded,
                        'root-tasks-header',
                        undefined,
                        new vscode.ThemeIcon('list-unordered')
                    )
                );
            }

            return items;
        } else if (element.contextValue === 'spec-folders-header') {
            // Show list of spec folders
            const specFolders = await this.scanSpecFolders(workspaceRoot);
            return specFolders.map(spec => this.createSpecFolderItem(spec));
        } else if (element.contextValue === 'spec-folder') {
            // Show tasks within a spec folder
            const specFolder = element as SpecFolderTreeItem;
            return specFolder.specInfo.tasks.map(task => this.createTaskItem(task));
        } else if (element.contextValue === 'root-tasks-header') {
            // Show root-level tasks
            const rootTasks = await this.getRootTasks(workspaceRoot);
            return rootTasks.map(task => this.createTaskItem(task));
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
     * Scan .kiro/specs/ directory for spec folders with tasks.md files
     */
    private async scanSpecFolders(workspaceRoot: string): Promise<SpecFolderInfo[]> {
        const specsPath = path.join(workspaceRoot, '.kiro', 'specs');
        const specFolders: SpecFolderInfo[] = [];

        try {
            const entries = await fs.readdir(specsPath, { withFileTypes: true });

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
                    } catch {
                        // No tasks.md in this spec folder, skip it
                    }
                }
            }
        } catch {
            // .kiro/specs doesn't exist, return empty array
        }

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
            console.error(`Failed to parse tasks from ${filePath}:`, error);
        }

        return tasks;
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
