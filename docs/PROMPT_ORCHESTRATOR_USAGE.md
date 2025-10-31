# PromptOrchestrator Usage Guide

The `PromptOrchestrator` service enhances the existing `PromptManager` with workflow-aware prompt loading, template variable substitution, and sequence management for multi-step workflows.

## Features

### 1. Template Variable Substitution

The orchestrator supports `{{variableName}}` syntax in prompt files for dynamic content:

```typescript
// Create template context
const context = promptOrchestrator.createTemplateContext({
    specName: "user-authentication",
    taskNumber: 5,
    taskDescription: "Implement login endpoint",
    featureName: "auth-system",
});

// Load prompt with substitution
const prompt = await promptOrchestrator.loadPrompt(
    "executeTask.prompt.md",
    context
);
```

**Example prompt file:**

```markdown
# Task Execution for {{specName}}

You are implementing task #{{taskNumber}}: {{taskDescription}}

Please refer to the design document at `.kiro/specs/{{specName}}/design.md`
```

### 2. Workflow Sequence Loading

Load multiple prompts in sequence for complex workflows:

```typescript
// Load all prompts for a workflow step
const prompts = await promptOrchestrator.loadPromptSequence(
    "spec",
    "requirements",
    context
);

// Or load and combine them
const combined = await promptOrchestrator.loadStepPrompts(
    "spec",
    "design",
    context
);
```

### 3. Prompt Caching with File Modification Detection

The orchestrator leverages `PromptManager`'s caching system:

```typescript
// First load - reads from disk
const prompt1 = await promptOrchestrator.loadPrompt("design.prompt.md");

// Second load - uses cache (if file unchanged)
const prompt2 = await promptOrchestrator.loadPrompt("design.prompt.md");

// Clear cache when needed
promptOrchestrator.clearSequenceCache();
```

### 4. Workflow Validation

Validate that all required prompts exist before starting a workflow:

```typescript
const validation = await promptOrchestrator.validateWorkflowPrompts(
    "spec",
    "requirements"
);

if (!validation.valid) {
    console.error("Missing prompts:", validation.missing);
}
```

## Predefined Workflow Sequences

### Vibe Mode

1. `BASE_SYSTEM_PROMPT.instructions.md`
2. `executeTask.prompt.md`

### Spec Mode

**Requirements Step:**

1. `BASE_SYSTEM_PROMPT.instructions.md`
2. `requirements.prompt.md`

**Design Step:**

1. `BASE_SYSTEM_PROMPT.instructions.md`
2. `design.prompt.md`

**Create Tasks Step:**

1. `BASE_SYSTEM_PROMPT.instructions.md`
2. `createTasks.prompt.md`

**Execute Task Step:**

1. `BASE_SYSTEM_PROMPT.instructions.md`
2. `executeTask.prompt.md`

## Custom Sequences

Register custom prompt sequences for advanced workflows:

```typescript
promptOrchestrator.registerCustomSequence({
    mode: "spec",
    workflowName: "custom-review",
    prompts: [
        {
            id: "base",
            name: "Base System",
            promptFile: "BASE_SYSTEM_PROMPT.instructions.md",
            order: 1,
        },
        {
            id: "review",
            name: "Code Review",
            promptFile: "prReview.prompt.md",
            order: 2,
            variables: {
                reviewType: "security",
            },
        },
    ],
});
```

## Integration with WorkflowOrchestrator

The `WorkflowOrchestrator` automatically uses `PromptOrchestrator` for loading prompts with template context:

```typescript
// In WorkflowOrchestrator.executeStep()
const templateContext = this.promptOrchestrator.createTemplateContext({
    specName: this.workflowContext.specName,
    stepName: step.name,
});

const promptContent = await this.promptOrchestrator.loadPrompt(
    step.promptFile,
    templateContext
);
```

## Available Template Variables

-   `specName` - Name of the current spec
-   `taskNumber` - Task number being executed
-   `taskDescription` - Description of the task
-   `featureName` - Feature name (defaults to specName)
-   `stepName` - Current workflow step name
-   Custom variables via `additionalContext`

## Best Practices

1. **Use template variables** for dynamic content that changes per execution
2. **Validate workflows** before starting to catch missing prompts early
3. **Clear caches** when prompt files are modified during development
4. **Create custom sequences** for specialized workflows
5. **Keep prompts modular** - separate concerns into different files

## Example: Task Execution with Context

```typescript
const context = promptOrchestrator.createTemplateContext({
    specName: "payment-gateway",
    taskNumber: 12,
    taskDescription: "Implement Stripe webhook handler",
    additionalContext: {
        apiVersion: "2023-10-16",
        environment: "production",
    },
});

const instructions = await promptOrchestrator.loadTaskInstructions(
    "Implement webhook handler for payment.succeeded event",
    "spec",
    context
);
```

This will load the appropriate prompts and substitute all template variables, providing a fully contextualized prompt for the AI.
