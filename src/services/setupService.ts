import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { copyDirectorySkippingExisting, CopyStats, createCopyStats } from './promptCopyUtils';

interface PromptCopyDetails {
    prompts: CopyStats;
    instructions: CopyStats;
    autonomy?: AutonomyCopyDetails;
    failureCount: number;
}

type AutonomyCopyStatus = 'missing' | 'created' | 'skipped' | 'failed';

interface AutonomyCopyDetails {
    version?: string;
    manifestStatus: AutonomyCopyStatus;
    versionFileStatus: AutonomyCopyStatus;
}

export class SetupService {
    constructor(private extensionContext: vscode.ExtensionContext) {}

    /**
     * Check if MCP server is already set up
     */
    isMCPServerSetup(workspacePath: string): boolean {
        const workspaceDistPath = path.join(workspacePath, 'mcp-server', 'dist', 'index.js');
        const workspaceNodeModules = path.join(workspacePath, 'mcp-server', 'node_modules');
        return fs.existsSync(workspaceDistPath) && fs.existsSync(workspaceNodeModules);
    }

    /**
     * Check if prompt files are already set up
     */
    arePromptFilesSetup(workspacePath: string): boolean {
        const githubInstructionsPath = path.join(workspacePath, '.github', 'instructions');
        const githubPromptsPath = path.join(workspacePath, '.github', 'prompts');

        // Check if directories exist and have files
        if (!fs.existsSync(githubInstructionsPath) || !fs.existsSync(githubPromptsPath)) {
            return false;
        }

        const instructionsFiles = fs.readdirSync(githubInstructionsPath);
        const promptsFiles = fs.readdirSync(githubPromptsPath);

        return instructionsFiles.length > 0 && promptsFiles.length > 0;
    }

    /**
     * Setup MCP server in workspace
     */
    async setupMCPServer(workspacePath: string): Promise<{ success: boolean; message: string }> {
        const workspaceMcpPath = path.join(workspacePath, 'mcp-server');
        const extensionMcpPath = path.join(this.extensionContext.extensionPath, 'mcp-server');
        const extensionDistPath = path.join(extensionMcpPath, 'dist', 'index.js');

        try {
            // Check if extension's MCP server is built
            if (!fs.existsSync(extensionDistPath)) {
                return {
                    success: false,
                    message: 'Extension MCP server not found. Please rebuild the extension.'
                };
            }

            // Copy the MCP server directory (excluding node_modules)
            this.copyDirectory(extensionMcpPath, workspaceMcpPath);

            // Install dependencies
            const terminal = vscode.window.createTerminal({
                name: 'Kiro MCP Setup',
                cwd: workspaceMcpPath
            });

            terminal.sendText('npm install');
            terminal.show();

            return {
                success: true,
                message: 'MCP server copied. Installing dependencies in terminal...'
            };

        } catch (error) {
            return {
                success: false,
                message: `Failed to setup MCP server: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Copy prompt files to .github folders
     */
    async copyPromptFiles(
        workspacePath: string
    ): Promise<{ success: boolean; message: string; details?: PromptCopyDetails }> {
        const extensionPromptsPath = path.join(this.extensionContext.extensionPath, 'prompts');
        const githubRoot = path.join(workspacePath, '.github');
        const githubInstructionsPath = path.join(githubRoot, 'instructions');
        const githubPromptsPath = path.join(githubRoot, 'prompts');

        try {
            if (!fs.existsSync(extensionPromptsPath)) {
                return {
                    success: false,
                    message: 'No prompts directory found in extension'
                };
            }

            if (!fs.existsSync(githubRoot)) {
                fs.mkdirSync(githubRoot, { recursive: true });
            }
            if (!fs.existsSync(githubInstructionsPath)) {
                fs.mkdirSync(githubInstructionsPath, { recursive: true });
            }
            if (!fs.existsSync(githubPromptsPath)) {
                fs.mkdirSync(githubPromptsPath, { recursive: true });
            }

            const instructionStats = createCopyStats();
            const promptStats = createCopyStats();
            const autonomyDetails: AutonomyCopyDetails = {
                version: undefined,
                manifestStatus: 'missing',
                versionFileStatus: 'missing'
            };

            const instructionsSource = path.join(extensionPromptsPath, 'instructions');
            if (fs.existsSync(instructionsSource)) {
                copyDirectorySkippingExisting(instructionsSource, githubInstructionsPath, instructionStats, githubInstructionsPath);
            } else {
                this.copyFlatFiles(extensionPromptsPath, githubInstructionsPath, '.instructions.md', instructionStats);
            }

            const promptTemplatesSource = path.join(extensionPromptsPath, 'prompts');
            if (fs.existsSync(promptTemplatesSource)) {
                copyDirectorySkippingExisting(promptTemplatesSource, githubPromptsPath, promptStats, githubPromptsPath);
            } else {
                this.copyFlatFiles(extensionPromptsPath, githubPromptsPath, '.prompt.md', promptStats);
            }

            const autonomyManifestSource = path.join(extensionPromptsPath, 'autonomy.manifest.json');
            if (fs.existsSync(autonomyManifestSource)) {
                const manifestDestination = path.join(githubPromptsPath, 'autonomy.manifest.json');
                autonomyDetails.version = this.readAutonomyVersion(autonomyManifestSource) ?? autonomyDetails.version;
                try {
                    if (fs.existsSync(manifestDestination)) {
                        promptStats.skipped++;
                        autonomyDetails.manifestStatus = 'skipped';
                    } else {
                        fs.copyFileSync(autonomyManifestSource, manifestDestination);
                        promptStats.created++;
                        autonomyDetails.manifestStatus = 'created';
                    }
                } catch (error) {
                    autonomyDetails.manifestStatus = 'failed';
                    promptStats.failed.push({
                        relativePath: path.relative(githubPromptsPath, manifestDestination) || 'autonomy.manifest.json',
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            const autonomyVersionSource = path.join(extensionPromptsPath, 'autonomy-version.json');
            if (fs.existsSync(autonomyVersionSource)) {
                const versionDestination = path.join(githubPromptsPath, 'autonomy-version.json');
                autonomyDetails.version = autonomyDetails.version ?? this.readAutonomyVersion(autonomyVersionSource);
                try {
                    if (fs.existsSync(versionDestination)) {
                        promptStats.skipped++;
                        autonomyDetails.versionFileStatus = 'skipped';
                    } else {
                        fs.copyFileSync(autonomyVersionSource, versionDestination);
                        promptStats.created++;
                        autonomyDetails.versionFileStatus = 'created';
                    }
                } catch (error) {
                    autonomyDetails.versionFileStatus = 'failed';
                    promptStats.failed.push({
                        relativePath: path.relative(githubPromptsPath, versionDestination) || 'autonomy-version.json',
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            const failures = [...instructionStats.failed, ...promptStats.failed];
            const failureCount = failures.length;

            const messageParts = [
                `Prompts: ${promptStats.created} created, ${promptStats.skipped} skipped`,
                `Instructions: ${instructionStats.created} created, ${instructionStats.skipped} skipped`
            ];

            if (
                autonomyDetails.version ||
                autonomyDetails.manifestStatus !== 'missing' ||
                autonomyDetails.versionFileStatus !== 'missing'
            ) {
                const versionLabel = autonomyDetails.version ? `v${autonomyDetails.version}` : 'version unknown';
                messageParts.push(
                    `Autonomy: ${versionLabel} (manifest ${autonomyDetails.manifestStatus}, version file ${autonomyDetails.versionFileStatus})`
                );
            }

            if (failureCount > 0) {
                const failureSummary = failures
                    .slice(0, 5)
                    .map(failure => `${failure.relativePath}: ${failure.error}`)
                    .join('; ');
                messageParts.push(`Failures (${failureCount}): ${failureSummary}`);
            }

            return {
                success: failureCount === 0,
                message: messageParts.join(' | '),
                details: {
                    prompts: promptStats,
                    instructions: instructionStats,
                    autonomy: autonomyDetails,
                    failureCount
                }
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to copy prompt files: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Setup MCP configuration
     */
    async setupMCPConfig(workspacePath: string): Promise<{ success: boolean; message: string }> {
        // Try workspace-level config first
        const kiroSettingsPath = path.join(workspacePath, '.vscode');
        const workspaceMcpPath = path.join(kiroSettingsPath, 'mcp.json');

        // Fallback to user-level config if workspace config fails
        const userMcpPath = path.join(process.env.APPDATA || process.env.HOME || '', '.vscode', 'mcp.json');

        const mcpServerDistPath = path.join(workspacePath, 'mcp-server', 'dist', 'index.js');

        const copilotToken = await this.getCopilotAuthToken();
        const envVars = this.buildMcpEnvVars(copilotToken);

        const mcpConfig = {
            servers: {
                kiro: {
                    command: 'node',
                    args: [
                        mcpServerDistPath,
                        '--workspace',
                        workspacePath,
                        '--prompts',
                        path.join(workspacePath, '.github', 'prompts')
                    ],
                    disabled: false,
                    autoApprove: [
                        'kiro_execute_task',
                        'kiro_create_requirements',
                        'kiro_set_mode',
                        'kiro_get_current_mode'
                    ],
                    env: envVars
                }
            }
        };

        try {
            // Try workspace-level config first
            let configPath = workspaceMcpPath;
            let configDir = kiroSettingsPath;
            let isWorkspaceLevel = true;

            // If we have a token, prefer writing to the user-level config so we don't commit secrets
            if (copilotToken) {
                configPath = userMcpPath;
                configDir = path.dirname(userMcpPath);
                isWorkspaceLevel = false;
            }

            // Check if we can create workspace-level config
            try {
                if (!fs.existsSync(configDir)) {
                    fs.mkdirSync(configDir, { recursive: true });
                }
            } catch (workspaceError) {
                // If workspace-level fails, use user-level
                console.warn('Cannot create workspace-level config, using user-level:', workspaceError);
                configPath = userMcpPath;
                configDir = path.dirname(userMcpPath);
                isWorkspaceLevel = false;
            }

            // Read existing config if it exists
            let existingConfig: { servers?: Record<string, unknown> } = {};
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf-8');
                existingConfig = JSON.parse(content);
            }

            // Merge configs
            existingConfig.servers = existingConfig.servers || {};
            existingConfig.servers.kiro = mcpConfig.servers.kiro;

            // Ensure directory exists
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // Write config
            fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

            const level = isWorkspaceLevel ? 'workspace (.vscode/mcp.json)' : 'user-level';
            const envSummary = copilotToken
                ? 'Copilot auth token injected for LLM bridge.'
                : 'Configured workspace default model for MCP LLM bridge; provide Copilot auth to enable direct LLM calls.';
            return {
                success: true,
                message: `MCP configuration updated at ${level}. ${envSummary} You may need to restart VS Code.`
            };

        } catch (error) {
            return {
                success: false,
                message: `Failed to update MCP config: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async getCopilotAuthToken(): Promise<string | undefined> {
        try {
            const session = await vscode.authentication.getSession('github', ['copilot'], { createIfNone: true });
            return session?.accessToken;
        } catch (error) {
            console.warn('[SetupService] Unable to retrieve Copilot auth token for MCP server', error);
            return undefined;
        }
    }

    private buildMcpEnvVars(copilotToken?: string): Record<string, string> {
        const envVars: Record<string, string> = {};

        const defaultModel = this.getDefaultLLMModel();
        if (defaultModel) {
            envVars.KIRO_DEFAULT_MODEL = defaultModel;
        }

        if (copilotToken) {
            envVars.KIRO_LLM_TOKEN = copilotToken;
        }

        return envVars;
    }

    private getDefaultLLMModel(): string {
        const config = vscode.workspace.getConfiguration('kiroCopilot');
        const configuredModel = config.get<string>('defaultLanguageModel');
        if (configuredModel && typeof configuredModel === 'string' && configuredModel.trim().length > 0) {
            return configuredModel.trim();
        }
        return 'copilot-gpt-5';
    }

    /**
     * Recursively copy directory (excluding node_modules)
     */
    private copyDirectory(src: string, dest: string): void {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                if (entry.name === 'node_modules') {
                    continue;
                }
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    private readAutonomyVersion(filePath: string): string | undefined {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            return typeof parsed.version === 'string' ? parsed.version : undefined;
        } catch (error) {
            console.warn('Unable to parse autonomy version from', filePath, error);
            return undefined;
        }
    }

    private copyFlatFiles(srcDir: string, destDir: string, suffix: string, stats: CopyStats): void {
        if (!fs.existsSync(srcDir)) {
            return;
        }

        const entries = fs.readdirSync(srcDir, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith(suffix)) {
                continue;
            }

            const srcPath = path.join(srcDir, entry.name);
            const destPath = path.join(destDir, entry.name);

            try {
                if (fs.existsSync(destPath)) {
                    stats.skipped++;
                    continue;
                }

                fs.copyFileSync(srcPath, destPath);
                stats.created++;
            } catch (error) {
                stats.failed.push({
                    relativePath: entry.name,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }
}
