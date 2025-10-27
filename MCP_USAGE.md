# Using Kiro with MCP Server

The Kiro MCP server allows you to use Kiro's mode-specific prompts directly in Copilot's native context.

## Automatic Setup

**The `@kiro` command now automatically sets everything up for you!**

Just use `@kiro your-command` and it will:
1. ✅ Build the MCP server if needed
2. ✅ Configure the MCP settings with absolute paths
3. ✅ Forward your command to Copilot with the appropriate MCP tool

## Usage

Simply use `@kiro` with your command:

```
@kiro execute task 12
@kiro implement the login feature
@kiro create requirements for user authentication
@kiro fix the bug in auth.ts
```

The `@kiro` command will:
- Check and build the MCP server if necessary
- Update your MCP configuration automatically
- Open Copilot with the correct MCP tool command
- The MCP server injects the mode-specific prompt (executeTask or requirements)
- Copilot executes in native context with full file editing capabilities

## How It Works Behind the Scenes

1. **You:** `@kiro implement feature X`
2. **@kiro:** Ensures MCP server is built and configured
3. **@kiro:** Opens Copilot with: `Use kiro_execute_task with command: "implement feature X"`
4. **Copilot:** Calls the MCP tool
5. **MCP Server:** Loads executeTask.prompt.md and injects it
6. **Copilot:** Executes with the full prompt in native context

## Available MCP Tools

The MCP server provides these tools that Copilot can use:

### `kiro_execute_task`
Execute tasks with the executeTask workflow (Vibe mode)
- Loads the full executeTask prompt
- Reads design.md, requirements.md, and .kiro/steering/
- Implements the task following the workflow

### `kiro_create_requirements`
Create requirements with the requirements workflow (Spec mode)
- Loads the requirements prompt
- Guides structured feature planning

### `kiro_set_mode`
Switch between vibe/spec modes

### `kiro_get_current_mode`
Check current mode

## Manual MCP Tool Usage

You can also directly use the MCP tools in Copilot without `@kiro`:

```
Use kiro_execute_task to execute task 12
Use kiro_create_requirements to create requirements for feature X
```

## Benefits

- ✅ **Automatic Setup**: No manual MCP configuration needed
- ✅ **Native Execution**: Copilot runs with full capabilities
- ✅ **Direct File Edits**: No clipboard tricks or workarounds
- ✅ **Auto-Approved**: Tools are pre-approved for seamless workflow
- ✅ **Workspace-Aware**: Uses absolute paths, works everywhere

## Troubleshooting

If you encounter issues:
1. Make sure you have a workspace folder open
2. Check the terminal output when `@kiro` builds the MCP server
3. Restart VS Code if the MCP server doesn't connect
4. Verify the MCP configuration at `%APPDATA%\Code\User\mcp.json`

## First Time Setup

The first time you use `@kiro` in a workspace:
1. It will build the MCP server (takes ~30 seconds)
2. It will update your global MCP configuration
3. You may need to restart VS Code
4. After that, it works seamlessly!
