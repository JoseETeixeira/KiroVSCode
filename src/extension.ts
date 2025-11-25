import * as vscode from 'vscode';
import { ModeSelectorProvider } from './views/modeSelectorProvider';
import { TaskContextProvider } from './views/taskContextProvider';
import { PromptManager } from './services/promptManager';
import { ChatParticipant } from './chat/chatParticipant';
import { ModeManager } from './services/modeManager';
import { SetupService } from './services/setupService';
import { AutonomyPolicyService } from './services/autonomyPolicyService';
import { IntentService } from './services/intentService';
import { AdapterFactory, IPlatformAdapter } from './adapters';

// Module-level adapter reference for use throughout the extension
let platformAdapter: IPlatformAdapter | undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Kiro-Style Copilot extension is now active');

    // ========================================================================
    // Platform Adapter Initialization
    // ========================================================================
    
    try {
        // Initialize the platform adapter (auto-detects VS Code or Antigravity)
        platformAdapter = await AdapterFactory.getAdapter(context as unknown as import('./adapters').ExtensionContext);
        
        // Log platform detection results
        console.log(`[Kiro] Platform detected: ${platformAdapter.platformName} v${platformAdapter.version}`);
        
        const detectionResult = AdapterFactory.getDetectionResult();
        if (detectionResult) {
            console.log(`[Kiro] Detection time: ${detectionResult.detectionTimeMs.toFixed(2)}ms`);
            if (detectionResult.details.warningMessage) {
                console.warn(`[Kiro] ${detectionResult.details.warningMessage}`);
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Kiro] Failed to initialize platform adapter:', errorMessage);
        
        // Show user-facing error message
        // Note: We use vscode directly here because the adapter initialization failed.
        // This is a fallback scenario - if we can't initialize the adapter, we can't use it.
        vscode.window.showErrorMessage(
            `Kiro extension failed to initialize: ${errorMessage}. ` +
            'Please check the console for details.'
        );
        
        // Cannot continue without adapter
        return;
    }

    // Use the adapter reference for all platform operations
    const adapter = platformAdapter;

    // Initialize services
    // ModeManager, PromptManager, SetupService, AutonomyPolicyService, and IntentService now use IPlatformAdapter
    // Other services will be refactored in later tasks to accept IPlatformAdapter
    const modeManager = new ModeManager(adapter);
    const promptManager = new PromptManager(adapter);
    const setupService = new SetupService(adapter);
    const autonomyPolicyService = new AutonomyPolicyService(context, adapter);
    const intentService = new IntentService(context, autonomyPolicyService, adapter);

    context.subscriptions.push(autonomyPolicyService, intentService, promptManager);

    // Register mode selector view
    // Note: Tree data providers still use vscode types for tree items but use adapter for events
    const modeSelectorProvider = new ModeSelectorProvider(modeManager, adapter);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('kiro-copilot.modeSelector', modeSelectorProvider)
    );

    // Register task context provider
    const taskContextProvider = new TaskContextProvider(
        adapter,
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
        adapter.onDidChangeActiveTextEditor(() => {
            taskContextProvider.refresh();
        })
    );

    // Register commands using adapter
    context.subscriptions.push(
        adapter.registerCommand('kiro-copilot.switchToVibeMode', async () => {
            await modeManager.setMode('vibe');
            await adapter.showInformationMessage('🎯 Switched to Vibe Coding mode - Chat first, then build!');
            modeSelectorProvider.refresh();
        })
    );

    context.subscriptions.push(
        adapter.registerCommand('kiro-copilot.switchToSpecMode', async () => {
            await modeManager.setMode('spec');
            await adapter.showInformationMessage('📋 Switched to Spec mode - Plan first, then build!');
            modeSelectorProvider.refresh();
        })
    );

    context.subscriptions.push(
        adapter.registerCommand('kiro-copilot.openModeSelector', async () => {
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

            const selected = await adapter.showQuickPick(modes, {
                placeHolder: 'Select your coding mode'
            });

            if (selected) {
                await modeManager.setMode(selected.mode);
                await adapter.showInformationMessage(
                    `Switched to ${selected.mode === 'vibe' ? 'Vibe Coding' : 'Spec'} mode`
                );
                modeSelectorProvider.refresh();
            }
        })
    );

    context.subscriptions.push(
        adapter.registerCommand('kiro-copilot.startTaskFromFile', async (taskItem) => {
            if (!taskItem) {
                await adapter.showWarningMessage('No task selected');
                return;
            }

            // Build context message with task details, steering, and spec files
            const workspaceFolders = adapter.getWorkspaceFolders();
            const workspaceFolder = workspaceFolders?.[0];
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

            const inserted = await prefillChatInput(contextMessage, adapter);

            if (inserted) {
                await adapter.showInformationMessage('Chat input prepared. Review and send when you are ready.');
            } else {
                await adapter.writeToClipboard(contextMessage);
                await adapter.showWarningMessage(
                    'Unable to prefill the chat input automatically. The message has been copied to your clipboard instead.'
                );
            }
        })
    );

    context.subscriptions.push(
        adapter.registerCommand('kiro-copilot.deleteSpec', async (treeItem) => {
            await taskContextProvider.handleDeleteSpecCommand(treeItem as any);
        })
    );

    context.subscriptions.push(
        adapter.registerCommand('kiro-copilot.executeNextAutonomously', async (treeItem) => {
            await taskContextProvider.handleExecuteNextAutonomyCommand(treeItem as any);
        })
    );

    context.subscriptions.push(
        adapter.registerCommand('kiro-copilot.retryAutonomously', async (treeItem) => {
            await taskContextProvider.handleRetryAutonomyCommand(treeItem as any);
        })
    );

    context.subscriptions.push(
        adapter.registerCommand('kiro-copilot.enableAutonomy', async () => {
            const workspaceFolders = adapter.getWorkspaceFolders();
            const workspaceFolder = workspaceFolders?.[0];
            if (!workspaceFolder) {
                await adapter.showErrorMessage('Open a workspace folder before enabling autonomy.');
                return;
            }

            const { policy, error } = await autonomyPolicyService.getPolicy(workspaceFolder as unknown as vscode.WorkspaceFolder);
            if (!policy) {
                await adapter.showErrorMessage(error ?? 'Autonomy policy unavailable. Run "Kiro: Setup Project" first.');
                return;
            }

            const consentActions = policy.actions.filter(action => action.requiresConsent);
            if (consentActions.length === 0) {
                await adapter.showInformationMessage('No consent-required autonomy actions are defined in the manifest.');
                return;
            }

            const pick = await adapter.showQuickPick(
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

            await autonomyPolicyService.requestConsent(pick.action.id, workspaceFolder as unknown as vscode.WorkspaceFolder);
            taskContextProvider.refresh();
        })
    );

    context.subscriptions.push(
        adapter.registerCommand('kiro-copilot.refreshModeSelector', () => {
            modeSelectorProvider.refresh();
        })
    );

    context.subscriptions.push(
        adapter.registerCommand('kiro-copilot.refreshTaskContext', () => {
            taskContextProvider.refresh();
        })
    );

    // Register setup project command
    // Note: withProgress is VS Code-specific and will be abstracted in a future update
    context.subscriptions.push(
        adapter.registerCommand('kiro-copilot.setupProject', async () => {
            const workspaceFolders = adapter.getWorkspaceFolders();
            const workspaceFolder = workspaceFolders?.[0];
            if (!workspaceFolder) {
                await adapter.showErrorMessage('No workspace folder open. Please open a workspace.');
                return;
            }

            const workspacePath = workspaceFolder.uri.fsPath;

            // Note: vscode.window.withProgress is VS Code-specific
            // For now, we use it directly; will be abstracted if needed for Antigravity
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Setting up Kiro',
                    cancellable: false
                },
                async (progress) => {
                    progress.report({ message: 'Syncing prompt files...' });
                    const promptResult = await setupService.copyPromptFiles(workspacePath);
                    if (promptResult.success) {
                        await adapter.showInformationMessage(promptResult.message);
                    } else {
                        await adapter.showWarningMessage(promptResult.message);
                    }

                    const chatApiResult = setupService.ensureChatApiSetting(workspacePath);
                    if (!chatApiResult.success && chatApiResult.message) {
                        await adapter.showWarningMessage(chatApiResult.message);
                    } else if (chatApiResult.updated) {
                        await adapter.showInformationMessage('Enabled experimental chat API for Kiro prompts.');
                    }

                    await adapter.showInformationMessage('✓ Kiro setup complete! Prompt templates are synced.');
                }
            );
        })
    );

    // Register chat participant
    // ChatParticipant now uses IPlatformAdapter (refactored in Task 9)
    const chatParticipant = new ChatParticipant(
        adapter,
        modeManager,
        promptManager,
        setupService
    );
    context.subscriptions.push(chatParticipant.register());

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('hasShownWelcome', false);
    if (!hasShownWelcome) {
        adapter.showInformationMessage(
            'Welcome to Kiro-Style Copilot! Choose your coding mode to get started.',
            'Select Mode'
        ).then(selection => {
            if (selection === 'Select Mode') {
                adapter.executeCommand('kiro-copilot.openModeSelector');
            }
        });
        context.globalState.update('hasShownWelcome', true);
    }
}

export function deactivate() {}

/**
 * Attempts to prefill the chat input with a message.
 * Uses the platform adapter for command execution.
 * 
 * @param message The message to prefill
 * @param adapter The platform adapter to use for command execution
 * @returns true if successful, false otherwise
 */
async function prefillChatInput(message: string, adapter: IPlatformAdapter): Promise<boolean> {
    try {
        await adapter.executeCommand('workbench.action.chat.open');
        await delay(100);
        await adapter.executeCommand('type', { text: message });
        return true;
    } catch (error) {
        console.warn('[Kiro] Unable to prefill chat input.', error);
        return false;
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
