import * as vscode from 'vscode';
import { ModeManager, CodingMode } from '../services/modeManager';

export class ModeSelectorProvider implements vscode.TreeDataProvider<ModeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ModeItem | undefined | null | void> = new vscode.EventEmitter<ModeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ModeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private modeManager: ModeManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ModeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ModeItem): Thenable<ModeItem[]> {
        if (!element) {
            // Root level - show current mode, setup button, and available modes
            const currentMode = this.modeManager.getCurrentMode();

            return Promise.resolve([
                new ModeItem(
                    'Setup Project',
                    'Copy MCP server and prompt files to workspace',
                    vscode.TreeItemCollapsibleState.None,
                    'setup',
                    currentMode,
                    {
                        command: 'kiro-copilot.setupProject',
                        title: 'Setup Project'
                    },
                    new vscode.ThemeIcon('tools')
                ),
                new ModeItem(
                    `Current: ${currentMode === 'vibe' ? 'Vibe Coding' : 'Spec'}`,
                    '',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'current',
                    currentMode
                ),
                new ModeItem(
                    'Switch Mode',
                    'Click to change coding mode',
                    vscode.TreeItemCollapsibleState.None,
                    'switch',
                    currentMode,
                    {
                        command: 'kiro-copilot.openModeSelector',
                        title: 'Switch Mode'
                    }
                )
            ]);
        } else if (element.contextValue === 'current') {
            // Show details about current mode
            const mode = this.modeManager.getCurrentMode();
            const benefits = this.modeManager.getModeBenefits(mode);

            return Promise.resolve([
                new ModeItem(
                    this.modeManager.getModeDescription(mode),
                    '',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'description',
                    mode
                ),
                ...benefits.map((benefit, index) =>
                    new ModeItem(
                        benefit,
                        '',
                        vscode.TreeItemCollapsibleState.None,
                        `benefit-${index}`,
                        mode,
                        undefined,
                        new vscode.ThemeIcon('check')
                    )
                )
            ]);
        }

        return Promise.resolve([]);
    }
}

class ModeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        public readonly mode: CodingMode,
        public readonly command?: vscode.Command,
        public readonly iconPath?: vscode.ThemeIcon
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.contextValue = contextValue;

        if (!iconPath && contextValue === 'current') {
            this.iconPath = new vscode.ThemeIcon(
                mode === 'vibe' ? 'rocket' : 'notebook'
            );
        } else if (!iconPath && contextValue === 'switch') {
            this.iconPath = new vscode.ThemeIcon('arrow-swap');
        }
    }
}
