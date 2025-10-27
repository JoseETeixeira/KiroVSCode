import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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
    async copyPromptFiles(workspacePath: string): Promise<{ success: boolean; message: string }> {
        const extensionPromptsPath = path.join(this.extensionContext.extensionPath, 'prompts');
        const githubInstructionsPath = path.join(workspacePath, '.github', 'instructions');
        const githubPromptsPath = path.join(workspacePath, '.github', 'prompts');

        try {
            // Check if prompts directory exists in extension
            if (!fs.existsSync(extensionPromptsPath)) {
                return {
                    success: false,
                    message: 'No prompts directory found in extension'
                };
            }

            // Create .github directories if they don't exist
            if (!fs.existsSync(githubInstructionsPath)) {
                fs.mkdirSync(githubInstructionsPath, { recursive: true });
            }
            if (!fs.existsSync(githubPromptsPath)) {
                fs.mkdirSync(githubPromptsPath, { recursive: true });
            }

            // Copy instruction and prompt files to their respective locations
            const promptFiles = fs.readdirSync(extensionPromptsPath);
            let instructionsCount = 0;
            let promptsCount = 0;

            for (const file of promptFiles) {
                const srcPath = path.join(extensionPromptsPath, file);

                // Copy .instructions.md files to .github/instructions
                if (file.endsWith('.instructions.md')) {
                    const destPath = path.join(githubInstructionsPath, file);
                    fs.copyFileSync(srcPath, destPath);
                    instructionsCount++;
                }
                // Copy .prompt.md files to .github/prompts
                else if (file.endsWith('.prompt.md')) {
                    const destPath = path.join(githubPromptsPath, file);
                    fs.copyFileSync(srcPath, destPath);
                    promptsCount++;
                }
            }

            return {
                success: true,
                message: `Copied ${instructionsCount} instruction file(s) to .github/instructions/ and ${promptsCount} prompt file(s) to .github/prompts/`
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
        const userMcpPath = path.join(process.env.APPDATA || process.env.HOME || '', '.kiro', 'settings', 'mcp.json');

        const mcpServerDistPath = path.join(workspacePath, 'mcp-server', 'dist', 'index.js');

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
                    ]
                }
            }
        };

        try {
            // Try workspace-level config first
            let configPath = workspaceMcpPath;
            let configDir = kiroSettingsPath;
            let isWorkspaceLevel = true;

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

            const level = isWorkspaceLevel ? 'workspace (.kiro/settings/mcp.json)' : 'user-level';
            return {
                success: true,
                message: `MCP configuration updated at ${level}. You may need to restart VS Code.`
            };

        } catch (error) {
            return {
                success: false,
                message: `Failed to update MCP config: ${error instanceof Error ? error.message : String(error)}`
            };
        }
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
}
