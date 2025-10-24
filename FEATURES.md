# Extension Features Summary

## 🎯 Core Functionality

### Dual Mode System
- **Vibe Coding Mode**: Rapid, iterative development
- **Spec Mode**: Requirements-driven, structured development
- Seamless mode switching via UI, commands, or chat

### Task Management
- Automatic `tasks.md` detection and parsing
- Context-aware task suggestions
- One-click task initiation with appropriate workflow
- Support for multiple task formats (checkboxes, numbered lists)

### Prompt Integration
- Custom prompts directory support
- Mode-specific prompt loading and caching
- Automatic application of appropriate prompts based on context
- Integration with `.kiro/steering/` files for project context

### Chat Participant
- `@kiro` participant in VS Code chat
- Slash commands: `/vibe`, `/spec`, `/task`
- Mode-aware responses and guidance
- Seamless integration with GitHub Copilot

## 📊 Architecture

### Services Layer
- **ModeManager**: Handles mode state and transitions
- **PromptManager**: Loads and caches prompt files

### Views Layer
- **ModeSelectorProvider**: Tree view for mode selection and info
- **TaskContextProvider**: Tree view for task detection and display

### Chat Layer
- **ChatParticipant**: Integrates with VS Code chat API

## 🔧 Technical Stack

- **Language**: TypeScript
- **Target**: VS Code 1.85.0+
- **Build**: TypeScript compiler with watch mode
- **Linting**: ESLint with TypeScript plugin

## 📁 Project Structure

```
VSCodeExtension/
├── src/                          # Source code
│   ├── extension.ts              # Entry point
│   ├── services/                 # Business logic
│   ├── views/                    # UI providers
│   └── chat/                     # Chat integration
├── resources/                    # Assets
├── examples/                     # Example files
├── .vscode/                      # VS Code config
├── package.json                  # Manifest
├── tsconfig.json                # TypeScript config
├── README.md                    # Overview
├── SETUP.md                     # Development guide
├── USAGE_GUIDE.md               # User documentation
├── QUICKSTART.md                # Quick start
└── CHANGELOG.md                 # Version history
```

## 🚀 Key Differentiators

1. **Kiro-Inspired Workflow**: Brings the best of Kiro IDE to VS Code
2. **Context-Aware**: Automatically adapts to tasks.md files
3. **Prompt-Driven**: Leverages custom prompts for guidance
4. **Mode-Specific Behavior**: Different workflows for different needs
5. **Approval-Gated**: Structured progression in Spec mode

## 📝 User Workflows

### Vibe Mode Workflow
```
Open tasks.md → Select task → Chat about implementation → 
Iterate quickly → Test and refine
```

### Spec Mode Workflow
```
Open tasks.md → Select task → Read steering files → 
Generate requirements → Get approval → Iterate on requirements → 
Proceed to design
```

## 🎨 UI Components

1. **Activity Bar Icon**: Access point to Kiro Assistant
2. **Mode Selector Panel**: Shows current mode and allows switching
3. **Task Context Panel**: Displays tasks when tasks.md is open
4. **Chat Integration**: `@kiro` participant with mode awareness

## ⚙️ Configuration

All settings under `kiroCopilot.*`:
- `mode`: Current coding mode
- `promptsPath`: Directory for custom prompts
- `autoDetectTasks`: Enable/disable task auto-detection

## 🔮 Future Enhancements

- Multi-file task support
- Custom task templates
- Design phase automation
- Team collaboration features
- Metrics and analytics
- AI-powered task suggestions
