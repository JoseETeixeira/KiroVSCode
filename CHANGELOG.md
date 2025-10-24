# Changelog

All notable changes to the "Kiro-Style Copilot" extension will be documented in this file.

## [0.0.1] - 2025-10-24

### Initial Release

#### Features

##### Dual Coding Modes
- **Vibe Coding Mode** - Chat-first, iterative development approach
  - Rapid exploration and testing
  - Building when requirements are unclear
  - Quick task implementation
  
- **Spec Mode** - Requirements-first, structured development
  - Formal requirements generation using EARS syntax
  - Approval-gated workflow
  - Integration with project steering files

##### Task Detection and Context
- Automatic detection of `tasks.md` files
- Task Context view in Kiro Assistant panel
- Support for multiple task formats:
  - Markdown checkboxes `- [ ] task`
  - Numbered tasks `1. task`
  - Combined formats `- [ ] 1. task`
- One-click task initiation with mode-specific workflows

##### Chat Integration
- Custom chat participant `@kiro`
- Slash commands:
  - `/vibe` - Switch to Vibe Coding mode
  - `/spec` - Switch to Spec mode
  - `/task` - Start working on current task
- Mode-aware responses and suggestions
- Automatic prompt application based on selected mode

##### Prompt System
- Custom prompts directory support
- Default location: `C:\Users\josee\AppData\Roaming\Code\User\prompts`
- Mode-specific prompt loading:
  - Vibe mode: `BASE_SYSTEM_PROMPT.instructions.md`
  - Spec mode: `requirements.prompt.md` + base prompts
- Prompt caching for performance
- Support for custom prompt files

##### User Interface
- Activity bar icon and panel
- Mode Selector view showing:
  - Current mode with icon
  - Mode description
  - Mode benefits
  - Quick mode switching
- Task Context view (when tasks.md is open)
- Visual mode indicators throughout

##### Commands
- `Kiro: Select Coding Mode` - Interactive mode picker
- `Kiro: Switch to Vibe Coding Mode` - Direct mode switch
- `Kiro: Switch to Spec Mode` - Direct mode switch
- `Kiro: Start Task from Current File` - Begin task workflow

##### Configuration
- `kiroCopilot.mode` - Current coding mode (vibe/spec)
- `kiroCopilot.promptsPath` - Custom prompts directory path
- `kiroCopilot.autoDetectTasks` - Enable/disable automatic task detection

##### Spec Mode Workflow
- Automatic steering file detection in `.kiro/steering/`
- Requirements generation in `.kiro/specs/[feature-name]/`
- EARS syntax for acceptance criteria
- User Story format for requirements
- Iterative approval workflow
- Context-aware requirements generation

#### Development Features
- TypeScript support
- ESLint configuration
- Full source maps for debugging
- Comprehensive launch configurations
- Watch mode for development

#### Documentation
- README.md - Project overview
- SETUP.md - Development setup guide
- USAGE_GUIDE.md - Complete user documentation
- Example tasks.md file
- Inline code documentation

### Technical Details

#### Architecture
- Service-based architecture
  - ModeManager - Mode state and transitions
  - PromptManager - Prompt loading and caching
- Provider pattern for views
  - ModeSelectorProvider - Mode selection UI
  - TaskContextProvider - Task detection and display
- Chat participant for conversational interface

#### Dependencies
- VS Code Engine: ^1.85.0
- TypeScript: ^5.3.3
- markdown-it: ^14.0.0

#### File Structure
```
VSCodeExtension/
├── src/
│   ├── extension.ts              # Main entry point
│   ├── services/
│   │   ├── modeManager.ts        # Mode management
│   │   └── promptManager.ts      # Prompt handling
│   ├── views/
│   │   ├── modeSelectorProvider.ts    # Mode UI
│   │   └── taskContextProvider.ts     # Task UI
│   └── chat/
│       └── chatParticipant.ts    # Chat integration
├── resources/
│   └── kiro-icon.svg            # Extension icon
├── examples/
│   └── tasks.md                 # Example task file
└── [config files]
```

### Known Limitations

- Chat participant requires VS Code 1.85.0+
- Prompt files must be in Markdown format
- Task detection limited to `tasks.md` filename
- Steering files must be in `.kiro/steering/` directory

### Future Enhancements

Planned for future releases:
- Multi-file task support (tasks/*.md)
- Custom task templates
- Spec design phase automation
- Integration with version control
- Team collaboration features
- Metrics and analytics
- Additional prompt templates
- Customizable EARS templates
- AI-powered task suggestions
- Code generation from specs

---

## Version History

- **[0.0.1]** - 2025-10-24 - Initial release with dual modes, task detection, and chat integration
