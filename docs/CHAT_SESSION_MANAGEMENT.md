# Chat Session Management

## Overview

The Chat Session Manager provides persistent session tracking for chat interactions with workflow state management. This enables:

-   **Session Persistence**: Chat sessions survive VS Code restarts
-   **Workflow State Tracking**: Active workflows are tracked per session
-   **Conversation History**: Message history is maintained for context
-   **Multiple Concurrent Sessions**: Support for multiple active chat sessions
-   **Automatic Cleanup**: Old and completed sessions are automatically cleaned up

## Architecture

### ChatSessionManager

The `ChatSessionManager` service manages the lifecycle of chat sessions:

```typescript
interface ChatSession {
    id: string;
    mode: CodingMode;
    workflowName?: string;
    workflowContext?: WorkflowContext;
    currentStep?: number;
    totalSteps?: number;
    specName?: string;
    startedAt: Date;
    lastActivity: Date;
    isActive: boolean;
    conversationHistory: ChatMessage[];
}
```

### Key Features

#### 1. Session Creation and Activation

Sessions are automatically created when a user starts a chat interaction:

```typescript
const session = sessionManager.getOrCreateActiveSession(mode, specName);
```

#### 2. Workflow State Tracking

When a workflow starts, the session is updated with workflow information:

```typescript
sessionManager.updateSessionWorkflow(
    sessionId,
    workflowName,
    workflowContext,
    currentStep,
    totalSteps
);
```

#### 3. Conversation History

All messages are tracked in the session:

```typescript
sessionManager.addMessage(sessionId, "user", userMessage);
sessionManager.addMessage(sessionId, "assistant", assistantResponse);
```

#### 4. Session Persistence

Sessions are automatically persisted to VS Code's workspace state using the Memento API:

-   Sessions survive VS Code restarts
-   Workflow state is restored on activation
-   Conversation history is preserved

#### 5. Automatic Cleanup

The session manager automatically cleans up:

-   Inactive sessions older than 24 hours
-   Excess sessions beyond the maximum limit (10 sessions)
-   Completed sessions after a timeout period

## Usage

### Commands

#### View Chat Sessions

```
Kiro: View Chat Sessions
```

Shows all chat sessions with options to:

-   Set as active
-   View conversation history
-   Restore workflow state
-   Complete session
-   Delete session

#### Cleanup Old Sessions

```
Kiro: Cleanup Old Chat Sessions
```

Manually triggers cleanup of old and completed sessions.

#### Complete Current Session

```
Kiro: Complete Current Chat Session
```

Marks the current active session as completed.

### Programmatic Usage

#### Creating a Session

```typescript
const sessionManager = new ChatSessionManager(context);
const session = sessionManager.createSession("vibe", "my-feature");
```

#### Updating Workflow State

```typescript
sessionManager.updateSessionWorkflow(
    session.id,
    "Spec Mode",
    workflowContext,
    2, // current step
    5 // total steps
);
```

#### Adding Messages

```typescript
sessionManager.addMessage(session.id, "user", "Implement authentication");
sessionManager.addMessage(
    session.id,
    "assistant",
    "Starting implementation..."
);
```

#### Restoring Workflow

```typescript
const workflowState = sessionManager.restoreWorkflowState(sessionId);
if (workflowState) {
    await workflowOrchestrator.resumeWorkflow();
}
```

## Integration with Workflow Orchestrator

The `WorkflowOrchestrator` is integrated with session management:

1. **Workflow Start**: Session ID is passed when starting a workflow
2. **Progress Updates**: Workflow progress is tracked in the session
3. **Workflow Completion**: Session is marked as complete when workflow finishes
4. **Workflow Cancellation**: Session state is cleared when workflow is cancelled

### Example Flow

```typescript
// 1. User starts chat
const session = sessionManager.getOrCreateActiveSession(mode);

// 2. User message is added to history
sessionManager.addMessage(session.id, "user", request.prompt);

// 3. Workflow starts with session tracking
await workflowOrchestrator.startWorkflow(
    mode,
    request.prompt,
    specName,
    session.id
);

// 4. Assistant response is added to history
sessionManager.addMessage(session.id, "assistant", response);

// 5. On VS Code restart, workflow can be restored
const restored = await chatParticipant.restoreSessionWorkflow(session.id);
```

## Configuration

### Session Limits

-   **Maximum Sessions**: 10 concurrent sessions
-   **Session Timeout**: 24 hours for inactive sessions
-   **History Limit**: 50 messages per session

These limits can be adjusted in `ChatSessionManager`:

```typescript
private static readonly MAX_SESSIONS = 10;
private static readonly SESSION_TIMEOUT_HOURS = 24;
```

## Storage

Sessions are stored in VS Code's workspace state under the key `kiro.chatSessions`:

```typescript
interface SessionStorageData {
    sessions: Record<string, SerializedChatSession>;
    activeSessionId?: string;
}
```

### Serialization

Sessions are serialized for storage with:

-   Dates converted to ISO strings
-   Maps converted to arrays of entries
-   All data structures flattened for JSON storage

## Best Practices

### 1. Session Lifecycle

-   Create sessions at the start of chat interactions
-   Update session state as workflow progresses
-   Complete sessions when workflows finish
-   Clean up old sessions periodically

### 2. Workflow Integration

-   Always pass session ID when starting workflows
-   Update session workflow state at each step
-   Restore workflow state on VS Code restart
-   Clear session state when workflows are cancelled

### 3. Message History

-   Add all user and assistant messages to history
-   Limit history size to prevent memory issues
-   Use history for context in multi-turn conversations

### 4. Error Handling

-   Handle missing sessions gracefully
-   Validate session state before restoration
-   Log errors for debugging
-   Provide user feedback for failures

## Troubleshooting

### Session Not Found

If a session is not found:

1. Check if the session was cleaned up due to inactivity
2. Verify the session ID is correct
3. Check workspace state for corruption

### Workflow Not Restoring

If workflow restoration fails:

1. Verify the workflow state is complete in the session
2. Check if the workflow orchestrator is initialized
3. Ensure the mode matches the session mode

### Memory Issues

If experiencing memory issues:

1. Reduce `MAX_SESSIONS` limit
2. Decrease `SESSION_TIMEOUT_HOURS`
3. Limit conversation history size
4. Run manual cleanup more frequently

## Future Enhancements

Potential improvements for session management:

1. **Session Export/Import**: Allow users to export and import sessions
2. **Session Search**: Search through conversation history
3. **Session Tags**: Tag sessions for organization
4. **Session Analytics**: Track session metrics and usage patterns
5. **Session Sharing**: Share sessions between team members
6. **Session Branching**: Create branches from existing sessions
7. **Session Merging**: Merge multiple sessions together

## Related Documentation

-   [Workflow Orchestration](./WORKFLOW_ORCHESTRATOR_USAGE.md)
-   [Task Completion Tracking](./TASK_COMPLETION_TRACKING.md)
-   [Chat Participant](../src/chat/chatParticipant.ts)
