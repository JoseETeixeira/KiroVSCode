# Implementation Plan

-   [x] 1. Set up core chat panel infrastructure

    -   Create ChatPanelProvider class implementing WebviewViewProvider
    -   Set up webview HTML/CSS/JS structure with VS Code theming
    -   Implement message passing protocol between webview and extension
    -   Register chat panel in package.json contributes.views
    -   _Requirements: 1.1, 1.2, 1.3_

-   [x] 2. Implement basic message display and input
-   [x] 2.1 Create message rendering system

    -   Build message list UI component in webview
    -   Implement user vs assistant message styling
    -   Add timestamp display for messages
    -   Implement auto-scroll to latest message
    -   _Requirements: 1.4, 1.5, 3.3_

-   [x] 2.2 Implement message input field

    -   Create input field component at bottom of panel
    -   Add send button with keyboard shortcut (Enter)
    -   Implement multi-line input support (Shift+Enter for new line)
    -   Add input validation and character limit
    -   _Requirements: 1.4_

-   [ ]\* 2.3 Write unit tests for message components

    -   Test message rendering with different content types
    -   Test input field validation
    -   Test keyboard shortcuts
    -   _Requirements: 1.4, 1.5_

-   [x] 3. Implement mode selector UI
-   [x] 3.1 Create mode selector component

    -   Build dropdown component in panel header
    -   Display current mode with icon (rocket for Vibe, notebook for Spec)
    -   Implement mode selection dropdown with descriptions
    -   Add visual indication of active mode
    -   _Requirements: 2.1, 2.2, 2.3, 2.5_

-   [x] 3.2 Connect mode selector to ModeManager

    -   Integrate with existing ModeManager service
    -   Handle mode change events from webview
    -   Update UI when mode changes externally
    -   Persist mode selection across sessions
    -   _Requirements: 2.4_

-   [ ]\* 3.3 Write unit tests for mode selector

    -   Test mode switching logic
    -   Test UI updates on mode change
    -   Test persistence across sessions
    -   _Requirements: 2.1, 2.2, 2.3, 2.4_

-   [x] 4. Implement markdown and code block rendering
-   [x] 4.1 Add markdown rendering support

    -   Integrate markdown-it library in webview
    -   Implement syntax highlighting for code blocks
    -   Add support for inline code, lists, headers
    -   Ensure proper theme adaptation (light/dark/high contrast)
    -   _Requirements: 3.4, 3.5_

-   [x] 4.2 Create code block action toolbar

    -   Build toolbar component above code blocks
    -   Implement "Copy" button with clipboard API
    -   Add "Insert at Cursor" button
    -   Add "Apply to File" button when file path is specified
    -   _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

-   [ ]\* 4.3 Write unit tests for markdown rendering

    -   Test various markdown formats
    -   Test code block extraction
    -   Test syntax highlighting
    -   _Requirements: 3.4, 3.5_

-   [x] 5. Implement KiroAgentService for file operations
-   [x] 5.1 Create KiroAgentService class

    -   Implement createFile method with directory creation
    -   Implement readFile method with error handling
    -   Implement updateFile method with backup
    -   Implement deleteFile method with confirmation
    -   Track operation history in memory
    -   _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

-   [x] 5.2 Add file operation error handling

    -   Handle file not found errors
    -   Handle permission denied errors
    -   Handle invalid path errors
    -   Implement retry logic for transient failures
    -   _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

-   [ ]\* 5.3 Write unit tests for KiroAgentService

    -   Test each CRUD operation
    -   Test error handling scenarios
    -   Test operation history tracking
    -   _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

-   [x] 6. Implement file operation notifications in chat
-   [x] 6.1 Create file operation notification component

    -   Build collapsible file operation section in messages
    -   Display operation type, file path, and status
    -   Add "Open File" button for created/modified files
    -   Show error messages for failed operations
    -   _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

-   [x] 6.2 Integrate file operations with message flow

    -   Send file operation events from extension to webview
    -   Group multiple operations into single notification
    -   Update notification UI in real-time as operations complete
    -   Add operation summary at end of agent response
    -   _Requirements: 5.1, 5.2, 5.4_

-   [ ]\* 6.3 Write integration tests for file operations

    -   Test file operation notification display
    -   Test operation grouping
    -   Test error display
    -   _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

-   [x] 7. Implement MessageHandler for routing and parsing
-   [x] 7.1 Create MessageHandler class

    -   Implement user message parsing
    -   Add file reference detection (#File, #Folder syntax)
    -   Implement code block extraction from responses
    -   Add response formatting logic
    -   _Requirements: 9.1, 9.2, 9.4_

-   [x] 7.2 Implement file reference autocomplete

    -   Build autocomplete dropdown in webview
    -   Trigger on # character input
    -   Query workspace files and folders
    -   Display results with icons and paths
    -   _Requirements: 9.3_

-   [x] 7.3 Add file reference chip display

    -   Render referenced files as clickable chips
    -   Add click handler to open files
    -   Show file existence status (exists/missing)
    -   _Requirements: 9.5_

-   [ ]\* 7.4 Write unit tests for MessageHandler

    -   Test file reference parsing
    -   Test code block extraction
    -   Test message formatting
    -   _Requirements: 9.1, 9.2, 9.4_

-   [x] 8. Integrate with WorkflowOrchestrator
-   [x] 8.1 Connect chat panel to workflow execution

    -   Route user messages through WorkflowOrchestrator
    -   Handle workflow start events
    -   Process workflow step completion events
    -   Handle workflow errors and cancellation
    -   _Requirements: 6.1, 6.2, 6.3_

-   [x] 8.2 Implement workflow progress display

    -   Create progress indicator component in chat
    -   Show current step and total steps
    -   Display step names and descriptions
    -   Update progress bar in real-time
    -   _Requirements: 6.4_

-   [x] 8.3 Implement approval gates in chat

    -   Display approval request messages
    -   Show approval options as buttons
    -   Handle user approval/rejection
    -   Continue workflow after approval
    -   _Requirements: 6.2, 6.3_

-   [x] 8.4 Add task completion tracking

    -   Update task checkboxes in tasks.md files
    -   Show task completion notifications
    -   Integrate with existing TaskCompletionTracker
    -   _Requirements: 6.5_

-   [ ]\* 8.5 Write integration tests for workflow integration

    -   Test workflow execution through chat
    -   Test progress display
    -   Test approval gates
    -   _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

-   [x] 9. Implement response streaming
-   [x] 9.1 Add streaming support to chat panel

    -   Implement incremental text display in webview
    -   Add auto-scroll during streaming
    -   Show typing indicator while streaming
    -   Display completion indicator when done
    -   _Requirements: 7.1, 7.2, 7.3_

-   [x] 9.2 Implement stop generation button

    -   Add stop button to chat input area
    -   Handle cancellation token in extension
    -   Display partial response with interruption indicator
    -   Clean up resources on cancellation
    -   _Requirements: 7.4, 7.5_

-   [ ]\* 9.3 Write unit tests for streaming

    -   Test incremental text display
    -   Test auto-scroll behavior
    -   Test cancellation handling
    -   _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

-   [x] 10. Implement chat history management
-   [x] 10.1 Add chat history persistence

    -   Store chat messages in workspace state
    -   Load chat history on panel open
    -   Implement message limit (500 messages)
    -   Add pagination for old messages
    -   _Requirements: 1.3_

-   [x] 10.2 Implement clear chat functionality

    -   Add "Clear Chat" button to panel toolbar
    -   Show confirmation dialog before clearing
    -   Clear messages from UI and storage
    -   Display welcome message after clearing
    -   Preserve mode selection after clearing
    -   _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

-   [ ]\* 10.3 Write unit tests for chat history

    -   Test persistence across sessions
    -   Test message limit enforcement
    -   Test clear chat functionality
    -   _Requirements: 1.3, 10.1, 10.2, 10.3, 10.4, 10.5_

-   [ ] 11. Implement theme support and styling
-   [ ] 11.1 Add VS Code theme integration

    -   Use VS Code CSS variables for colors
    -   Implement light theme styles
    -   Implement dark theme styles
    -   Implement high contrast theme styles
    -   _Requirements: 3.1, 3.2_

-   [ ] 11.2 Add responsive layout

    -   Implement flexible message layout
    -   Handle different panel widths
    -   Optimize for narrow panels
    -   Test with various panel sizes
    -   _Requirements: 3.1_

-   [ ]\* 11.3 Write visual regression tests

    -   Test appearance in each theme
    -   Test responsive layout
    -   Test component styling
    -   _Requirements: 3.1, 3.2_

-   [ ] 12. Add error handling and user feedback
-   [ ] 12.1 Implement error display in chat

    -   Show error messages with context
    -   Add retry buttons for recoverable errors
    -   Display helpful error messages
    -   Log errors to output channel
    -   _Requirements: 5.5_

-   [ ] 12.2 Add loading states

    -   Show loading indicator during LLM requests
    -   Display "thinking" animation
    -   Show progress for long operations
    -   Add timeout handling (30 seconds)
    -   _Requirements: 7.1_

-   [ ]\* 12.3 Write error handling tests

    -   Test error display
    -   Test retry logic
    -   Test timeout handling
    -   _Requirements: 5.5, 7.1_

-   [ ] 13. Implement accessibility features
-   [ ] 13.1 Add keyboard navigation

    -   Implement tab navigation for all interactive elements
    -   Add keyboard shortcuts (Ctrl+L to focus input)
    -   Support arrow keys for message navigation
    -   Add Escape key to close dropdowns
    -   _Requirements: 3.1_

-   [ ] 13.2 Add screen reader support

    -   Add ARIA labels to all components
    -   Implement ARIA live regions for dynamic content
    -   Add role attributes for semantic structure
    -   Test with screen readers (NVDA, JAWS)
    -   _Requirements: 3.1_

-   [ ]\* 13.3 Write accessibility tests

    -   Test keyboard navigation
    -   Test ARIA attributes
    -   Test screen reader announcements
    -   _Requirements: 3.1_

-   [ ] 14. Optimize performance
-   [ ] 14.1 Implement message virtualization

    -   Only render visible messages
    -   Implement virtual scrolling
    -   Lazy load old messages on scroll
    -   Optimize for large chat histories (100+ messages)
    -   _Requirements: 1.5_

-   [ ] 14.2 Optimize streaming performance

    -   Use requestAnimationFrame for smooth updates
    -   Batch multiple text chunks
    -   Debounce UI updates
    -   Measure and optimize frame rate
    -   _Requirements: 7.1_

-   [ ]\* 14.3 Write performance tests

    -   Test with large chat histories
    -   Test streaming performance
    -   Measure memory usage
    -   _Requirements: 1.5, 7.1_

-   [ ] 15. Integration and end-to-end testing
-   [ ] 15.1 Test complete Vibe mode workflow

    -   Test user message → agent response flow
    -   Test file operations in Vibe mode
    -   Test code generation and application
    -   Verify mode-specific behavior
    -   _Requirements: 1.1, 2.1, 4.1, 6.1_

-   [ ] 15.2 Test complete Spec mode workflow

    -   Test requirements phase with approval
    -   Test design phase with approval
    -   Test tasks phase with approval
    -   Verify workflow progress display
    -   _Requirements: 2.1, 6.1, 6.2, 6.3, 6.4_

-   [ ] 15.3 Test mode switching mid-conversation

    -   Switch from Vibe to Spec mode
    -   Switch from Spec to Vibe mode
    -   Verify chat history is preserved
    -   Verify workflow state is handled correctly
    -   _Requirements: 2.4, 10.4_

-   [ ]\* 15.4 Write end-to-end tests

    -   Automate complete workflow tests
    -   Test error scenarios
    -   Test edge cases
    -   _Requirements: 1.1, 2.1, 4.1, 6.1, 6.2, 6.3_

-   [ ] 16. Documentation and polish
-   [ ] 16.1 Add inline documentation

    -   Document all public APIs with JSDoc
    -   Add code comments for complex logic
    -   Create architecture diagram
    -   Document message protocol
    -   _Requirements: All_

-   [ ] 16.2 Create user documentation

    -   Write user guide for chat panel
    -   Document mode selection
    -   Document file operations
    -   Add troubleshooting section
    -   _Requirements: All_

-   [ ]\* 16.3 Create demo video

    -   Record demo of Vibe mode workflow
    -   Record demo of Spec mode workflow
    -   Show file operations in action
    -   Demonstrate mode switching
    -   _Requirements: All_

-   [ ] 17. Migration and deprecation
-   [ ] 17.1 Add feature flag for chat panel

    -   Create configuration option to enable/disable chat panel
    -   Default to enabled for new users
    -   Allow existing users to opt-in
    -   _Requirements: 1.1_

-   [ ] 17.2 Add deprecation notice to @kiro participant

    -   Show notice in chat participant responses
    -   Link to chat panel documentation
    -   Provide migration instructions
    -   _Requirements: 1.1_

-   [ ]\* 17.3 Plan @kiro participant removal
    -   Set deprecation timeline (6 weeks)
    -   Communicate to users
    -   Remove code after deprecation period
    -   _Requirements: 1.1_
