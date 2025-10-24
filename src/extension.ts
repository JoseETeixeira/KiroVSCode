import * as vscode from 'vscode';
import { ModeSelectorProvider } from './views/modeSelectorProvider';
import { TaskContextProvider } from './views/taskContextProvider';
import { PromptManager } from './services/promptManager';
import { ChatParticipant } from './chat/chatParticipant';
import { ModeManager } from './services/modeManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('Kiro-Style Copilot extension is now active');

    // Initialize services
    const modeManager = new ModeManager(context);
    const promptManager = new PromptManager(context);

    // Register mode selector view
    const modeSelectorProvider = new ModeSelectorProvider(modeManager);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('kiro-copilot.modeSelector', modeSelectorProvider)
    );

    // Register task context provider
    const taskContextProvider = new TaskContextProvider(promptManager, modeManager);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('kiro-copilot.taskContext', taskContextProvider)
    );

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
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            const mode = modeManager.getCurrentMode();
            const prompt = await promptManager.getPromptForMode(mode);

            // Open chat with the task and appropriate prompt
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: taskItem ? taskItem.label : 'Start task',
                prompt: prompt
            });
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

    // Register chat participant
    const chatParticipant = new ChatParticipant(modeManager, promptManager);
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
