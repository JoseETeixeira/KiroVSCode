import * as vscode from "vscode";
import { SpecManager } from "../services/specManager";
import { SteeringManager } from "../services/steeringManager";
import {
    KiroIcons,
    createThemedIcon,
    getDocumentIcon,
} from "../styles/kiroTheme";

/**
 * Tree data provider for the Spec Explorer view
 * Displays SPECS, AGENT STEERING, and AGENT HOOKS sections
 */
export class SpecExplorerTreeDataProvider
    implements vscode.TreeDataProvider<TreeItem>
{
    private _onDidChangeTreeData: vscode.EventEmitter<
        TreeItem | undefined | null | void
    > = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<
        TreeItem | undefined | null | void
    > = this._onDidChangeTreeData.event;

    private fileWatcher: vscode.FileSystemWatcher | undefined;

    constructor(
        private specManager: SpecManager,
        private steeringManager: SteeringManager
    ) {
        this.initializeFileWatcher();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TreeItem): Promise<TreeItem[]> {
        if (!element) {
            // Root level - show three main sections
            return [
                new SectionItem("SPECS", "specs", this.specManager),
                new SectionItem(
                    "AGENT STEERING",
                    "steering",
                    this.specManager,
                    this.steeringManager
                ),
                new SectionItem("AGENT HOOKS", "hooks", this.specManager),
            ];
        }

        // Delegate to the element's getChildren method
        if (element instanceof SectionItem) {
            return await element.getChildren();
        } else if (element instanceof SpecItem) {
            return await element.getChildren();
        }

        return [];
    }

    /**
     * Initialize file system watcher for .kiro directory changes
     */
    private initializeFileWatcher(): void {
        // Watch for changes in .kiro/specs and .kiro/steering
        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            "**/.kiro/{specs,steering}/**"
        );

        this.fileWatcher.onDidCreate(() => this.refresh());
        this.fileWatcher.onDidChange(() => this.refresh());
        this.fileWatcher.onDidDelete(() => this.refresh());
    }

    dispose(): void {
        this.fileWatcher?.dispose();
    }
}

/**
 * Base class for tree items
 */
abstract class TreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        contextValue: string,
        iconPath?: vscode.ThemeIcon,
        command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
        this.iconPath = iconPath;
        this.command = command;
    }
}

/**
 * Section item (SPECS, AGENT STEERING, AGENT HOOKS)
 */
class SectionItem extends TreeItem {
    constructor(
        label: string,
        private sectionType: "specs" | "steering" | "hooks",
        private specManager: SpecManager,
        private steeringManager?: SteeringManager
    ) {
        const iconMap = {
            specs: KiroIcons.specs,
            steering: KiroIcons.steering,
            hooks: KiroIcons.hooks,
        };

        super(
            label,
            vscode.TreeItemCollapsibleState.Expanded,
            `section-${sectionType}`,
            createThemedIcon(iconMap[sectionType], "charts.purple")
        );
    }

    async getChildren(): Promise<TreeItem[]> {
        switch (this.sectionType) {
            case "specs":
                return await this.getSpecsChildren();
            case "steering":
                return await this.getSteeringChildren();
            case "hooks":
                return await this.getHooksChildren();
            default:
                return [];
        }
    }

    private async getSpecsChildren(): Promise<TreeItem[]> {
        const specs = await this.specManager.listSpecs();

        if (specs.length === 0) {
            return [
                new PlaceholderItem(
                    "No specs found",
                    "Create a new spec to get started"
                ),
            ];
        }

        return specs.map(
            (specName) => new SpecItem(specName, this.specManager)
        );
    }

    private async getSteeringChildren(): Promise<TreeItem[]> {
        if (!this.steeringManager) {
            return [];
        }

        const steeringFiles = await this.steeringManager.listSteeringFiles();

        if (steeringFiles.length === 0) {
            return [
                new PlaceholderItem(
                    "No steering files found",
                    "Generate steering files to provide project context"
                ),
            ];
        }

        return steeringFiles.map(
            (filename) => new SteeringFileItem(filename, this.steeringManager!)
        );
    }

    private async getHooksChildren(): Promise<TreeItem[]> {
        // Placeholder for future hooks implementation
        return [
            new PlaceholderItem(
                "⚙️ Automate repetitive tasks with smart triggers",
                "Agent hooks coming soon"
            ),
        ];
    }
}

/**
 * Interface for items that can be passed to commands
 */
export interface SpecTreeItem {
    specName: string;
}

/**
 * Spec item (represents a spec folder)
 */
class SpecItem extends TreeItem implements SpecTreeItem {
    constructor(
        public readonly specName: string,
        private specManager: SpecManager
    ) {
        super(
            specName,
            vscode.TreeItemCollapsibleState.Collapsed,
            "spec",
            createThemedIcon("folder-opened", "charts.blue")
        );
        this.tooltip = `Spec: ${specName}`;
    }

    async getChildren(): Promise<TreeItem[]> {
        const specInfo = await this.specManager.getSpecInfo(this.specName);

        if (!specInfo) {
            return [];
        }

        const children: TreeItem[] = [];

        // Add requirements.md
        if (specInfo.hasRequirements) {
            children.push(
                new DocumentItem(
                    this.specName,
                    "requirements",
                    this.specManager,
                    true
                )
            );
        } else {
            children.push(
                new DocumentItem(
                    this.specName,
                    "requirements",
                    this.specManager,
                    false
                )
            );
        }

        // Add design.md
        if (specInfo.hasDesign) {
            children.push(
                new DocumentItem(
                    this.specName,
                    "design",
                    this.specManager,
                    true
                )
            );
        } else {
            children.push(
                new DocumentItem(
                    this.specName,
                    "design",
                    this.specManager,
                    false
                )
            );
        }

        // Add tasks.md
        if (specInfo.hasTasks) {
            children.push(
                new DocumentItem(this.specName, "tasks", this.specManager, true)
            );
        } else {
            children.push(
                new DocumentItem(
                    this.specName,
                    "tasks",
                    this.specManager,
                    false
                )
            );
        }

        return children;
    }
}

/**
 * Document item (requirements.md, design.md, tasks.md)
 */
class DocumentItem extends TreeItem {
    constructor(
        public readonly specName: string,
        public readonly stage: "requirements" | "design" | "tasks",
        private specManager: SpecManager,
        public readonly exists: boolean
    ) {
        const label = exists ? `${stage}.md` : `${stage}.md (not created)`;
        const icon = getDocumentIcon(stage, exists);

        const command = exists
            ? {
                  command: "kiro-copilot.openSpecDocument",
                  title: "Open Document",
                  arguments: [specName, stage],
              }
            : {
                  command: `kiro-copilot.create${
                      stage.charAt(0).toUpperCase() + stage.slice(1)
                  }`,
                  title: `Create ${stage}.md`,
                  arguments: [specName],
              };

        // Set context value based on existence
        const contextValue = exists
            ? `document-${stage}`
            : `document-${stage}-missing`;

        super(
            label,
            vscode.TreeItemCollapsibleState.None,
            contextValue,
            icon,
            command
        );

        this.tooltip = exists
            ? `Open ${stage}.md`
            : `Click to create ${stage}.md`;
    }
}

/**
 * Steering file item
 */
class SteeringFileItem extends TreeItem {
    constructor(
        private filename: string,
        private steeringManager: SteeringManager
    ) {
        super(
            filename,
            vscode.TreeItemCollapsibleState.None,
            "steering-file",
            createThemedIcon("file-code", "charts.green"),
            {
                command: "kiro-copilot.openSteeringFile",
                title: "Open Steering File",
                arguments: [filename],
            }
        );
        this.tooltip = `Open ${filename}`;
    }
}

/**
 * Placeholder item for empty sections
 */
class PlaceholderItem extends TreeItem {
    constructor(label: string, tooltip: string) {
        super(
            label,
            vscode.TreeItemCollapsibleState.None,
            "placeholder",
            createThemedIcon("info", "charts.yellow")
        );
        this.tooltip = tooltip;
    }
}
