import * as path from 'path';
import { CodingMode } from './modeManager';
import { 
    IPlatformAdapter, 
    Disposable,
    FileType 
} from '../adapters';

interface PromptCacheEntry {
    content: string;
    lastModified: number;
}

/**
 * Manages loading and caching of prompt files for different coding modes.
 * 
 * This service uses the platform adapter for configuration access and file operations,
 * enabling the extension to work across different IDE platforms (VS Code, Antigravity).
 * 
 * The PromptManager implements a three-tier priority system for finding prompts:
 * 1. Embedded prompts in extension directory
 * 2. User-configured path from settings
 * 3. Default user prompts folder
 * 
 * @example
 * ```typescript
 * const promptManager = new PromptManager(adapter);
 * const prompt = await promptManager.getPromptForMode('spec');
 * ```
 */
export class PromptManager {
    private promptCache: Map<string, PromptCacheEntry> = new Map();
    private validatedPromptsPath?: string;
    private configChangeDisposable?: Disposable;

    /**
     * Creates a new PromptManager instance.
     * 
     * @param adapter The platform adapter for configuration and file system access
     */
    constructor(private readonly adapter: IPlatformAdapter) {
        this.watchConfigurationChanges();
    }

    /**
     * Watch for configuration changes and invalidate cache.
     */
    private watchConfigurationChanges(): void {
        this.configChangeDisposable = this.adapter.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('kiroCopilot.promptsPath')) {
                console.log('[PromptManager] Configuration changed: kiroCopilot.promptsPath');

                // Invalidate validated path cache
                this.validatedPromptsPath = undefined;

                // Clear prompt cache to force reload
                this.clearCache();

                console.log('[PromptManager] Cache cleared due to configuration change');
            }
        });
    }

    /**
     * Dispose of resources held by this manager.
     */
    dispose(): void {
        if (this.configChangeDisposable) {
            this.configChangeDisposable.dispose();
        }
    }

    /**
     * Get and validate prompts path with three-tier priority system.
     * 
     * Priority order:
     * 1. Embedded prompts in extension directory
     * 2. User-configured path from settings
     * 3. Default user prompts folder
     * 
     * @returns The validated path to the prompts directory
     * @throws Error if no valid prompts directory is found
     */
    async getPromptsPath(): Promise<string> {
        // Return cached path if already validated
        if (this.validatedPromptsPath) {
            return this.validatedPromptsPath;
        }

        const checkedPaths: string[] = [];

        // Priority 1: Embedded prompts in extension directory
        const extensionContext = this.adapter.getExtensionContext();
        if (extensionContext && extensionContext.extensionPath) {
            const embeddedPath = path.join(extensionContext.extensionPath, 'prompts');
            checkedPaths.push(embeddedPath);

            if (await this.pathExists(embeddedPath)) {
                console.log(`[PromptManager] Using embedded prompts: ${embeddedPath}`);
                this.validatedPromptsPath = embeddedPath;
                return embeddedPath;
            }
        }

        // Priority 2: User-configured path
        const config = this.adapter.getConfiguration('kiroCopilot');
        let configuredPath = config.get<string>('promptsPath');

        if (configuredPath) {
            // Expand environment variables like %APPDATA%
            configuredPath = this.expandEnvVars(configuredPath);

            // Resolve relative paths against workspace root
            if (!path.isAbsolute(configuredPath)) {
                const workspaceFolders = this.adapter.getWorkspaceFolders();
                const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;
                if (workspaceRoot) {
                    configuredPath = path.join(workspaceRoot, configuredPath);
                }
            }

            checkedPaths.push(configuredPath);

            if (await this.pathExists(configuredPath)) {
                console.log(`[PromptManager] Using configured prompts: ${configuredPath}`);
                this.validatedPromptsPath = configuredPath;
                return configuredPath;
            }
        }

        // Priority 3: Default user prompts folder
        const defaultPath = path.join(
            process.env.APPDATA || process.env.HOME || '',
            'Code',
            'User',
            'prompts'
        );
        checkedPaths.push(defaultPath);

        if (await this.pathExists(defaultPath)) {
            console.log(`[PromptManager] Using default prompts: ${defaultPath}`);
            this.validatedPromptsPath = defaultPath;
            return defaultPath;
        }

        // No valid path found - throw descriptive error
        const errorMessage = `Prompts directory not found. Checked the following locations:\n${checkedPaths.map(p => `  - ${p}`).join('\n')}\n\nPlease configure 'kiroCopilot.promptsPath' in settings or create the prompts directory.`;
        console.error(`[PromptManager] ${errorMessage}`);
        throw new Error(errorMessage);
    }

    /**
     * Expand environment variables in path (e.g., %APPDATA%, %HOME%).
     * 
     * @param str The string containing environment variables
     * @returns The string with environment variables expanded
     */
    private expandEnvVars(str: string): string {
        return str.replace(/%([^%]+)%/g, (_, varName) => {
            return process.env[varName] || '';
        });
    }

    /**
     * Check if path exists using the adapter's file system.
     * 
     * @param filePath The path to check
     * @returns true if the path exists
     */
    private async pathExists(filePath: string): Promise<boolean> {
        try {
            const uri = this.adapter.createFileUri(filePath);
            await this.adapter.stat(uri);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Load mode-specific prompt with validation.
     * For vibe mode: loads executeTask.prompt.md + BASE_SYSTEM_PROMPT.instructions.md
     * For spec mode: loads requirements.prompt.md + BASE_SYSTEM_PROMPT.instructions.md
     * 
     * @param mode The coding mode to load prompts for
     * @returns The concatenated prompt content
     * @throws Error if no prompts could be loaded
     */
    async getPromptForMode(mode: CodingMode): Promise<string> {
        const promptsPath = await this.getPromptsPath();

        // Define required prompts for each mode (mode-specific first, base second)
        const promptFiles: Record<CodingMode, string[]> = {
            'vibe': ['executeTask.prompt.md', 'BASE_SYSTEM_PROMPT.instructions.md'],
            'spec': ['requirements.prompt.md', 'BASE_SYSTEM_PROMPT.instructions.md']
        };

        const files = promptFiles[mode];
        const loadedPrompts: string[] = [];
        const missingFiles: string[] = [];

        console.log(`[PromptManager] Loading prompts for ${mode} mode from ${promptsPath}`);

        // Try to load each prompt file
        for (const file of files) {
            const filePath = path.join(promptsPath, file);

            try {
                const content = await this.loadPromptFile(filePath);

                if (content) {
                    loadedPrompts.push(content);
                    console.log(`[PromptManager] Loaded ${file} successfully`);
                } else {
                    missingFiles.push(file);
                    console.warn(`[PromptManager] Failed to load ${file} (returned undefined)`);
                }
            } catch (error) {
                console.error(`[PromptManager] Error loading ${file}:`, error);
                missingFiles.push(file);
            }
        }

        // Handle missing files with user notification
        if (missingFiles.length > 0) {
            const message = `Missing prompt files in ${promptsPath}: ${missingFiles.join(', ')}`;
            console.error(`[PromptManager] ${message}`);

            this.adapter.showWarningMessage(
                `Some prompt files could not be loaded: ${missingFiles.join(', ')}. Check extension output for details.`,
                'Open Settings'
            ).then(selection => {
                if (selection === 'Open Settings') {
                    this.adapter.executeCommand(
                        'workbench.action.openSettings',
                        'kiroCopilot.promptsPath'
                    );
                }
            });
        }

        // Throw error if no prompt files could be loaded
        if (loadedPrompts.length === 0) {
            throw new Error(`No prompt files could be loaded for ${mode} mode. Check that prompt files exist in ${promptsPath}`);
        }

        // Concatenate prompts in correct order (mode-specific first, base second)
        const combined = loadedPrompts.join('\n\n---\n\n');
        console.log(`[PromptManager] Combined ${loadedPrompts.length} prompt(s) for ${mode} mode (${Math.round(combined.length / 1024)}KB)`);

        return combined;
    }

    /**
     * Load a prompt file from disk with caching.
     * 
     * @param filePath The path to the prompt file
     * @returns The file content, or undefined if loading failed
     */
    async loadPromptFile(filePath: string): Promise<string | undefined> {
        try {
            const uri = this.adapter.createFileUri(filePath);

            // Check cache and validate modification time
            const cached = this.promptCache.get(filePath);

            if (cached) {
                // Check if file has been modified since caching
                const stat = await this.adapter.stat(uri);

                if (stat.mtime === cached.lastModified) {
                    console.log(`[PromptManager] Cache hit: ${path.basename(filePath)}`);
                    return cached.content;
                }

                console.log(`[PromptManager] Cache invalidated (file modified): ${path.basename(filePath)}`);
            }

            // Read file content using adapter
            const contentBytes = await this.adapter.readFile(uri);
            const content = new TextDecoder('utf-8').decode(contentBytes);
            const stat = await this.adapter.stat(uri);

            // Validate file size and warn if exceeds 50KB
            const sizeInBytes = contentBytes.length;
            if (sizeInBytes > 50000) {
                console.warn(
                    `[PromptManager] Prompt file ${path.basename(filePath)} exceeds 50KB (${Math.round(sizeInBytes / 1024)}KB). ` +
                    `This may impact token usage.`
                );
            }

            // Cache the content with modification time
            this.promptCache.set(filePath, {
                content,
                lastModified: stat.mtime
            });

            console.log(`[PromptManager] Loaded and cached: ${path.basename(filePath)} (${Math.round(sizeInBytes / 1024)}KB)`);
            return content;

        } catch (error) {
            console.error(`[PromptManager] Failed to load prompt file ${filePath}:`, error);
            return undefined;
        }
    }

    /**
     * Get all available prompt files in the prompts directory.
     * 
     * @returns Array of prompt file names
     */
    async getAllPrompts(): Promise<string[]> {
        const promptsPath = await this.getPromptsPath();

        try {
            const uri = this.adapter.createFileUri(promptsPath);
            const entries = await this.adapter.readDirectory(uri);
            
            return entries
                .filter(([name, type]) => 
                    type === FileType.File && 
                    (name.endsWith('.md') || name.endsWith('.instructions.md'))
                )
                .map(([name]) => name);
        } catch (error) {
            console.warn('Failed to read prompts directory', error);
            return [];
        }
    }

    /**
     * Clear the prompt cache to force reloading of files.
     */
    clearCache(): void {
        this.promptCache.clear();
    }

    /**
     * Get task instructions combining the mode prompt with task content.
     * 
     * @param taskContent The content of the current task
     * @param mode The coding mode
     * @returns The combined instructions
     */
    async getTaskInstructions(taskContent: string, mode: CodingMode): Promise<string> {
        const basePrompt = await this.getPromptForMode(mode);

        if (mode === 'spec') {
            return `${basePrompt}\n\n# Current Task\n\n${taskContent}\n\nPlease follow the requirements generation workflow as specified in the prompt.`;
        } else {
            return `${basePrompt}\n\n# Current Task\n\n${taskContent}\n\nPlease help implement this task using an iterative, exploratory approach.`;
        }
    }
}
