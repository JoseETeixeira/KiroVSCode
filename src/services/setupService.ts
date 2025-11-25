import * as path from 'path';
import * as fs from 'fs';
import { copyDirectorySkippingExisting, CopyStats, createCopyStats } from './promptCopyUtils';
import { IPlatformAdapter } from '../adapters';

interface PromptCopyDetails {
    prompts: CopyStats;
    instructions: CopyStats;
    agents: CopyStats;
    autonomy?: AutonomyCopyDetails;
    failureCount: number;
}

type AutonomyCopyStatus = 'missing' | 'created' | 'updated' | 'skipped' | 'failed';

interface AutonomyCopyDetails {
    version?: string;
    manifestStatus: AutonomyCopyStatus;
    versionFileStatus: AutonomyCopyStatus;
}

export class SetupService {
    constructor(private adapter: IPlatformAdapter) {}

    /**
     * Get the extension path from the adapter's extension context
     */
    private get extensionPath(): string {
        return this.adapter.getExtensionContext().extensionPath;
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
     * Copy prompt files to .github folders
     */
    async copyPromptFiles(
        workspacePath: string
    ): Promise<{ success: boolean; message: string; details?: PromptCopyDetails }> {
        const extensionPromptsPath = path.join(this.extensionPath, 'prompts');
        const githubRoot = path.join(workspacePath, '.github');
        const githubInstructionsPath = path.join(githubRoot, 'instructions');
        const githubPromptsPath = path.join(githubRoot, 'prompts');
        const githubAgentsPath = path.join(githubRoot, 'agents');

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
            if (!fs.existsSync(githubAgentsPath)) {
                fs.mkdirSync(githubAgentsPath, { recursive: true });
            }

            const instructionStats = createCopyStats();
            const promptStats = createCopyStats();
            const agentStats = createCopyStats();
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

            const agentsSource = path.join(extensionPromptsPath, 'agents');
            if (fs.existsSync(agentsSource)) {
                copyDirectorySkippingExisting(agentsSource, githubAgentsPath, agentStats, githubAgentsPath);
            }

            const autonomyManifestSource = path.join(extensionPromptsPath, 'autonomy.manifest.json');
            if (fs.existsSync(autonomyManifestSource)) {
                const manifestDestination = path.join(githubPromptsPath, 'autonomy.manifest.json');
                autonomyDetails.version = this.readAutonomyVersion(autonomyManifestSource) ?? autonomyDetails.version;
                const existed = fs.existsSync(manifestDestination);
                try {
                    fs.copyFileSync(autonomyManifestSource, manifestDestination);
                    if (existed) {
                        promptStats.updated++;
                        autonomyDetails.manifestStatus = 'updated';
                    } else {
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
                const existed = fs.existsSync(versionDestination);
                try {
                    fs.copyFileSync(autonomyVersionSource, versionDestination);
                    if (existed) {
                        promptStats.updated++;
                        autonomyDetails.versionFileStatus = 'updated';
                    } else {
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

            const failures = [...instructionStats.failed, ...promptStats.failed, ...agentStats.failed];
            const failureCount = failures.length;

            const formatStats = (label: string, stats: CopyStats): string =>
                `${label}: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped`;

            const messageParts = [
                formatStats('Prompts', promptStats),
                formatStats('Instructions', instructionStats),
                formatStats('Agents', agentStats)
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
                    agents: agentStats,
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

    ensureChatApiSetting(workspacePath: string): { success: boolean; updated: boolean; message?: string } {
        try {
            const settingsDir = path.join(workspacePath, '.vscode');
            const settingsPath = path.join(settingsDir, 'settings.json');

            let settings: Record<string, unknown> = {};
            if (fs.existsSync(settingsPath)) {
                try {
                    const raw = fs.readFileSync(settingsPath, 'utf-8');
                    settings = JSON.parse(raw) as Record<string, unknown>;
                } catch (error) {
                    return {
                        success: false,
                        updated: false,
                        message: `Unable to parse ${path.relative(workspacePath, settingsPath)}: ${error instanceof Error ? error.message : String(error)}`
                    };
                }
            }

            if (settings['workbench.experimental.chatApi'] === true) {
                return { success: true, updated: false };
            }

            settings['workbench.experimental.chatApi'] = true;
            if (!fs.existsSync(settingsDir)) {
                fs.mkdirSync(settingsDir, { recursive: true });
            }
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

            return { success: true, updated: true };
        } catch (error) {
            return {
                success: false,
                updated: false,
                message: `Failed to update VS Code settings: ${error instanceof Error ? error.message : String(error)}`
            };
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
