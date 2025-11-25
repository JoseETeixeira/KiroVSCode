import { IPlatformAdapter, ConfigurationTarget } from '../adapters';

export type CodingMode = 'vibe' | 'spec';

/**
 * Manages the current coding mode (vibe or spec) for the Kiro extension.
 * 
 * This service uses the platform adapter for configuration access, enabling
 * the extension to work across different IDE platforms (VS Code, Antigravity).
 * 
 * @example
 * ```typescript
 * const modeManager = new ModeManager(adapter);
 * const mode = modeManager.getCurrentMode(); // 'vibe' or 'spec'
 * await modeManager.setMode('spec');
 * ```
 */
export class ModeManager {
    private static readonly CONFIG_KEY = 'kiroCopilot.mode';

    /**
     * Creates a new ModeManager instance.
     * 
     * @param adapter The platform adapter for configuration access
     */
    constructor(private readonly adapter: IPlatformAdapter) {}

    /**
     * Gets the current coding mode from configuration.
     * 
     * @returns The current coding mode ('vibe' or 'spec'), defaults to 'vibe'
     */
    getCurrentMode(): CodingMode {
        const config = this.adapter.getConfiguration();
        return config.get<CodingMode>(ModeManager.CONFIG_KEY, 'vibe') ?? 'vibe';
    }

    /**
     * Sets the coding mode in global configuration.
     * 
     * @param mode The mode to set ('vibe' or 'spec')
     */
    async setMode(mode: CodingMode): Promise<void> {
        const config = this.adapter.getConfiguration();
        await config.update(ModeManager.CONFIG_KEY, mode, ConfigurationTarget.Global);
    }

    /**
     * Gets a human-readable description for the specified mode.
     * 
     * @param mode The coding mode
     * @returns A description string explaining the mode
     */
    getModeDescription(mode: CodingMode): string {
        return mode === 'vibe'
            ? 'Chat first, then build. Explore ideas and iterate as you discover needs.'
            : 'Plan first, then build. Create requirements and design before coding starts.';
    }

    /**
     * Gets the icon identifier for the specified mode.
     * 
     * @param mode The coding mode
     * @returns The icon identifier string
     */
    getModeIcon(mode: CodingMode): string {
        return mode === 'vibe' ? '$(rocket)' : '$(notebook)';
    }

    /**
     * Gets a list of benefits/use cases for the specified mode.
     * 
     * @param mode The coding mode
     * @returns An array of benefit strings
     */
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
