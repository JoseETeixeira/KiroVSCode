# Design Document

## Overview

This design outlines the implementation of a custom chat panel for the Kiro VS Code extension that provides a native, integrated chat experience similar to vscode-copilot-chat. The panel will feature mode selection, workflow visualization, and full agent capabilities for autonomous file operations. This replaces the current @kiro chat participant approach with a more powerful webview-based solution.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension Host                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌─────────────────────────┐  │
│  │  Chat Panel      │◄────────┤  Kiro Agent Service     │  │
│  │  (Webview)       │         │  - File Operations      │  │
│  │                  │         │  - Workflow Execution   │  │
│  │  - Message UI    │         │  - LLM Integration      │  │
│  │  - Mode Selector │         └──────────┬──────────────┘  │
│  │  - Code Blocks   │                    │                  │
│  │  - File Refs     │                    │                  │
│  └────────┬─────────┘                    │                  │
│           │                              │                  │
│           │         ┌────────────────────▼──────────────┐  │
│           └────────►│  Message Handler                  │  │
│                     │  - Parse user input               │  │
│                     │  - Route to workflows             │  │
│                     │  - Stream responses               │  │
│                     └────────────────┬──────────────────┘  │
│                                      │                      │
│           ┌──────────────────────────┴──────────────────┐  │
│           │                                              │  │
│  ┌────────▼────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Workflow        │  │ File Service │  │ Mode Manager│  │
│  │ Orchestrator    │  │              │  │             │  │
│  └─────────────────┘  └──────────────┘  └─────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Chat Panel Webview (Frontend)

-   **Technology**: HTML/CSS/JavaScript with VS Code Webview API
-   **Responsibilities**:
    -   Render chat messages with markdown support
    -   Display mode selector UI
    -   Handle user input and file references
    -   Show code blocks with syntax highlighting
    -   Display file operation notifications
    -   Render workflow progress indicators

#### 2. Chat Panel Provider (Backend)

-   **Technology**: TypeScript class extending VS Code WebviewViewProvider
-   **Responsibilities**:
    -   Manage webview lifecycle
    -   Handle message passing between webview and extension
    -   Coordinate with Kiro Agent Service
    -   Persist chat history
    -   Manage panel state

#### 3. Kiro Agent Service

-   **Technology**: TypeScript service class
-   **Responsibilities**:
    -   Execute file operations (create, read, update, delete)
    -   Integrate with language models (GitHub Copilot)
    -   Stream responses to chat panel
    -   Track operation history
    -   Handle errors and retries

#### 4. Message Handler

-   **Technology**: TypeScript service class
-   **Responsibilities**:
    -   Parse user messages for commands and file references
    -   Route messages to appropriate workflows
    -   Format responses for display
    -   Handle approval gates
    -   Manage conversation context

## Components and Interfaces

### ChatPanelProvider

```typescript
export class ChatPanelProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _messageHandler: MessageHandler;
    private _agentService: KiroAgentService;

    constructor(
        private extensionUri: vscode.Uri,
        private context: vscode.ExtensionContext,
        private modeManager: ModeManager,
        private workflowOrchestrator: WorkflowOrchestrator
    ) {
        this._messageHandler = new MessageHandler(
            this.modeManager,
            this.workflowOrchestrator
        );
        this._agentService = new KiroAgentService(context);
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void;
    sendMessage(message: ChatMessage): Promise<void>;
    streamResponse(text: string, isComplete: boolean): Promise<void>;
    updateMode(mode: CodingMode): Promise<void>;
    showFileOperation(operation: FileOperation): Promise<void>;
}
```

### KiroAgentService

```typescript
export interface FileOperation {
    type: "create" | "read" | "update" | "delete";
    path: string;
    content?: string;
    timestamp: Date;
    success: boolean;
    error?: string;
}

export class KiroAgentService {
    private operationHistory: FileOperation[] = [];

    constructor(private context: vscode.ExtensionContext) {}

    async createFile(path: string, content: string): Promise<FileOperation>;
    async readFile(path: string): Promise<string>;
    async updateFile(path: string, content: string): Promise<FileOperation>;
    async deleteFile(path: string): Promise<FileOperation>;
    async createDirectory(path: string): Promise<FileOperation>;

    getOperationHistory(): FileOperation[];
    clearHistory(): void;
}
```

### MessageHandler

```typescript
export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    fileReferences?: FileReference[];
    codeBlocks?: CodeBlock[];
    fileOperations?: FileOperation[];
}

export interface FileReference {
    path: string;
    type: "file" | "folder";
    exists: boolean;
}

export interface CodeBlock {
    language: string;
    code: string;
    filePath?: string;
}

export class MessageHandler {
    constructor(
        private modeManager: ModeManager,
        private workflowOrchestrator: WorkflowOrchestrator
    ) {}

    async handleUserMessage(
        message: string,
        chatHistory: ChatMessage[]
    ): Promise<AsyncIterableIterator<string>>;

    parseFileReferences(message: string): FileReference[];
    extractCodeBlocks(content: string): CodeBlock[];
    formatResponse(content: string): string;
}
```

### Webview Message Protocol

```typescript
// Messages from Webview to Extension
type WebviewToExtensionMessage =
    | { type: "userMessage"; content: string }
    | { type: "modeChange"; mode: CodingMode }
    | { type: "clearChat" }
    | { type: "stopGeneration" }
    | { type: "applyCode"; code: string; filePath?: string }
    | { type: "copyCode"; code: string }
    | { type: "insertCode"; code: string }
    | { type: "openFile"; path: string };

// Messages from Extension to Webview
type ExtensionToWebviewMessage =
    | { type: "addMessage"; message: ChatMessage }
    | { type: "streamChunk"; text: string }
    | { type: "streamComplete" }
    | { type: "modeUpdated"; mode: CodingMode }
    | { type: "fileOperation"; operation: FileOperation }
    | { type: "workflowProgress"; progress: WorkflowProgress }
    | { type: "error"; message: string }
    | { type: "clearMessages" };
```

## Data Models

### Chat Session

```typescript
export interface ChatSession {
    id: string;
    mode: CodingMode;
    messages: ChatMessage[];
    createdAt: Date;
    lastUpdated: Date;
    workflowState?: WorkflowState;
}
```

### Workflow State

```typescript
export interface WorkflowState {
    workflowName: string;
    currentStep: number;
    totalSteps: number;
    specName?: string;
    status: "in-progress" | "completed" | "failed" | "waiting-approval";
}
```

## User Interface Design

### Chat Panel Layout

````
┌─────────────────────────────────────────────────────────┐
│  Kiro Chat                                    [Mode: ▼] │ ← Header
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ User: Create a login form                      │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ Kiro: I'll help you create a login form.       │    │ ← Messages
│  │                                                 │    │
│  │ [File Operations]                              │    │
│  │  ✓ Created src/components/LoginForm.tsx       │    │
│  │  ✓ Updated src/App.tsx                         │    │
│  │                                                 │    │
│  │ ```typescript                                   │    │
│  │ export const LoginForm = () => { ... }         │    │
│  │ ```                                             │    │
│  │ [Copy] [Insert] [Apply to File]                │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  [Workflow: Requirements → Design → Tasks]              │ ← Progress
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 25%        │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  Type a message... #File #Folder                  [⏎]  │ ← Input
└─────────────────────────────────────────────────────────┘
````

### Mode Selector Dropdown

```
┌─────────────────────────────────────┐
│ Select Mode                         │
├─────────────────────────────────────┤
│ ● Vibe Coding                       │ ← Active
│   Chat first, then build            │
│                                     │
│ ○ Spec                              │
│   Plan first, then build            │
└─────────────────────────────────────┘
```

### File Operation Notification

```
┌─────────────────────────────────────────────┐
│ File Operations (3)                    [▼]  │
├─────────────────────────────────────────────┤
│ ✓ Created src/components/LoginForm.tsx     │
│   [Open File]                               │
│                                             │
│ ✓ Updated src/App.tsx                      │
│   [Open File] [View Diff]                  │
│                                             │
│ ✗ Failed to create src/utils/auth.ts      │
│   Error: Directory does not exist          │
└─────────────────────────────────────────────┘
```

## Error Handling

### File Operation Errors

1. **File Not Found**: Display error message with option to create file
2. **Permission Denied**: Show error and suggest checking file permissions
3. **Invalid Path**: Validate paths before operations and show helpful error
4. **Concurrent Modifications**: Detect conflicts and prompt user for resolution

### LLM Integration Errors

1. **Model Unavailable**: Fallback to alternative model or show error
2. **Rate Limiting**: Queue requests and show waiting indicator
3. **Timeout**: Cancel request after 30 seconds and allow retry
4. **Invalid Response**: Log error and show generic failure message

### Workflow Errors

1. **Missing Dependencies**: Check for required files before workflow steps
2. **Approval Timeout**: Auto-reject after 5 minutes of inactivity
3. **Step Failure**: Allow retry or skip to next step
4. **State Corruption**: Reset workflow and notify user

## Testing Strategy

### Unit Tests

1. **MessageHandler**

    - Test file reference parsing (#File, #Folder)
    - Test code block extraction
    - Test message formatting

2. **KiroAgentService**

    - Test file CRUD operations
    - Test operation history tracking
    - Test error handling for each operation type

3. **ChatPanelProvider**
    - Test message passing between webview and extension
    - Test state persistence
    - Test mode switching

### Integration Tests

1. **End-to-End Workflow**

    - Test complete Vibe mode workflow
    - Test complete Spec mode workflow (requirements → design → tasks)
    - Test mode switching mid-conversation

2. **File Operations**

    - Test creating files in nested directories
    - Test updating existing files
    - Test deleting files and cleanup

3. **UI Interactions**
    - Test code block actions (copy, insert, apply)
    - Test file reference autocomplete
    - Test workflow progress display

### Manual Testing

1. **Visual Design**

    - Test in light, dark, and high contrast themes
    - Test responsive layout with different panel sizes
    - Test markdown rendering quality

2. **User Experience**

    - Test conversation flow feels natural
    - Test mode switching is intuitive
    - Test file operations are clearly communicated

3. **Performance**
    - Test with large chat histories (100+ messages)
    - Test with many file operations (50+ files)
    - Test streaming response performance

## Implementation Phases

### Phase 1: Core Chat Panel (MVP)

-   Create ChatPanelProvider with basic webview
-   Implement message display (user and assistant)
-   Add basic markdown rendering
-   Implement message input field
-   Add mode selector UI
-   Connect to existing ModeManager

### Phase 2: Agent Capabilities

-   Implement KiroAgentService for file operations
-   Add file operation notifications in chat
-   Implement code block rendering with action buttons
-   Add file reference parsing (#File, #Folder)
-   Integrate with existing WorkflowOrchestrator

### Phase 3: Workflow Integration

-   Display workflow progress in chat panel
-   Implement approval gates in chat UI
-   Add workflow step indicators
-   Connect to existing SpecManager, SteeringManager, TaskManager
-   Implement workflow state persistence

### Phase 4: Advanced Features

-   Add file reference autocomplete
-   Implement chat history persistence
-   Add "Clear Chat" functionality
-   Implement stop generation button
-   Add keyboard shortcuts
-   Optimize streaming performance

### Phase 5: Polish and Testing

-   Implement comprehensive error handling
-   Add loading states and animations
-   Optimize for different themes
-   Write unit and integration tests
-   Conduct user testing and gather feedback
-   Performance optimization

## Technical Decisions

### Why Webview Instead of Chat Participant?

1. **Full UI Control**: Webviews allow complete customization of the chat interface
2. **Rich Interactions**: Can implement custom components like mode selector, progress bars
3. **Better File Operation Display**: Can show detailed file operation history with actions
4. **Workflow Visualization**: Can display workflow progress inline with chat
5. **Future Extensibility**: Easier to add features like diagrams, interactive forms

### Why Not Use Native Copilot Chat?

1. **Limited Customization**: Native chat doesn't support custom UI components
2. **No Mode Switching**: Can't add mode selector to native chat interface
3. **Limited File Operation Display**: Can't show rich file operation notifications
4. **Workflow Integration**: Difficult to integrate workflow progress indicators

### State Management

-   **Chat History**: Store in VS Code workspace state (persists across sessions)
-   **Workflow State**: Store in ModeManager (existing implementation)
-   **File Operations**: Store in memory (cleared on panel close)
-   **Mode Selection**: Store in VS Code configuration (existing implementation)

### Performance Considerations

1. **Message Virtualization**: Only render visible messages for large histories
2. **Lazy Loading**: Load chat history on demand
3. **Debounced Updates**: Batch multiple file operations into single UI update
4. **Streaming Optimization**: Use requestAnimationFrame for smooth text streaming
5. **Memory Management**: Clear old messages after threshold (e.g., 500 messages)

## Security Considerations

1. **File Operations**: Validate all file paths to prevent directory traversal
2. **Code Execution**: Never execute code automatically, always require user action
3. **Content Sanitization**: Sanitize markdown content to prevent XSS
4. **Workspace Boundaries**: Restrict file operations to workspace folder
5. **User Confirmation**: Require confirmation for destructive operations (delete)

## Accessibility

1. **Keyboard Navigation**: Full keyboard support for all interactions
2. **Screen Reader Support**: Proper ARIA labels and roles
3. **High Contrast**: Support for high contrast themes
4. **Focus Management**: Clear focus indicators and logical tab order
5. **Announcements**: Use ARIA live regions for dynamic content updates

## Migration Strategy

### Coexistence Period

1. Keep existing @kiro chat participant functional
2. Add new chat panel as alternative interface
3. Allow users to choose preferred interface
4. Gather feedback on both approaches

### Deprecation Plan

1. **Phase 1** (Weeks 1-2): Release chat panel as beta feature
2. **Phase 2** (Weeks 3-4): Promote chat panel as primary interface
3. **Phase 3** (Weeks 5-6): Add deprecation notice to @kiro participant
4. **Phase 4** (Week 7+): Remove @kiro participant, keep chat panel only

### Data Migration

-   Chat history from @kiro participant is not migrated (fresh start)
-   Workflow state is preserved (uses same ModeManager)
-   Mode selection is preserved (uses same configuration)
-   Spec files are unchanged (no migration needed)
