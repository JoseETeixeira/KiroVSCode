# Testing Guide - Enhanced Task Management Features

## Quick Test Checklist

### 1. Task Categorization by Spec Folders

**Test**: Verify tasks are organized by spec folder

**Steps**:
1. Press F5 to launch Extension Development Host
2. Open the VSCodeExtension workspace in the new window
3. Click the Kiro Assistant icon in the activity bar
4. Expand "Task Context" view

**Expected Results**:
- ✓ See "Spec Folders" section
- ✓ See folders: "authentication" and "test-feature"
- ✓ See "Root Tasks" section (if tasks.md exists in root)
- ✓ Can expand folders to see individual tasks

### 2. Status Indicators

**Test**: Verify visual status indicators

**Steps**:
1. In Task Context view, expand "test-feature" folder
2. Observe task icons and labels

**Expected Results**:
- ✓ Pending tasks show gray circle (○)
- ✓ Completed tasks show green checkmark (✓)
- ✓ Failed tasks show red error icon (✗)
- ✓ Folder label shows count: "test-feature (2/5 ✓, 1 ✗)"

**Test Data** (`.kiro/specs/test-feature/tasks.md`):
```markdown
- [ ] Create basic component structure       → ○ pending
- [x] Set up configuration files             → ✓ completed
- [x] Write initial tests [failed]           → ✗ failed
- [ ] Add documentation                      → ○ pending
- [x] Deploy to staging                      → ✓ completed
```

### 3. Embedded Prompts

**Test**: Verify prompts load from extension

**Steps**:
1. Open Developer Console: Help → Toggle Developer Tools
2. Go to Console tab
3. Type: `console.log(vscode.extensions.getExtension('your-publisher-name.kiro-copilot-extension').extensionPath)`
4. Navigate to that path + `/prompts/`

**Expected Results**:
- ✓ Directory exists
- ✓ Contains all 8 prompt files:
  - BASE_SYSTEM_PROMPT.instructions.md
  - requirements.prompt.md
  - design.prompt.md
  - executeTask.prompt.md
  - commit.prompt.md
  - prReview.prompt.md
  - createHooks.prompt.md
  - createTasks.prompt.md

**Alternative Test**:
1. Delete/rename your user prompts folder temporarily
2. Extension should still work using embedded prompts

### 4. Mode-Based Chat Execution

**Test**: Verify @kiro applies mode-specific prompts

**Steps for Spec Mode**:
1. Open Command Palette (Ctrl+Shift+P)
2. Run "Kiro: Switch to Spec Mode"
3. Open GitHub Copilot Chat panel
4. Type: `@kiro help me plan a new feature`
5. Observe response

**Expected Results**:
- ✓ Response mentions "Spec mode active"
- ✓ Shows "Mode-specific prompt applied (Requirements workflow + Base instructions)"
- ✓ Offers to help with EARS syntax requirements

**Steps for Vibe Mode**:
1. Run "Kiro: Switch to Vibe Coding Mode"
2. In chat: `@kiro help me implement this`
3. Observe response

**Expected Results**:
- ✓ Response mentions "Vibe Coding mode active"
- ✓ Shows "Mode-specific prompt applied (Base instructions)"
- ✓ Suggests iterative, exploratory approach

### 5. Task Command with Mode Context

**Test**: Verify /task command loads mode prompts

**Steps**:
1. Switch to Spec mode
2. Open `.kiro/specs/test-feature/tasks.md`
3. In chat: `@kiro /task`

**Expected Results**:
- ✓ Shows "Starting task in **Spec** mode..."
- ✓ Mentions requirements specification process
- ✓ Lists 4-step workflow

**Steps for Vibe**:
1. Switch to Vibe mode
2. Same file open
3. In chat: `@kiro /task`

**Expected Results**:
- ✓ Shows "Starting task in **Vibe Coding** mode..."
- ✓ Mentions understanding requirements, exploring options, iterating

### 6. File Watcher Test

**Test**: Verify automatic refresh on task changes

**Steps**:
1. With Task Context view open
2. Edit `.kiro/specs/authentication/tasks.md`
3. Change a pending task to completed: `- [ ]` → `- [x]`
4. Save file
5. Observe Task Context view

**Expected Results**:
- ✓ View refreshes automatically
- ✓ Task icon updates from ○ to ✓
- ✓ Folder count updates

### 7. New Spec Folder Detection

**Test**: Verify new folders are detected

**Steps**:
1. Create new folder: `.kiro/specs/new-feature/`
2. Create file: `.kiro/specs/new-feature/tasks.md`
3. Add content:
   ```markdown
   - [ ] Task 1
   - [x] Task 2
   ```
4. Save file

**Expected Results**:
- ✓ "new-feature" folder appears in Task Context view
- ✓ Shows 2 tasks with correct statuses
- ✓ Shows count: "new-feature (1/2 ✓, 0 ✗)"

### 8. Backward Compatibility

**Test**: Verify root tasks.md still works

**Steps**:
1. Create `tasks.md` in workspace root (if doesn't exist)
2. Add tasks:
   ```markdown
   - [ ] Root level task 1
   - [x] Root level task 2
   ```

**Expected Results**:
- ✓ "Root Tasks" section appears in Task Context view
- ✓ Shows 2 tasks with correct statuses
- ✓ Can click to navigate to root tasks.md

## Common Issues

### Issue: Task Context view not showing
- **Solution**: Make sure a tasks.md file is open or exists in .kiro/specs/

### Issue: Prompts not loading
- **Solution**: Check extension compiled correctly (`npm run compile`)
- **Solution**: Verify prompts/ folder is in extension directory

### Issue: Status icons not showing colors
- **Solution**: Check VS Code theme supports ThemeColor API
- **Solution**: Try a different color theme

### Issue: File watcher not triggering
- **Solution**: Save the file (Ctrl+S)
- **Solution**: Close and reopen Task Context view

## Performance Notes

- Initial scan of .kiro/specs/ happens on activation
- Large number of spec folders (>50) may cause slight delay
- File watcher uses VS Code's efficient file system API
- Task parsing is done on-demand when expanding folders

## Success Criteria

All features working if:
- ✅ Tasks organized by spec folder
- ✅ Status indicators display correctly (○✓✗)
- ✅ Prompts load from extension's prompts/ folder
- ✅ @kiro chat shows mode-specific prompt application
- ✅ File changes trigger automatic refresh
- ✅ No console errors
- ✅ Compilation succeeds without errors
