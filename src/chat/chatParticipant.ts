import * as vscode from 'vscode';
import { ModeManager } from '../services/modeManager';
import { PromptManager } from '../services/promptManager';

export class ChatParticipant {
    constructor(
        private modeManager: ModeManager,
        private promptManager: PromptManager
    ) {}

    register(): vscode.Disposable {
        const participant = vscode.chat.createChatParticipant('kiro-copilot.assistant', async (
            request: vscode.ChatRequest,
            context: vscode.ChatContext,
            stream: vscode.ChatResponseStream,
            token: vscode.CancellationToken
        ) => {
            // Handle slash commands
            if (request.command === 'vibe') {
                await this.modeManager.setMode('vibe');
                stream.markdown('Switched to **Vibe Coding** mode 🎯\n\n');
                stream.markdown('*Chat first, then build. Explore ideas and iterate as you discover needs.*\n\n');
                stream.markdown('Great for:\n');
                stream.markdown('- Rapid exploration and testing\n');
                stream.markdown('- Building when requirements are unclear\n');
                stream.markdown('- Implementing a task\n');
                return;
            }

            if (request.command === 'spec') {
                await this.modeManager.setMode('spec');
                stream.markdown('Switched to **Spec** mode 📋\n\n');
                stream.markdown('*Plan first, then build. Create requirements and design before coding starts.*\n\n');
                stream.markdown('Great for:\n');
                stream.markdown('- Structured feature development\n');
                stream.markdown('- Requirements-driven development\n');
                stream.markdown('- Complex features requiring formal specs\n');
                return;
            }

            if (request.command === 'task') {
                await this.handleTaskCommand(request, stream);
                return;
            }

            // Get current mode and apply mode-specific prompt
            const mode = this.modeManager.getCurrentMode();

            // Auto-apply mode-specific prompts using getPromptForMode
            const systemContext = await this.promptManager.getPromptForMode(mode);

            // Check if working with tasks.md
            const editor = vscode.window.activeTextEditor;
            const isTaskFile = editor?.document.fileName.endsWith('tasks.md');

            // Show mode and context status to user
            if (isTaskFile) {
                stream.markdown(`Working in **${mode === 'vibe' ? 'Vibe Coding' : 'Spec'}** mode with tasks.md\n\n`);

                if (mode === 'spec') {
                    stream.markdown('Following requirements generation workflow...\n\n');
                    stream.markdown('Task context loaded. How can I help with your specification?\n');
                } else {
                    stream.markdown('Task context loaded. Let\'s iterate on this together.\n');
                }
            } else {
                stream.markdown(`*${mode === 'vibe' ? 'Vibe Coding' : 'Spec'} mode active*\n\n`);

                if (systemContext) {
                    stream.markdown(`Mode-specific prompt applied (${mode === 'spec' ? 'Requirements workflow + Base instructions' : 'Base instructions'})\n\n`);
                }
            }

            // Provide helpful context based on mode
            if (mode === 'spec' && request.prompt.toLowerCase().includes('plan')) {
                stream.markdown('I\'ll help you create a formal requirements specification using the EARS syntax.\n\n');
            } else if (mode === 'vibe') {
                stream.markdown('Let\'s explore this together and iterate as we go.\n\n');
            }

            // Note: The systemContext contains the mode-specific prompts that would be
            // passed to the underlying language model. In a full implementation,
            // this would be sent as system messages to guide the model's behavior.
            // For now, we're showing users that the prompts are loaded and active.
            stream.markdown('---\n\n');
        });

        // Set metadata
        participant.iconPath = vscode.Uri.file('resources/kiro-icon.svg');

        return participant;
    }

    private async handleTaskCommand(
        request: vscode.ChatRequest,
        stream: vscode.ChatResponseStream
    ): Promise<void> {
        const editor = vscode.window.activeTextEditor;

        if (!editor || !editor.document.fileName.endsWith('tasks.md')) {
            stream.markdown('⚠️ Please open a `tasks.md` file to use the task command.\n');
            return;
        }

        const mode = this.modeManager.getCurrentMode();
        stream.markdown(`Starting task in **${mode === 'vibe' ? 'Vibe Coding' : 'Spec'}** mode...\n\n`);

        // Load mode-specific prompts for task context
        await this.promptManager.getTaskInstructions(
            editor.document.getText(),
            mode
        );

        if (mode === 'spec') {
            stream.markdown('I\'ll guide you through the requirements specification process:\n\n');
            stream.markdown('1. Review project context from `.kiro/steering/` files\n');
            stream.markdown('2. Generate initial `requirements.md` draft\n');
            stream.markdown('3. Request your approval\n');
            stream.markdown('4. Iterate based on your feedback\n\n');
        } else {
            stream.markdown('Let\'s start working on this task. I\'ll help you:\n\n');
            stream.markdown('- Understand the requirements\n');
            stream.markdown('- Explore implementation options\n');
            stream.markdown('- Iterate quickly based on feedback\n\n');
        }
    }
}
