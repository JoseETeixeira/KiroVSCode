# Development Setup Guide

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Visual Studio Code

## Installation

1. **Install dependencies:**

```powershell
npm install
```

2. **Compile the extension:**

```powershell
npm run compile
```

## Running the Extension

1. **Open in VS Code:**
   - Open this folder in VS Code
   - Press `F5` to start debugging
   - A new VS Code window will open with the extension loaded

2. **Test the extension:**
   - In the Extension Development Host window, use `Ctrl+Shift+P`
   - Type "Kiro" to see available commands
   - Try switching between Vibe and Spec modes

## Testing with tasks.md

Create a `tasks.md` file in your test workspace:

```markdown
# Tasks

- [ ] 1. Implement user authentication
- [ ] 2. Create product review system
- [x] 3. Add search functionality
```

When you open this file, the Task Context view will appear in the Kiro Assistant panel.

## Using Chat Participant

In any chat interface:

```
@kiro /vibe
@kiro /spec
@kiro /task
```

## Project Structure

```
VSCodeExtension/
├── src/
│   ├── extension.ts              # Main entry point
│   ├── services/
│   │   ├── modeManager.ts        # Manages vibe/spec modes
│   │   └── promptManager.ts      # Loads and manages prompts
│   ├── views/
│   │   ├── modeSelectorProvider.ts    # Mode selector tree view
│   │   └── taskContextProvider.ts     # Tasks.md context view
│   └── chat/
│       └── chatParticipant.ts    # Chat integration
├── resources/
│   └── kiro-icon.svg            # Extension icon
├── package.json                  # Extension manifest
└── tsconfig.json                # TypeScript config
```

## Key Features to Test

### 1. Mode Switching
- Command Palette: "Kiro: Select Coding Mode"
- Sidebar: Kiro Assistant panel
- Chat: `@kiro /vibe` or `@kiro /spec`

### 2. Task Detection
- Open a `tasks.md` file
- Task Context view shows available tasks
- Click on a task to start working on it

### 3. Prompt Integration
- Prompts are loaded from: `C:\Users\josee\AppData\Roaming\Code\User\prompts`
- Spec mode uses: `requirements.prompt.md`
- Vibe mode uses: `BASE_SYSTEM_PROMPT.instructions.md`

## Debugging

Enable detailed logging:

1. Open Extension Development Host
2. View → Output
3. Select "Kiro-Style Copilot" from dropdown

## Building for Production

```powershell
# Install vsce (once)
npm install -g @vscode/vsce

# Package the extension
vsce package
```

This creates a `.vsix` file you can install or distribute.

## Troubleshooting

### Extension not activating
- Check the Output panel for errors
- Ensure all dependencies are installed: `npm install`
- Rebuild: `npm run compile`

### Prompts not loading
- Verify the prompts path in settings
- Check file permissions
- Ensure prompt files exist at the configured location

### Tasks not detected
- Ensure file is named exactly `tasks.md`
- Check file format (markdown checkboxes or numbered lists)
- Refresh the Task Context view

## Next Steps

1. Customize the prompts in your prompts directory
2. Add custom steering files in `.kiro/steering/`
3. Create spec directories in `.kiro/specs/`
4. Test the requirements workflow with Spec mode
