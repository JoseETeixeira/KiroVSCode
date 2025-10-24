# Kiro-Style Copilot Extension - Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      VS Code Extension                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Activity   │    │   Command    │    │     Chat     │  │
│  │     Bar      │───▶│   Palette    │◀───│  Interface   │  │
│  │     Icon     │    │   Commands   │    │    @kiro     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │         │
│         └────────────────────┼────────────────────┘         │
│                              │                              │
│                              ▼                              │
│                    ┌──────────────────┐                     │
│                    │  Extension Core  │                     │
│                    │  (extension.ts)  │                     │
│                    └──────────────────┘                     │
│                              │                              │
│         ┌────────────────────┼────────────────────┐         │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌─────────────┐      ┌─────────────┐     ┌─────────────┐  │
│  │   Views     │      │  Services   │     │    Chat     │  │
│  ├─────────────┤      ├─────────────┤     ├─────────────┤  │
│  │ - Mode      │      │ - Mode      │     │ - Chat      │  │
│  │   Selector  │      │   Manager   │     │   Participant│ │
│  │ - Task      │      │ - Prompt    │     │ - Commands  │  │
│  │   Context   │      │   Manager   │     │ - Handlers  │  │
│  └─────────────┘      └─────────────┘     └─────────────┘  │
│         │                    │                    │         │
└─────────┼────────────────────┼────────────────────┼─────────┘
          │                    │                    │
          │                    ▼                    │
          │         ┌──────────────────┐            │
          │         │   File System    │            │
          │         ├──────────────────┤            │
          │         │ - tasks.md       │            │
          │         │ - prompts/*.md   │            │
          │         │ - .kiro/steering/│            │
          │         │ - .kiro/specs/   │            │
          │         └──────────────────┘            │
          │                    │                    │
          └────────────────────┴────────────────────┘
```

## Component Interaction Flow

### Vibe Mode Flow

```
User Action              Component              Process
──────────────────────────────────────────────────────────────

1. Select Vibe Mode
   │
   └──▶ Command Palette ──▶ ModeManager.setMode('vibe')
                              │
                              └──▶ Update config
                                    │
                                    └──▶ Refresh views

2. Open tasks.md
   │
   └──▶ Editor ──▶ TaskContextProvider.refresh()
                    │
                    └──▶ Parse tasks
                          │
                          └──▶ Display in tree view

3. Click task
   │
   └──▶ Tree View ──▶ startTaskFromFile()
                       │
                       └──▶ PromptManager.getPromptForMode('vibe')
                             │
                             └──▶ Load BASE_SYSTEM_PROMPT.instructions.md
                                   │
                                   └──▶ Open chat with prompt

4. Chat interaction
   │
   └──▶ @kiro ──▶ ChatParticipant.handleRequest()
                   │
                   └──▶ Apply Vibe-specific behavior
                         │
                         └──▶ Iterative, exploratory responses
```

### Spec Mode Flow

```
User Action              Component              Process
──────────────────────────────────────────────────────────────

1. Select Spec Mode
   │
   └──▶ Command Palette ──▶ ModeManager.setMode('spec')
                              │
                              └──▶ Update config
                                    │
                                    └──▶ Refresh views

2. Open tasks.md
   │
   └──▶ Editor ──▶ TaskContextProvider.refresh()
                    │
                    └──▶ Parse tasks
                          │
                          └──▶ Display with Spec mode indicator

3. Click task
   │
   └──▶ Tree View ──▶ startTaskFromFile()
                       │
                       └──▶ PromptManager.getPromptForMode('spec')
                             │
                             ├──▶ Load requirements.prompt.md
                             │
                             └──▶ Load BASE_SYSTEM_PROMPT.instructions.md
                                   │
                                   └──▶ Open chat with combined prompts

4. Chat interaction
   │
   └──▶ @kiro ──▶ ChatParticipant.handleRequest()
                   │
                   ├──▶ Read .kiro/steering/ files
                   │
                   ├──▶ Generate requirements.md
                   │
                   ├──▶ Request approval
                   │
                   └──▶ Iterate until approved
```

## Data Flow Diagram

```
┌─────────────────┐
│  User Settings  │
│   (config)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│  Mode Manager   │◀────▶│  Mode Selector   │
│                 │      │   (Tree View)    │
└────────┬────────┘      └──────────────────┘
         │
         │ mode
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Prompt Manager  │◀────▶│  File System     │
│                 │      │  - prompts/      │
└────────┬────────┘      │  - .kiro/        │
         │               └──────────────────┘
         │ prompts
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ Chat Participant│◀────▶│  VS Code Chat    │
│                 │      │     Interface    │
└────────┬────────┘      └──────────────────┘
         │
         │ responses
         │
         ▼
┌─────────────────┐
│      User       │
└─────────────────┘
```

## File System Structure

```
Workspace/
├── tasks.md                    # User's task file
│
├── .kiro/                      # Kiro configuration
│   ├── steering/               # Project context
│   │   ├── product.md         # Product vision
│   │   ├── tech.md            # Tech stack
│   │   └── personas.md        # User personas
│   │
│   └── specs/                  # Generated specs
│       └── feature-name/
│           ├── requirements.md # Auto-generated
│           └── design.md       # Future

User Prompts/
└── C:\Users\josee\AppData\Roaming\Code\User\prompts\
    ├── requirements.prompt.md           # Spec mode
    ├── BASE_SYSTEM_PROMPT.instructions.md # Base
    └── [custom].md                      # User-defined

Extension/
├── src/
│   ├── extension.ts            # Entry point
│   ├── services/
│   │   ├── modeManager.ts     # Mode state
│   │   └── promptManager.ts   # Prompt loading
│   ├── views/
│   │   ├── modeSelectorProvider.ts  # Mode UI
│   │   └── taskContextProvider.ts   # Task UI
│   └── chat/
│       └── chatParticipant.ts # Chat handler
└── resources/
    └── kiro-icon.svg          # Extension icon
```

## State Management

```
┌─────────────────────────────────────────────┐
│           Extension State                    │
├─────────────────────────────────────────────┤
│                                              │
│  Current Mode: 'vibe' | 'spec'              │
│  ├─ Stored in: VS Code settings             │
│  ├─ Managed by: ModeManager                 │
│  └─ Persists: Across sessions               │
│                                              │
│  Active Tasks: TaskItem[]                   │
│  ├─ Parsed from: tasks.md                   │
│  ├─ Managed by: TaskContextProvider         │
│  └─ Persists: Until file changes            │
│                                              │
│  Loaded Prompts: Map<string, string>        │
│  ├─ Cached in: PromptManager                │
│  ├─ Loaded from: Prompts directory          │
│  └─ Persists: Until cache cleared           │
│                                              │
└─────────────────────────────────────────────┘
```

## Event Flow

```
1. Extension Activation
   activation event
         │
         ▼
   activate(context)
         │
         ├──▶ Register ModeManager
         ├──▶ Register PromptManager
         ├──▶ Register ModeSelectorProvider
         ├──▶ Register TaskContextProvider
         ├──▶ Register ChatParticipant
         ├──▶ Register Commands
         └──▶ Show welcome message (first time)

2. File Open Event
   onDidChangeActiveTextEditor
         │
         ▼
   Check if tasks.md
         │
         ├──▶ Yes: TaskContextProvider.refresh()
         │          │
         │          └──▶ Parse and display tasks
         │
         └──▶ No: Hide task context view

3. Mode Change Event
   User clicks mode switch
         │
         ▼
   ModeManager.setMode(newMode)
         │
         ├──▶ Update VS Code config
         ├──▶ Fire onDidChangeTreeData
         │     │
         │     └──▶ Refresh all views
         │
         └──▶ Show notification

4. Task Click Event
   User clicks task in tree
         │
         ▼
   startTaskFromFile(taskItem)
         │
         ├──▶ Get current mode
         ├──▶ Load appropriate prompts
         └──▶ Open chat with context
```

## Key Design Patterns

### 1. Service Pattern
```
ModeManager, PromptManager
- Stateful services
- Dependency injection
- Single responsibility
```

### 2. Provider Pattern
```
ModeSelectorProvider, TaskContextProvider
- Implement TreeDataProvider
- Data binding to UI
- Event-driven updates
```

### 3. Observer Pattern
```
Event emitters for data changes
- onDidChangeTreeData
- Configuration changes
- File system events
```

### 4. Strategy Pattern
```
Mode-specific behavior
- Vibe mode strategy
- Spec mode strategy
- Prompt loading strategy
```

## Extension Points

Users can extend the system by:

1. **Custom Prompts**
   - Add files to prompts directory
   - Reference in mode configurations

2. **Steering Files**
   - Create .kiro/steering/*.md
   - Automatically read in Spec mode

3. **Task Formats**
   - Checkbox: `- [ ] task`
   - Numbered: `1. task`
   - Combined formats supported

4. **Configuration**
   - kiroCopilot.mode
   - kiroCopilot.promptsPath
   - kiroCopilot.autoDetectTasks

---

This architecture provides:
✅ Clear separation of concerns
✅ Easy testability
✅ Extensibility
✅ Type safety with TypeScript
✅ VS Code best practices
