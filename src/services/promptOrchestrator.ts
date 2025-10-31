import * as path from "path";
import { PromptManager } from "./promptManager";
import { CodingMode } from "./modeManager";

/**
 * Represents a prompt in a workflow sequence
 */
export interface PromptSequenceItem {
    id: string;
    name: string;
    promptFile: string;
    order: number;
    variables?: Record<string, string>;
}

/**
 * Represents a complete prompt sequence for a workflow
 */
export interface PromptSequence {
    mode: CodingMode;
    workflowName: string;
    prompts: PromptSequenceItem[];
}

/**
 * Template variable context for substitution
 */
export interface TemplateContext {
    specName?: string;
    taskNumber?: string;
    taskDescription?: string;
    featureName?: string;
    stepName?: string;
    [key: string]: string | undefined;
}

/**
 * PromptOrchestrator enhances PromptManager with workflow-aware prompt loading,
 * template variable substitution, and sequence management for multi-step workflows.
 */
export class PromptOrchestrator {
    private sequenceCache: Map<string, PromptSequence> = new Map();

    constructor(private promptManager: PromptManager) {}

    /**
     * Load a single prompt with template variable substitution
     */
    async loadPrompt(
        promptFile: string,
        context?: TemplateContext
    ): Promise<string> {
        const promptsPath = await this.promptManager.getPromptsPath();
        const filePath = path.join(promptsPath, promptFile);

        // Load prompt content using PromptManager (with caching)
        const content = await this.promptManager.loadPromptFile(filePath);

        if (!content) {
            throw new Error(`Failed to load prompt file: ${promptFile}`);
        }

        // Apply template variable substitution if context provided
        if (context) {
            return this.substituteVariables(content, context);
        }

        return content;
    }

    /**
     * Load a sequence of prompts for a workflow
     */
    async loadPromptSequence(
        mode: CodingMode,
        workflowName: string,
        context?: TemplateContext
    ): Promise<string[]> {
        const sequence = this.getPromptSequenceForWorkflow(mode, workflowName);
        const loadedPrompts: string[] = [];

        console.log(
            `[PromptOrchestrator] Loading ${sequence.prompts.length} prompts for ${workflowName}`
        );

        for (const item of sequence.prompts) {
            try {
                // Merge item-specific variables with context
                const mergedContext = {
                    ...context,
                    ...item.variables,
                };

                const content = await this.loadPrompt(
                    item.promptFile,
                    mergedContext
                );
                loadedPrompts.push(content);

                console.log(
                    `[PromptOrchestrator] Loaded prompt ${item.order}: ${item.name}`
                );
            } catch (error) {
                console.error(
                    `[PromptOrchestrator] Failed to load prompt ${item.name}:`,
                    error
                );
                throw error;
            }
        }

        return loadedPrompts;
    }

    /**
     * Load and combine prompts for a specific workflow step
     */
    async loadStepPrompts(
        mode: CodingMode,
        stepName: string,
        context?: TemplateContext
    ): Promise<string> {
        // Load all prompts in sequence
        const prompts = await this.loadPromptSequence(mode, stepName, context);

        // Combine prompts with separators
        return prompts.join("\n\n---\n\n");
    }

    /**
     * Substitute template variables in prompt content
     * Supports {{variableName}} syntax
     */
    private substituteVariables(
        content: string,
        context: TemplateContext
    ): string {
        let result = content;

        // Replace all {{variableName}} patterns
        const variablePattern = /\{\{(\w+)\}\}/g;

        result = result.replace(variablePattern, (match, variableName) => {
            const value = context[variableName];

            if (value !== undefined) {
                console.log(
                    `[PromptOrchestrator] Substituted {{${variableName}}} with "${value}"`
                );
                return value;
            }

            // Keep original placeholder if variable not found
            console.warn(
                `[PromptOrchestrator] Variable {{${variableName}}} not found in context`
            );
            return match;
        });

        return result;
    }

    /**
     * Get prompt sequence definition for a workflow
     */
    private getPromptSequenceForWorkflow(
        mode: CodingMode,
        workflowName: string
    ): PromptSequence {
        const cacheKey = `${mode}-${workflowName}`;

        // Check cache
        if (this.sequenceCache.has(cacheKey)) {
            return this.sequenceCache.get(cacheKey)!;
        }

        // Define sequences based on mode and workflow
        let sequence: PromptSequence;

        if (mode === "vibe") {
            sequence = this.getVibeSequence(workflowName);
        } else {
            sequence = this.getSpecSequence(workflowName);
        }

        // Cache the sequence
        this.sequenceCache.set(cacheKey, sequence);

        return sequence;
    }

    /**
     * Get Vibe mode prompt sequence
     */
    private getVibeSequence(workflowName: string): PromptSequence {
        return {
            mode: "vibe",
            workflowName,
            prompts: [
                {
                    id: "base-system",
                    name: "Base System Prompt",
                    promptFile: "BASE_SYSTEM_PROMPT.instructions.md",
                    order: 1,
                },
                {
                    id: "execute-task",
                    name: "Execute Task",
                    promptFile: "executeTask.prompt.md",
                    order: 2,
                },
            ],
        };
    }

    /**
     * Get Spec mode prompt sequence based on workflow step
     */
    private getSpecSequence(workflowName: string): PromptSequence {
        // Map workflow names to their prompt sequences
        const sequences: Record<string, PromptSequenceItem[]> = {
            requirements: [
                {
                    id: "base-system",
                    name: "Base System Prompt",
                    promptFile: "BASE_SYSTEM_PROMPT.instructions.md",
                    order: 1,
                },
                {
                    id: "requirements",
                    name: "Requirements Generation",
                    promptFile: "requirements.prompt.md",
                    order: 2,
                },
            ],
            design: [
                {
                    id: "base-system",
                    name: "Base System Prompt",
                    promptFile: "BASE_SYSTEM_PROMPT.instructions.md",
                    order: 1,
                },
                {
                    id: "design",
                    name: "Design Document",
                    promptFile: "design.prompt.md",
                    order: 2,
                },
            ],
            "create-tasks": [
                {
                    id: "base-system",
                    name: "Base System Prompt",
                    promptFile: "BASE_SYSTEM_PROMPT.instructions.md",
                    order: 1,
                },
                {
                    id: "create-tasks",
                    name: "Create Tasks",
                    promptFile: "createTasks.prompt.md",
                    order: 2,
                },
            ],
            "execute-task": [
                {
                    id: "base-system",
                    name: "Base System Prompt",
                    promptFile: "BASE_SYSTEM_PROMPT.instructions.md",
                    order: 1,
                },
                {
                    id: "execute-task",
                    name: "Execute Task",
                    promptFile: "executeTask.prompt.md",
                    order: 2,
                },
            ],
        };

        const prompts = sequences[workflowName] || sequences["execute-task"];

        return {
            mode: "spec",
            workflowName,
            prompts,
        };
    }

    /**
     * Load prompts for a specific mode with context
     */
    async loadModePrompts(
        mode: CodingMode,
        context?: TemplateContext
    ): Promise<string> {
        // Use existing PromptManager method for backward compatibility
        const basePrompt = await this.promptManager.getPromptForMode(mode);

        // Apply template substitution if context provided
        if (context) {
            return this.substituteVariables(basePrompt, context);
        }

        return basePrompt;
    }

    /**
     * Load task-specific instructions with context
     */
    async loadTaskInstructions(
        taskContent: string,
        mode: CodingMode,
        context?: TemplateContext
    ): Promise<string> {
        const basePrompt = await this.loadModePrompts(mode, context);

        const taskSection = `\n\n# Current Task\n\n${taskContent}`;

        if (mode === "spec") {
            return `${basePrompt}${taskSection}\n\nPlease follow the requirements generation workflow as specified in the prompt.`;
        } else {
            return `${basePrompt}${taskSection}\n\nPlease help implement this task using an iterative, exploratory approach.`;
        }
    }

    /**
     * Clear sequence cache (useful when prompts are modified)
     */
    clearSequenceCache(): void {
        this.sequenceCache.clear();
        console.log("[PromptOrchestrator] Sequence cache cleared");
    }

    /**
     * Get available prompt files
     */
    async getAvailablePrompts(): Promise<string[]> {
        return await this.promptManager.getAllPrompts();
    }

    /**
     * Validate that all required prompts exist for a workflow
     */
    async validateWorkflowPrompts(
        mode: CodingMode,
        workflowName: string
    ): Promise<{ valid: boolean; missing: string[] }> {
        const sequence = this.getPromptSequenceForWorkflow(mode, workflowName);
        const missing: string[] = [];

        for (const item of sequence.prompts) {
            try {
                const promptsPath = await this.promptManager.getPromptsPath();
                const filePath = path.join(promptsPath, item.promptFile);
                const content = await this.promptManager.loadPromptFile(
                    filePath
                );

                if (!content) {
                    missing.push(item.promptFile);
                }
            } catch (error) {
                missing.push(item.promptFile);
            }
        }

        return {
            valid: missing.length === 0,
            missing,
        };
    }

    /**
     * Create a custom prompt sequence for advanced workflows
     */
    registerCustomSequence(sequence: PromptSequence): void {
        const cacheKey = `${sequence.mode}-${sequence.workflowName}`;
        this.sequenceCache.set(cacheKey, sequence);

        console.log(
            `[PromptOrchestrator] Registered custom sequence: ${sequence.workflowName}`
        );
    }

    /**
     * Get template context from spec and task information
     */
    createTemplateContext(params: {
        specName?: string;
        taskNumber?: number;
        taskDescription?: string;
        featureName?: string;
        stepName?: string;
        additionalContext?: Record<string, string>;
    }): TemplateContext {
        return {
            specName: params.specName,
            taskNumber: params.taskNumber?.toString(),
            taskDescription: params.taskDescription,
            featureName: params.featureName || params.specName,
            stepName: params.stepName,
            ...params.additionalContext,
        };
    }
}
