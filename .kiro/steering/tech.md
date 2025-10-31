# Technology Stack

## Core Technologies

### VS Code Extension Development
- **TypeScript 5.3.3**: Main development language
- **VS Code API 1.85.0+**: Extension host APIs
- **Node.js 20.x**: Runtime environment

### VS Code Extension APIs Used

#### Current Implementation
- **Chat Participant API**: @kiro chat participant with commands
- **Tree View API**: Mode selector and task context views
- **Activity Bar API**: Custom Kiro icon and view container
- **Command API**: Mode switching and task execution commands
- **Configuration API**: Extension settings management
- **File System API**: tasks.md scanning and prompt loading
- **Webview API**: (future) Custom UI panels

#### Target Implementation (Next Gen)
- **Native Copilot Chat Extension**: Integration with vscode-copilot-chat
- **Language Model API**: Direct integration with GitHub Copilot models
- **Editor Decorations API**: Contextual buttons in document editors
- **Context Menu API**: Right-click task execution from tasks.md
- **Progress API**: Visual indicators for multi-step workflows
- **CodeLens API**: Inline actions for specs and tasks
- **Custom Editor API**: Enhanced spec document viewing

## Project Structure

### Current Architecture
```
src/
  extension.ts          # Extension activation and registration
  chat/
    chatParticipant.ts  # @kiro chat handler
  services/
    modeManager.ts      # Mode state management
    promptManager.ts    # Prompt loading and injection
    setupService.ts     # Workspace initialization
  views/
    modeSelectorProvider.ts    # Mode selection tree view
    taskContextProvider.ts     # Task display tree view
```

### Target Architecture (Next Gen - v2)
```
src-v2/                        # New version (separate folder)
  extension.ts                 # Enhanced activation
  copilot/
    chatIntegration.ts         # Native Copilot chat integration
    modeSelector.ts            # In-chat mode selection UI
    progressIndicator.ts       # Workflow progress display
  documents/
    specNavigator.ts           # Contextual spec navigation
    documentDecorator.ts       # Editor buttons for specs
    taskContextMenu.ts         # Right-click task execution
  services/
    modeManager.ts             # Enhanced mode orchestration
    promptOrchestrator.ts      # Workflow-based prompt execution
    steeringManager.ts         # Steering file management
    specManager.ts             # Spec lifecycle management
  workflows/
    vibeWorkflow.ts            # Vibe mode execution flow
    specWorkflow.ts            # Spec mode multi-stage flow
  views/
    specExplorer.ts            # Specs/steering/hooks tree view
    statusBar.ts               # Mode and progress indicators
```

## Dependencies

### Current Dependencies
- `markdown-it`: Markdown parsing for prompts and tasks
- VS Code types and extension utilities

### Planned Dependencies
- GitHub Copilot Chat Extension API (if available)
- Additional UI components for enhanced navigation
- State persistence libraries for workflow tracking

## Build & Development

### Tools
- **TypeScript Compiler**: Transpilation
- **ESLint**: Code quality
- **VS Code Extension Host**: Testing and debugging
- **npm scripts**: Build automation

### Configuration Files
- `tsconfig.json`: TypeScript compilation settings
- `.eslintrc.js`: Linting rules
- `package.json`: Extension manifest and dependencies
- `.vscodeignore`: Packaging exclusions

## Integration Points

### GitHub Copilot
- Language Model API for AI responses
- Chat interface integration
- Model selection (GPT-5, GPT-3.5-turbo)

### File System
- `.kiro/specs/`: Spec documents per feature
- `.kiro/steering/`: Project context files
- `prompts/`: Workflow instruction templates
- `tasks.md`: Task lists throughout workspace

## Performance Considerations

- Lazy loading of prompts and specs
- Efficient file system scanning with depth limits
- Debounced task.md change detection
- Minimal extension activation footprint
