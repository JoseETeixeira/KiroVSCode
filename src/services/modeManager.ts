import * as vscode from 'vscode';

export type CodingMode = 'vibe' | 'spec';

export class ModeManager {
    private static readonly CONFIG_KEY = 'kiroCopilot.mode';

    constructor(private context: vscode.ExtensionContext) {}

    getCurrentMode(): CodingMode {
        const config = vscode.workspace.getConfiguration();
        return config.get<CodingMode>(ModeManager.CONFIG_KEY, 'vibe');
    }

    async setMode(mode: CodingMode): Promise<void> {
        const config = vscode.workspace.getConfiguration();
        await config.update(ModeManager.CONFIG_KEY, mode, vscode.ConfigurationTarget.Global);
    }

    getModeDescription(mode: CodingMode): string {
        return mode === 'vibe'
            ? 'Chat first, then build. Explore ideas and iterate as you discover needs.'
            : 'Plan first, then build. Create requirements and design before coding starts.';
    }

    getModeIcon(mode: CodingMode): string {
        return mode === 'vibe' ? '$(rocket)' : '$(notebook)';
    }

    getModeBenefits(mode: CodingMode): string[] {
        return mode === 'vibe'
            ? [
                'Rapid exploration and testing',
                'Building when requirements are unclear',
                'Implementing a task'
            ]
            : [
                'Structured feature development',
                'Requirements-driven development',
                'Complex features requiring formal specs'
            ];
    }
}
