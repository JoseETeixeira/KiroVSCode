import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CodingMode } from './modeManager';

export class PromptManager {
    private promptCache: Map<string, string> = new Map();
    private extensionContext?: vscode.ExtensionContext;

    constructor(context?: vscode.ExtensionContext) {
        this.extensionContext = context;
    }

    /**
     * Get prompts path - prioritizes embedded prompts, falls back to user folder
     */
    async getPromptsPath(): Promise<string> {
        // First, try embedded prompts in extension
        if (this.extensionContext) {
            const embeddedPath = path.join(this.extensionContext.extensionPath, 'prompts');
            try {
                await fs.access(embeddedPath);
                return embeddedPath;
            } catch {
                // Embedded prompts don't exist, fall through to user folder
            }
        }

        // Fall back to user-configured or default prompts path
        const config = vscode.workspace.getConfiguration('kiroCopilot');
        return config.get<string>('promptsPath',
            path.join(process.env.APPDATA || '', 'Code', 'User', 'prompts')
        );
    }

    async getPromptForMode(mode: CodingMode): Promise<string | undefined> {
        const promptsPath = await this.getPromptsPath();

        // Map modes to their primary prompt files
        const promptFileMap: Record<CodingMode, string[]> = {
            'vibe': ['BASE_SYSTEM_PROMPT.instructions.md'],
            'spec': ['requirements.prompt.md', 'BASE_SYSTEM_PROMPT.instructions.md']
        };

        const promptFiles = promptFileMap[mode];
        let combinedPrompt = '';

        for (const file of promptFiles) {
            const promptPath = path.join(promptsPath, file);
            const content = await this.loadPromptFile(promptPath);
            if (content) {
                combinedPrompt += content + '\n\n';
            }
        }

        return combinedPrompt || undefined;
    }

    async loadPromptFile(filePath: string): Promise<string | undefined> {
        // Check cache first
        if (this.promptCache.has(filePath)) {
            return this.promptCache.get(filePath);
        }

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            this.promptCache.set(filePath, content);
            return content;
        } catch (error) {
            console.warn(`Failed to load prompt file: ${filePath}`, error);
            return undefined;
        }
    }

    async getAllPrompts(): Promise<string[]> {
        const promptsPath = await this.getPromptsPath();

        try {
            const files = await fs.readdir(promptsPath);
            return files.filter(f => f.endsWith('.md') || f.endsWith('.instructions.md'));
        } catch (error) {
            console.warn('Failed to read prompts directory', error);
            return [];
        }
    }

    clearCache(): void {
        this.promptCache.clear();
    }

    async getTaskInstructions(taskContent: string, mode: CodingMode): Promise<string> {
        const basePrompt = await this.getPromptForMode(mode);

        if (mode === 'spec') {
            return `${basePrompt}\n\n# Current Task\n\n${taskContent}\n\nPlease follow the requirements generation workflow as specified in the prompt.`;
        } else {
            return `${basePrompt}\n\n# Current Task\n\n${taskContent}\n\nPlease help implement this task using an iterative, exploratory approach.`;
        }
    }
}
