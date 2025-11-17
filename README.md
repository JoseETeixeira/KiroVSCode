# 🚀 Kiro-Style Copilot Extension

Bring Kiro IDE's powerful dual-mode workflow to Visual Studio Code and GitHub Copilot.

## ⚡ Quick Start

```powershell
# Automated setup
.\install.ps1

# Or manual
npm install
npm run compile
# Press F5 in VS Code
```

**→ Read [START_HERE.md](START_HERE.md) for your first steps**
**→ See [QUICKSTART.md](QUICKSTART.md) for a 5-minute tour**

## 🎯 Two Coding Modes

### Vibe Coding 🎯
**Chat first, then build.** Explore ideas and iterate as you discover needs.
- Rapid exploration and testing
- Perfect for prototyping and unclear requirements
- Quick implementation tasks

### Spec Mode 📋
**Plan first, then build.** Create requirements and design before coding.
- Structured feature development  
- Requirements using EARS syntax
- Approval-gated workflow with .kiro/steering/ integration

## ✨ Key Features

✅ **Automatic task detection** from tasks.md files
✅ **@kiro chat participant** with /vibe, /spec, /task commands
✅ **Custom prompt integration** from your prompts directory
✅ **Mode-specific workflows** for different development needs
✅ **Beautiful UI** with tree views and activity bar icon

## � Documentation

| Document | Purpose | Lines |
|----------|---------|-------|
| **[START_HERE.md](START_HERE.md)** | **First steps** | Quick |
| [QUICKSTART.md](QUICKSTART.md) | 5-minute tour | 70 |
| [USAGE_GUIDE.md](USAGE_GUIDE.md) | Complete manual | 380 |
| [SETUP.md](SETUP.md) | Dev setup | 145 |
| [FEATURES.md](FEATURES.md) | Feature summary | 115 |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Technical details | 350 |

## 💬 Using Chat

```
@kiro /vibe       # Switch to Vibe Coding mode
@kiro /spec       # Switch to Spec mode  
@kiro /task       # Start working on current task
@kiro Help me...  # Chat with mode context
```

## 📝 Tasks.md Example

```markdown
# Tasks

- [ ] 1. Build user authentication
- [ ] 2. Add product reviews
- [ ] 3. Implement search
```

Open this file → Kiro Assistant panel shows tasks → Click to start

## ⚙️ Configuration

Settings under `kiroCopilot.*`:
- `mode` - Current coding mode (vibe/spec)
- `promptsPath` - Custom prompts directory
- `autoDetectTasks` - Auto-detect tasks.md files

Default prompts location:
```
C:\Users\josee\AppData\Roaming\Code\User\prompts\
```

Running **Kiro: Setup Project** now always syncs the bundled `prompts/` directory into your workspace `.github` folder while preserving any existing files, so rerunning the command simply fills in missing templates. Delete `.github/prompts` if you ever need a clean refresh.

## 🎨 What You Get

✅ 571 lines of TypeScript code
✅ Complete UI with tree views and chat
✅ 7 comprehensive documentation files
✅ Example files and configurations
✅ Debug and build setup
✅ Professional icon and branding

## 🎓 Learning Path

1. **Day 1**: Install, try Vibe mode, create tasks.md
2. **Day 2**: Explore Spec mode, requirements generation
3. **Week 2+**: Custom prompts, steering files, advanced workflows

## 📦 Requirements

- Node.js v18+
- VS Code 1.85.0+
- GitHub Copilot (recommended)

## 🚀 Next Steps

1. Run `.\install.ps1` or `npm install && npm run compile`
2. Press **F5** to launch Extension Development Host
3. Create a **tasks.md** file in your test workspace
4. Open Command Palette → **"Kiro: Select Coding Mode"**
5. Click on a task in the **Kiro Assistant** panel

**You're ready to code in Kiro style!** 🎉

---

*See [PROJECT_COMPLETE.md](PROJECT_COMPLETE.md) for complete project overview*
