# Steering File Integration in Spec Workflow

## Overview

Task 7 integrates steering file generation into the Spec workflow, ensuring that project context files are created and reviewed before proceeding with design and implementation.

## Implementation Details

### Workflow Integration

The steering check step has been enhanced in the Spec workflow (`src/workflows/workflowOrchestrator.ts`):

1. **Position**: Runs after requirements generation, before design
2. **Approval Required**: Yes - user must review and approve steering files
3. **Prompt File**: Uses `generateSteering.prompt.md` for AI-assisted content generation

### Key Features

#### 1. Automatic Detection

-   Checks for missing steering files (product.md, tech.md, structure.md)
-   Detects empty or incomplete steering files
-   Analyzes workspace for context (package.json, README.md, directory structure)

#### 2. User Review Flow

When steering files need attention, the workflow:

1. Creates files with default templates
2. Analyzes workspace for intelligent content generation
3. Prompts user with three options:
    - **Review Files**: Opens all steering files in split view for manual editing
    - **Generate Content**: Uses AI to create intelligent, context-aware content
    - **Continue**: Proceeds with current templates

#### 3. Workspace Analysis

The `SteeringManager` analyzes:

-   `package.json` for dependencies and project type
-   `README.md` for product description and features
-   Directory structure for architecture patterns
-   Configuration files for tech stack details

### New Commands

Three new commands have been added to `src/extension.ts`:

#### `kiro-copilot.reviewSteeringFiles`

-   Opens all foundation steering files in split view
-   Allows manual editing and customization
-   Shows confirmation message after opening

#### `kiro-copilot.generateSteeringFiles`

-   Analyzes workspace and creates steering files
-   Opens files for review
-   Offers to open chat for AI-assisted content generation

#### `kiro-copilot.validateSteeringFiles`

-   Checks if steering files have meaningful content
-   Reports issues (missing files, minimal content)
-   Offers to review or generate content if issues found

### SteeringManager Enhancements

New methods added to `src/services/steeringManager.ts`:

#### `openAllSteeringFilesForReview()`

-   Opens all foundation files in split view (3 columns)
-   Returns array of opened editors
-   Handles errors gracefully

#### `getSteeringFilesSummary()`

-   Returns formatted status of all steering files
-   Shows missing, empty, and existing files
-   Provides quick overview for users

#### `validateSteeringContent()`

-   Checks if files have more than just template headers
-   Counts meaningful lines (non-headers, non-placeholders)
-   Returns validation result with specific issues

### Workflow Step Configuration

```typescript
{
    id: "steering-check",
    name: "Steering Setup",
    description: "Check and generate steering files if needed",
    promptFile: "generateSteering.prompt.md",
    requiresApproval: true,
    onExecute: async (context) => {
        // Check for missing/empty files
        // Analyze workspace
        // Create files with templates
        // Store context for user review
    }
}
```

### Approval Gate Behavior

The `requestApprovalViaUI()` method provides special handling for steering-check:

1. **Detection**: Checks if step.id === "steering-check"
2. **Context**: Reads needsGeneration flag from workflow context
3. **User Prompt**: Shows modal dialog with three options
4. **Post-Action**: Waits for user confirmation after review/generation
5. **Cancellation**: Allows user to cancel workflow if needed

## User Experience Flow

### Scenario 1: Missing Steering Files

```
User starts Spec workflow
  ↓
Requirements step completes
  ↓
Steering check detects missing files
  ↓
Creates files with templates
  ↓
Shows modal: "Steering Setup Complete"
  ↓
User chooses "Generate Content"
  ↓
Opens chat with generation prompt
  ↓
AI analyzes workspace and generates content
  ↓
User reviews and saves changes
  ↓
Confirms "Yes, Continue"
  ↓
Workflow proceeds to Design step
```

### Scenario 2: Existing Steering Files

```
User starts Spec workflow
  ↓
Requirements step completes
  ↓
Steering check finds complete files
  ↓
Skips approval (no user interaction needed)
  ↓
Workflow proceeds to Design step
```

### Scenario 3: Empty Steering Files

```
User starts Spec workflow
  ↓
Requirements step completes
  ↓
Steering check detects empty files
  ↓
Regenerates with templates
  ↓
Shows modal: "Steering Setup Complete"
  ↓
User chooses "Review Files"
  ↓
Opens files in split view
  ↓
User edits manually
  ↓
Confirms "Yes, Continue"
  ↓
Workflow proceeds to Design step
```

## Integration with generateSteering.prompt.md

The prompt file (`prompts/generateSteering.prompt.md`) provides:

1. **Workspace Analysis Instructions**: How to analyze package.json, README, directory structure
2. **Generation Rules**: Be specific, ground in actual project, infer from context
3. **Templates**: Detailed templates for product.md, tech.md, structure.md
4. **Examples**: Real-world examples of good steering content
5. **Quality Checklist**: Verification steps before presenting to user

The workflow step loads this prompt when steering files need generation, providing the AI with comprehensive guidance.

## Benefits

1. **Zero Configuration**: Users don't need to manually create steering files
2. **Intelligent Defaults**: AI generates context-aware content based on workspace
3. **User Control**: Users can review, customize, or regenerate content
4. **Workflow Integration**: Seamlessly fits into Spec mode workflow
5. **Quality Assurance**: Validation ensures files have meaningful content

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

-   **11.1**: Automatic steering directory creation
-   **11.2**: Trigger generation if files missing or empty
-   **11.6**: Prompt user to review generated steering before continuing
-   **11.6**: Allow user to customize steering content

## Testing

To test the integration:

1. Start a new Spec workflow: `Cmd+Shift+P` → "Kiro: Start Workflow"
2. Complete requirements step
3. Observe steering check step behavior
4. Try each option: Review Files, Generate Content, Continue
5. Verify files are created in `.kiro/steering/`
6. Verify workflow continues to Design step after approval

## Future Enhancements

Potential improvements for future iterations:

1. **Incremental Updates**: Detect when steering files are outdated and offer to refresh
2. **Custom Templates**: Allow users to define their own steering file templates
3. **Multi-Language Support**: Generate steering files in different languages
4. **Version Control**: Track changes to steering files over time
5. **Team Sharing**: Share steering files across team members
