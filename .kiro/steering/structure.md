# Project Structure and Conventions

## Directory Organization

### Current Extension (Legacy - v1)
```
VSCodeExtension/
├── src/                          # Source code (TypeScript)
│   ├── extension.ts              # Main activation point
│   ├── chat/
│   │   └── chatParticipant.ts    # @kiro chat participant
│   ├── services/
│   │   ├── modeManager.ts        # Mode switching logic
│   │   ├── promptManager.ts      # Prompt file loading
│   │   └── setupService.ts       # Workspace setup
│   └── views/
│       ├── modeSelectorProvider.ts     # Mode selection UI
│       └── taskContextProvider.ts      # Task tree view
├── prompts/                      # Workflow instruction templates
│   ├── BASE_SYSTEM_PROMPT.instructions.md
│   ├── executeTask.prompt.md
│   ├── requirements.prompt.md
│   ├── design.prompt.md
│   ├── createTasks.prompt.md
│   ├── commit.prompt.md
│   ├── prReview.prompt.md
│   └── createHooks.prompt.md
├── resources/                    # Icons and assets
├── .kiro/                        # Kiro workspace data
│   ├── specs/                    # Feature specifications
│   │   └── [feature-name]/
│   │       ├── requirements.md
│   │       ├── design.md
│   │       └── tasks.md
│   ├── steering/                 # Project context (NEW)
│   │   ├── product.md
│   │   ├── tech.md
│   │   └── structure.md
│   └── settings/
│       └── mcp.json
├── mcp-server/                   # MCP server implementation
├── out/                          # Compiled JavaScript
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript config
└── [documentation files]
```

### Target Extension (Next Gen - v2)
```
VSCodeExtension-v2/              # NEW: Separate folder for v2
├── src/                         # Enhanced source code
│   ├── extension.ts             # Enhanced activation
│   ├── copilot/                 # Native Copilot integration
│   │   ├── chatIntegration.ts
│   │   ├── modeSelector.ts
│   │   └── progressIndicator.ts
│   ├── documents/               # Document enhancement
│   │   ├── specNavigator.ts
│   │   ├── documentDecorator.ts
│   │   └── taskContextMenu.ts
│   ├── services/                # Core services
│   │   ├── modeManager.ts
│   │   ├── promptOrchestrator.ts
│   │   ├── steeringManager.ts
│   │   └── specManager.ts
│   ├── workflows/               # Workflow orchestration
│   │   ├── vibeWorkflow.ts
│   │   └── specWorkflow.ts
│   └── views/                   # UI components
│       ├── specExplorer.ts
│       └── statusBar.ts
├── prompts/                     # Streamlined prompts
│   ├── vibe.prompt.md
│   ├── spec/
│   │   ├── requirements.prompt.md
│   │   ├── design.prompt.md
│   │   └── tasks.prompt.md
│   └── utilities/
│       ├── commit.prompt.md
│       └── prReview.prompt.md
├── resources/                   # Enhanced UI assets
└── [configuration files]
```

## Naming Conventions

### Files
- **TypeScript**: camelCase for files (e.g., `modeManager.ts`)
- **Markdown**: lowercase with hyphens for multi-word (e.g., `requirements.md`)
- **Prompts**: descriptive with `.prompt.md` suffix
- **Instructions**: `.instructions.md` for system-level prompts

### Code
- **Classes**: PascalCase (e.g., `ModeManager`, `PromptOrchestrator`)
- **Interfaces**: PascalCase with `I` prefix (e.g., `ISpecDocument`)
- **Functions**: camelCase (e.g., `executeTask`, `loadPrompt`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_MODE`, `MAX_SCAN_DEPTH`)
- **Private members**: underscore prefix (e.g., `_currentMode`)

### Commands
- Format: `kiro-copilot.<action>`
- Examples:
  - `kiro-copilot.switchToVibeMode`
  - `kiro-copilot.executeTaskFromFile`
  - `kiro-copilot.navigateToRequirements`

### Configuration Keys
- Format: `kiroCopilot.<setting>`
- Examples:
  - `kiroCopilot.mode`
  - `kiroCopilot.specsDirectory`
  - `kiroCopilot.promptsPath`

## File Content Conventions

### Spec Documents
- **requirements.md**: EARS syntax, user stories, acceptance criteria
- **design.md**: Architecture diagrams, technical decisions, implementation notes
- **tasks.md**: Numbered task list with checkboxes, linked to requirements

### Steering Documents
- **product.md**: Product vision, features, objectives, target users
- **tech.md**: Technology stack, tools, dependencies, architecture
- **structure.md**: Directory layout, naming conventions, patterns

### Prompt Files
- Clear section headers
- Explicit workflow steps
- CAPS for role definitions
- Examples where helpful
- Approval gates clearly marked

## Code Organization Patterns

### Services
- Single responsibility
- Dependency injection via constructor
- Public API methods
- Private implementation details
- Clear error handling

### Views
- Implement VS Code tree data provider interface
- Refresh on relevant events
- Handle user interactions
- Delegate business logic to services

### Workflows
- Orchestrate multi-step processes
- Manage state transitions
- Coordinate between services
- Provide progress feedback

## Extension Points

### Commands
- Registered in `package.json` contributes.commands
- Implemented in relevant service/view
- Available in command palette and context menus

### Views
- Defined in `package.json` contributes.views
- Custom tree data providers
- Activity bar containers

### Configuration
- Schema in `package.json` contributes.configuration
- Read via workspace configuration API
- Watch for changes and react accordingly

## Version Control

### Git Conventions
- Meaningful commit messages
- Feature branches for new work
- Main branch for stable releases
- Tag releases with semantic versioning

### Ignored Files
- `node_modules/`
- `out/`
- `.vscode/` (except shared settings)
- `*.vsix` (built extension packages)
- OS-specific files (`.DS_Store`, `Thumbs.db`)
