import * as vscode from 'vscode';
import { ModeSelectorProvider } from './views/modeSelectorProvider';
import { TaskContextProvider } from './views/taskContextProvider';
import { PromptManager } from './services/promptManager';
import { ChatParticipant } from './chat/chatParticipant';
import { ModeManager } from './services/modeManager';
import { SetupService } from './services/setupService';
import { AutonomyPolicyService } from './services/autonomyPolicyService';
import { IntentService } from './services/intentService';

export function activate(context: vscode.ExtensionContext) {
    console.log('Kiro-Style Copilot extension is now active');

    // Initialize services
    const modeManager = new ModeManager(context);
    const promptManager = new PromptManager(context);
    const setupService = new SetupService(context);
    const autonomyPolicyService = new AutonomyPolicyService(context);
    const intentService = new IntentService(context, autonomyPolicyService);

    context.subscriptions.push(autonomyPolicyService, intentService);

    // Register mode selector view
    const modeSelectorProvider = new ModeSelectorProvider(modeManager);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('kiro-copilot.modeSelector', modeSelectorProvider)
    );

    // Register task context provider
    const taskContextProvider = new TaskContextProvider(
        promptManager,
        modeManager,
        intentService,
        autonomyPolicyService
    );
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('kiro-copilot.taskContext', taskContextProvider)
    );
    context.subscriptions.push(taskContextProvider);

    // Watch for active editor changes to update task context
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            taskContextProvider.refresh();
        })
    );

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('kiro-copilot.switchToVibeMode', async () => {
            await modeManager.setMode('vibe');
            vscode.window.showInformationMessage('🎯 Switched to Vibe Coding mode - Chat first, then build!');
            modeSelectorProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kiro-copilot.switchToSpecMode', async () => {
            await modeManager.setMode('spec');
            vscode.window.showInformationMessage('📋 Switched to Spec mode - Plan first, then build!');
            modeSelectorProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kiro-copilot.openModeSelector', async () => {
            const modes = [
                {
                    label: '$(rocket) Vibe Coding',
                    description: 'Chat first, then build. Explore ideas and iterate as you discover needs.',
                    mode: 'vibe' as const
                },
                {
                    label: '$(notebook) Spec',
                    description: 'Plan first, then build. Create requirements and design before coding starts.',
                    mode: 'spec' as const
                }
            ];

            const selected = await vscode.window.showQuickPick(modes, {
                placeHolder: 'Select your coding mode'
            });

            if (selected) {
                await modeManager.setMode(selected.mode);
                vscode.window.showInformationMessage(
                    `Switched to ${selected.mode === 'vibe' ? 'Vibe Coding' : 'Spec'} mode`
                );
                modeSelectorProvider.refresh();
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kiro-copilot.startTaskFromFile', async (taskItem) => {
            if (!taskItem) {
                vscode.window.showWarningMessage('No task selected');
                return;
            }

            // Build context message with task details, steering, and spec files
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return;
            }

            let contextMessage = `Execute this task:\n\n**Task:** ${taskItem.label}\n`;

            if (taskItem.specFolder) {
                contextMessage += `**Spec:** ${taskItem.specFolder}\n`;
            }

            contextMessage += `**File:** ${taskItem.filePath}\n`;
            contextMessage += `**Line:** ${taskItem.lineNumber + 1}\n\n`;

            // Add note about context
            contextMessage += `Please read the following files for context:\n`;
            contextMessage += `- All files in .kiro/steering/ (project guidelines)\n`;

            if (taskItem.specFolder) {
                contextMessage += `- .kiro/specs/${taskItem.specFolder}/requirements.md (requirements)\n`;
                contextMessage += `- .kiro/specs/${taskItem.specFolder}/design.md (design)\n`;
                contextMessage += `- .kiro/specs/${taskItem.specFolder}/tasks.md (all tasks)\n`;
            }

            contextMessage += `\nThen implement this task following the executeTask workflow.`;

            // Open chat with @kiro and the context message
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: `@kiro ${contextMessage}`
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kiro-copilot.deleteSpec', async (treeItem) => {
            await taskContextProvider.handleDeleteSpecCommand(treeItem as any);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kiro-copilot.executeNextAutonomously', async (treeItem) => {
            await taskContextProvider.handleExecuteNextAutonomyCommand(treeItem as any);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kiro-copilot.retryAutonomously', async (treeItem) => {
            await taskContextProvider.handleRetryAutonomyCommand(treeItem as any);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kiro-copilot.enableAutonomy', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Open a workspace folder before enabling autonomy.');
                return;
            }

            const { policy, error } = await autonomyPolicyService.getPolicy(workspaceFolder);
            if (!policy) {
                vscode.window.showErrorMessage(error ?? 'Autonomy policy unavailable. Run "Kiro: Setup Project" first.');
                return;
            }

            const consentActions = policy.actions.filter(action => action.requiresConsent);
            if (consentActions.length === 0) {
                vscode.window.showInformationMessage('No consent-required autonomy actions are defined in the manifest.');
                return;
            }

            const pick = await vscode.window.showQuickPick(
                consentActions.map(action => ({
                    label: action.description || action.id,
                    description: action.id,
                    action
                })),
                {
                    placeHolder: 'Select the autonomy action to enable'
                }
            );

            if (!pick) {
                return;
            }

            await autonomyPolicyService.requestConsent(pick.action.id, workspaceFolder);
            taskContextProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kiro-copilot.refreshModeSelector', () => {
            modeSelectorProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('kiro-copilot.refreshTaskContext', () => {
            taskContextProvider.refresh();
        })
    );

    // Register setup project command
    context.subscriptions.push(
        vscode.commands.registerCommand('kiro-copilot.setupProject', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder open. Please open a workspace.');
                return;
            }

            const workspacePath = workspaceFolder.uri.fsPath;

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Setting up Kiro',
                    cancellable: false
                },
                async (progress) => {
                    progress.report({ message: 'Checking setup status...' });

                    // Setup MCP server if needed
                    if (!setupService.isMCPServerSetup(workspacePath)) {
                        progress.report({ message: 'Setting up MCP server...' });
                        const mcpResult = await setupService.setupMCPServer(workspacePath);
                        if (!mcpResult.success) {
                            vscode.window.showErrorMessage(mcpResult.message);
                            return;
                        }
                    }

                    // Sync prompt files (always run to fill in any missing templates)
                    progress.report({ message: 'Syncing prompt files...' });
                    const promptResult = await setupService.copyPromptFiles(workspacePath);
                    if (promptResult.success) {
                        vscode.window.showInformationMessage(promptResult.message);
                    } else {
                        vscode.window.showWarningMessage(promptResult.message);
                    }

                    // Setup MCP config
                    progress.report({ message: 'Updating MCP configuration...' });
                    const configResult = await setupService.setupMCPConfig(workspacePath);

                    if (configResult.success) {
                        vscode.window.showInformationMessage(
                            '✓ Kiro setup complete! Check the terminal for installation progress. You may need to restart VS Code.',
                            'Restart Now'
                        ).then(selection => {
                            if (selection === 'Restart Now') {
                                vscode.commands.executeCommand('workbench.action.reloadWindow');
                            }
                        });
                    } else {
                        vscode.window.showErrorMessage(configResult.message);
                    }
                }
            );
        })
    );

    // Register chat participant
    const chatParticipant = new ChatParticipant(
        modeManager,
        promptManager,
        taskContextProvider,
        context,
        setupService,
        autonomyPolicyService
    );
    context.subscriptions.push(chatParticipant.register());

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('hasShownWelcome', false);
    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            'Welcome to Kiro-Style Copilot! Choose your coding mode to get started.',
            'Select Mode'
        ).then(selection => {
            if (selection === 'Select Mode') {
                vscode.commands.executeCommand('kiro-copilot.openModeSelector');
            }
        });
        context.globalState.update('hasShownWelcome', true);
    }
}

export function deactivate() {}
