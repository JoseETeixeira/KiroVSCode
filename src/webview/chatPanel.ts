// This file will be compiled and loaded by the webview
// It runs in the webview context, not the extension context

// Import markdown-it for markdown rendering
import MarkdownIt from "markdown-it";

declare const acquireVsCodeApi: () => {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

// Initialize markdown-it with syntax highlighting
const md = new MarkdownIt({
    html: false, // Disable HTML tags for security
    linkify: true, // Auto-convert URLs to links
    typographer: true, // Enable smart quotes and other typographic replacements
    breaks: false, // Don't convert \n to <br>
    highlight: (str: string, lang: string) => {
        // Use VS Code's built-in syntax highlighting classes
        if (lang) {
            return `<pre class="code-block" data-language="${escapeHtml(
                lang
            )}"><code class="language-${escapeHtml(lang)}">${escapeHtml(
                str
            )}</code></pre>`;
        }
        return `<pre class="code-block"><code>${escapeHtml(str)}</code></pre>`;
    },
});

// Helper function to escape HTML
function escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

interface FileReference {
    path: string;
    type: "file" | "folder";
    exists: boolean;
}

interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    fileReferences?: FileReference[];
    fileOperations?: FileOperation[];
}

interface FileOperation {
    type: "create" | "read" | "update" | "delete" | "createDirectory";
    path: string;
    content?: string;
    timestamp: Date;
    success: boolean;
    error?: string;
}

interface WorkflowProgress {
    workflowName: string;
    currentStep: number;
    totalSteps: number;
    currentStepName: string;
    status: "in-progress" | "completed" | "failed" | "waiting-approval";
    message?: string;
}

interface ApprovalRequest {
    id: string;
    stepName: string;
    message: string;
    options: string[];
}

interface TaskCompletionNotification {
    taskNumber: number;
    filePath: string;
    timestamp: Date;
}

let isStreaming = false;
let currentStreamMessageId: string | null = null;
let pendingFileOperations: FileOperation[] = [];

// Input configuration
const MAX_MESSAGE_LENGTH = 10000;
const WARNING_THRESHOLD = 9000;

// Autocomplete state
interface AutocompleteItem {
    path: string;
    type: "file" | "folder";
    icon: string;
}

let autocompleteVisible = false;
let autocompleteItems: AutocompleteItem[] = [];
let autocompleteSelectedIndex = -1;
let autocompleteQuery = "";
let autocompleteStartPos = 0;

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    initializeEventListeners();
    adjustTextareaHeight();

    // Request initial mode from extension
    vscode.postMessage({ type: "requestMode" });
});

function initializeEventListeners(): void {
    // Mode selector
    const modeButton = document.getElementById("mode-button");
    const modeDropdown = document.getElementById("mode-dropdown");

    modeButton?.addEventListener("click", () => {
        modeDropdown?.classList.toggle("hidden");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (
            !modeButton?.contains(e.target as Node) &&
            !modeDropdown?.contains(e.target as Node)
        ) {
            modeDropdown?.classList.add("hidden");
        }
    });

    // Mode options
    const modeOptions = document.querySelectorAll(".mode-option");
    modeOptions.forEach((option) => {
        option.addEventListener("click", () => {
            const mode = option.getAttribute("data-mode") as "vibe" | "spec";
            if (mode) {
                vscode.postMessage({ type: "modeChange", mode });
                modeDropdown?.classList.add("hidden");
            }
        });
    });

    // Clear chat button
    const clearButton = document.getElementById("clear-chat-button");
    clearButton?.addEventListener("click", () => {
        vscode.postMessage({ type: "clearChat" });
    });

    // Message input
    const messageInput = document.getElementById(
        "message-input"
    ) as HTMLTextAreaElement;
    const sendButton = document.getElementById("send-button");
    const stopButton = document.getElementById("stop-button");

    messageInput?.addEventListener("input", (e) => {
        adjustTextareaHeight();
        updateCharacterCount();
        updateSendButtonState();
        handleAutocompleteInput(e as InputEvent);
    });

    messageInput?.addEventListener("keydown", (e) => {
        // Handle autocomplete navigation first
        if (autocompleteVisible) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                navigateAutocomplete(1);
                return;
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                navigateAutocomplete(-1);
                return;
            } else if (
                e.key === "Enter" &&
                !e.shiftKey &&
                autocompleteSelectedIndex >= 0
            ) {
                e.preventDefault();
                selectAutocompleteItem();
                return;
            } else if (e.key === "Escape") {
                e.preventDefault();
                hideAutocomplete();
                return;
            }
        }

        // Handle Enter key for sending message
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    messageInput?.addEventListener("paste", (e) => {
        // Handle paste event to check length
        setTimeout(() => {
            const input = e.target as HTMLTextAreaElement;
            if (input.value.length > MAX_MESSAGE_LENGTH) {
                input.value = input.value.substring(0, MAX_MESSAGE_LENGTH);
                updateCharacterCount();
                updateSendButtonState();
            }
        }, 0);
    });

    sendButton?.addEventListener("click", () => {
        sendMessage();
    });

    // Stop button
    stopButton?.addEventListener("click", () => {
        stopGeneration();
    });

    // Initialize character count
    updateCharacterCount();
    updateSendButtonState();
}

function sendMessage(): void {
    const messageInput = document.getElementById(
        "message-input"
    ) as HTMLTextAreaElement;
    const sendButton = document.getElementById(
        "send-button"
    ) as HTMLButtonElement;

    if (!messageInput || !sendButton) {
        return;
    }

    const content = messageInput.value.trim();

    // Validate input
    if (!content) {
        return;
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
        return;
    }

    if (isStreaming) {
        return;
    }

    // Disable input while sending
    messageInput.disabled = true;
    sendButton.disabled = true;

    vscode.postMessage({ type: "userMessage", content });

    // Clear input
    messageInput.value = "";
    adjustTextareaHeight();
    updateCharacterCount();

    // Re-enable input after a short delay
    setTimeout(() => {
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
        updateSendButtonState();
    }, 100);
}

function adjustTextareaHeight(): void {
    const messageInput = document.getElementById(
        "message-input"
    ) as HTMLTextAreaElement;
    if (!messageInput) {
        return;
    }

    messageInput.style.height = "auto";
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + "px";
}

function updateCharacterCount(): void {
    const messageInput = document.getElementById(
        "message-input"
    ) as HTMLTextAreaElement;
    const characterCount = document.getElementById("character-count");

    if (!messageInput || !characterCount) {
        return;
    }

    const length = messageInput.value.length;

    // Only show count when approaching limit
    if (length > WARNING_THRESHOLD) {
        characterCount.textContent = `${length}/${MAX_MESSAGE_LENGTH}`;
        characterCount.classList.remove("error");
        characterCount.classList.add("warning");
    } else if (length >= MAX_MESSAGE_LENGTH) {
        characterCount.textContent = `${length}/${MAX_MESSAGE_LENGTH}`;
        characterCount.classList.remove("warning");
        characterCount.classList.add("error");
    } else {
        characterCount.textContent = "";
        characterCount.classList.remove("warning", "error");
    }
}

function updateSendButtonState(): void {
    const messageInput = document.getElementById(
        "message-input"
    ) as HTMLTextAreaElement;
    const sendButton = document.getElementById(
        "send-button"
    ) as HTMLButtonElement;
    const stopButton = document.getElementById(
        "stop-button"
    ) as HTMLButtonElement;

    if (!messageInput || !sendButton) {
        return;
    }

    const content = messageInput.value.trim();
    const isValid = content.length > 0 && content.length <= MAX_MESSAGE_LENGTH;

    sendButton.disabled = !isValid || isStreaming || messageInput.disabled;

    // Show/hide stop button based on streaming state
    if (stopButton) {
        if (isStreaming) {
            stopButton.classList.remove("hidden");
            sendButton.classList.add("hidden");
        } else {
            stopButton.classList.add("hidden");
            sendButton.classList.remove("hidden");
        }
    }
}

function stopGeneration(): void {
    vscode.postMessage({ type: "stopGeneration" });
}

function updateMode(mode: "vibe" | "spec"): void {
    const modeButton = document.getElementById("mode-button");
    const modeIcon = document.getElementById("mode-icon");
    const modeText = document.getElementById("mode-text");

    // Update button class for styling
    if (modeButton) {
        modeButton.className = `mode-button mode-${mode}`;
    }

    // Update icon and text
    if (mode === "vibe") {
        modeIcon?.setAttribute("class", "codicon codicon-rocket");
        if (modeText) {
            modeText.textContent = "Vibe";
        }
    } else {
        modeIcon?.setAttribute("class", "codicon codicon-notebook");
        if (modeText) {
            modeText.textContent = "Spec";
        }
    }

    // Update active state in dropdown
    const modeOptions = document.querySelectorAll(".mode-option");
    modeOptions.forEach((option) => {
        if (option.getAttribute("data-mode") === mode) {
            option.classList.add("active");
        } else {
            option.classList.remove("active");
        }
    });
}

function addMessage(message: ChatMessage): void {
    const messagesContainer = document.getElementById("messages");
    if (!messagesContainer) {
        return;
    }

    const messageElement = createMessageElement(message);
    messagesContainer.appendChild(messageElement);

    // Scroll to bottom with smooth animation
    requestAnimationFrame(() => {
        scrollToBottom(true);
    });
}

function createMessageElement(message: ChatMessage): HTMLElement {
    const messageElement = document.createElement("div");
    messageElement.className = `message message-${message.role}`;
    messageElement.id = `message-${message.id}`;

    // Create avatar
    const avatarElement = document.createElement("div");
    avatarElement.className = "message-avatar";

    if (message.role === "user") {
        avatarElement.innerHTML =
            '<span class="codicon codicon-account"></span>';
    } else if (message.role === "assistant") {
        avatarElement.innerHTML = '<span class="codicon codicon-hubot"></span>';
    } else {
        avatarElement.innerHTML = '<span class="codicon codicon-info"></span>';
    }

    // Create content container
    const contentElement = document.createElement("div");
    contentElement.className = "message-content";

    // Create text element with markdown rendering
    const textElement = document.createElement("div");
    textElement.className = "message-text";

    // Render markdown for assistant messages, plain text for user messages
    if (message.role === "assistant") {
        textElement.innerHTML = md.render(message.content);
        // Add code block toolbars after rendering
        addCodeBlockToolbars(textElement);
    } else {
        // For user and system messages, use plain text
        textElement.textContent = message.content;
    }

    contentElement.appendChild(textElement);

    // Add file reference chips if present
    if (message.fileReferences && message.fileReferences.length > 0) {
        const fileRefsElement = createFileReferencesElement(
            message.fileReferences
        );
        contentElement.appendChild(fileRefsElement);
    }

    // Add file operations if present
    if (message.fileOperations && message.fileOperations.length > 0) {
        const fileOpsElement = createFileOperationsElement(
            message.fileOperations
        );
        contentElement.appendChild(fileOpsElement);
    }

    // Create timestamp
    const timestampElement = document.createElement("div");
    timestampElement.className = "message-timestamp";
    timestampElement.textContent = formatTimestamp(new Date(message.timestamp));

    contentElement.appendChild(timestampElement);

    messageElement.appendChild(avatarElement);
    messageElement.appendChild(contentElement);

    return messageElement;
}

function streamChunk(text: string): void {
    isStreaming = true;
    updateSendButtonState();

    if (!currentStreamMessageId) {
        // Create new streaming message
        const messageId = `stream-${Date.now()}`;
        currentStreamMessageId = messageId;

        const messagesContainer = document.getElementById("messages");
        if (!messagesContainer) {
            return;
        }

        const messageElement = document.createElement("div");
        messageElement.className = "message message-assistant streaming";
        messageElement.id = `message-${messageId}`;

        const avatarElement = document.createElement("div");
        avatarElement.className = "message-avatar";
        avatarElement.innerHTML = '<span class="codicon codicon-hubot"></span>';

        const contentElement = document.createElement("div");
        contentElement.className = "message-content";

        // Add typing indicator if no text yet
        if (!text) {
            const typingIndicator = document.createElement("div");
            typingIndicator.className = "typing-indicator";
            typingIndicator.id = `typing-${messageId}`;
            typingIndicator.innerHTML =
                "<span></span><span></span><span></span>";
            contentElement.appendChild(typingIndicator);
        }

        const textElement = document.createElement("div");
        textElement.className = "message-text";
        textElement.id = `text-${messageId}`;
        // Store raw content for streaming
        textElement.setAttribute("data-raw-content", text);
        textElement.textContent = text;

        // Hide text element if empty (showing typing indicator instead)
        if (!text) {
            textElement.style.display = "none";
        }

        contentElement.appendChild(textElement);

        messageElement.appendChild(avatarElement);
        messageElement.appendChild(contentElement);

        messagesContainer.appendChild(messageElement);
    } else {
        // Remove typing indicator if it exists
        const typingIndicator = document.getElementById(
            `typing-${currentStreamMessageId}`
        );
        if (typingIndicator) {
            typingIndicator.remove();
        }

        // Show and update text element
        const textElement = document.getElementById(
            `text-${currentStreamMessageId}`
        );
        if (textElement) {
            textElement.style.display = "block";
            const currentRaw =
                textElement.getAttribute("data-raw-content") || "";
            const newRaw = currentRaw + text;
            textElement.setAttribute("data-raw-content", newRaw);
            textElement.textContent = newRaw;
        }
    }

    // Auto-scroll during streaming
    scrollToBottom(false);
}

function streamComplete(): void {
    if (currentStreamMessageId) {
        const messageElement = document.getElementById(
            `message-${currentStreamMessageId}`
        );
        messageElement?.classList.remove("streaming");

        // Remove typing indicator if it still exists
        const typingIndicator = document.getElementById(
            `typing-${currentStreamMessageId}`
        );
        if (typingIndicator) {
            typingIndicator.remove();
        }

        // Render markdown for the complete message
        const textElement = document.getElementById(
            `text-${currentStreamMessageId}`
        );
        if (textElement) {
            textElement.style.display = "block";
            const rawContent =
                textElement.getAttribute("data-raw-content") ||
                textElement.textContent ||
                "";
            textElement.innerHTML = md.render(rawContent);
            textElement.removeAttribute("data-raw-content");
            // Add code block toolbars after rendering
            addCodeBlockToolbars(textElement);
        }

        // Add completion indicator briefly
        const contentElement =
            messageElement?.querySelector(".message-content");
        if (contentElement) {
            const completionIndicator = document.createElement("div");
            completionIndicator.className = "completion-indicator";
            completionIndicator.innerHTML =
                '<span class="codicon codicon-check"></span> Complete';
            contentElement.appendChild(completionIndicator);

            // Remove completion indicator after 2 seconds
            setTimeout(() => {
                completionIndicator.remove();
            }, 2000);

            // Add timestamp
            const timestampElement = document.createElement("div");
            timestampElement.className = "message-timestamp";
            timestampElement.textContent = formatTimestamp(new Date());
            contentElement.appendChild(timestampElement);
        }

        currentStreamMessageId = null;
    }
    isStreaming = false;
    updateSendButtonState();
}

function clearMessages(): void {
    const messagesContainer = document.getElementById("messages");
    if (messagesContainer) {
        messagesContainer.innerHTML = "";
    }
    // Remove load more button if it exists
    hideLoadMoreButton();
}

function handleLoadMoreMessages(
    messages: ChatMessage[],
    hasMore: boolean
): void {
    const messagesContainer = document.getElementById("messages");
    if (!messagesContainer) {
        return;
    }

    // Save current scroll position
    const messagesScrollContainer =
        document.getElementById("messages-container");
    const previousScrollHeight = messagesScrollContainer?.scrollHeight || 0;

    // Prepend older messages to the beginning
    const fragment = document.createDocumentFragment();
    messages.forEach((message) => {
        const messageElement = createMessageElement(message);
        fragment.appendChild(messageElement);
    });

    // Insert at the beginning (after load more button if it exists)
    const loadMoreButton = document.getElementById("load-more-button");
    if (loadMoreButton) {
        messagesContainer.insertBefore(fragment, loadMoreButton.nextSibling);
    } else {
        messagesContainer.insertBefore(fragment, messagesContainer.firstChild);
    }

    // Update or hide load more button
    if (hasMore) {
        showLoadMoreButton();
    } else {
        hideLoadMoreButton();
    }

    // Restore scroll position (maintain user's view)
    if (messagesScrollContainer) {
        const newScrollHeight = messagesScrollContainer.scrollHeight;
        const scrollDiff = newScrollHeight - previousScrollHeight;
        messagesScrollContainer.scrollTop += scrollDiff;
    }
}

function showLoadMoreButton(): void {
    let loadMoreButton = document.getElementById("load-more-button");

    if (!loadMoreButton) {
        const messagesContainer = document.getElementById("messages");
        if (!messagesContainer) {
            return;
        }

        loadMoreButton = document.createElement("div");
        loadMoreButton.id = "load-more-button";
        loadMoreButton.className = "load-more-button";

        const button = document.createElement("button");
        button.className = "load-more-btn";
        button.innerHTML =
            '<span class="codicon codicon-arrow-up"></span><span>Load More Messages</span>';
        button.addEventListener("click", () => {
            vscode.postMessage({ type: "loadMoreMessages" });
            button.disabled = true;
            button.innerHTML =
                '<span class="codicon codicon-loading codicon-modifier-spin"></span><span>Loading...</span>';
        });

        loadMoreButton.appendChild(button);
        messagesContainer.insertBefore(
            loadMoreButton,
            messagesContainer.firstChild
        );
    } else {
        // Re-enable button if it was disabled
        const button = loadMoreButton.querySelector("button");
        if (button) {
            button.disabled = false;
            button.innerHTML =
                '<span class="codicon codicon-arrow-up"></span><span>Load More Messages</span>';
        }
        loadMoreButton.style.display = "block";
    }
}

function hideLoadMoreButton(): void {
    const loadMoreButton = document.getElementById("load-more-button");
    if (loadMoreButton) {
        loadMoreButton.style.display = "none";
    }
}

function formatTimestamp(date: Date): string {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
}

function scrollToBottom(smooth: boolean = false): void {
    const messagesContainer = document.getElementById("messages-container");
    if (messagesContainer) {
        if (smooth) {
            messagesContainer.scrollTo({
                top: messagesContainer.scrollHeight,
                behavior: "smooth",
            });
        } else {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }
}

// Add toolbars to code blocks for copy, insert, and apply actions
function addCodeBlockToolbars(container: HTMLElement): void {
    const codeBlocks = container.querySelectorAll("pre.code-block");

    codeBlocks.forEach((block) => {
        // Skip if toolbar already added
        if (block.getAttribute("data-toolbar-ready") === "true") {
            return;
        }

        const codeElement = block.querySelector("code");
        if (!codeElement) {
            return;
        }

        const code = codeElement.textContent || "";
        const language = block.getAttribute("data-language") || "";

        // Create toolbar container
        const toolbar = document.createElement("div");
        toolbar.className = "code-block-toolbar";

        // Add language label if available
        if (language) {
            const languageLabel = document.createElement("span");
            languageLabel.className = "code-block-language";
            languageLabel.textContent = language;
            toolbar.appendChild(languageLabel);
        }

        // Create button container
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "code-block-buttons";

        // Copy button
        const copyButton = createToolbarButton("Copy", "codicon-copy", () =>
            handleCopyCode(code, copyButton)
        );
        buttonContainer.appendChild(copyButton);

        // Insert at cursor button
        const insertButton = createToolbarButton(
            "Insert at Cursor",
            "codicon-insert",
            () => handleInsertCode(code)
        );
        buttonContainer.appendChild(insertButton);

        // Apply to file button (only if file path is detected in context)
        const filePath = detectFilePath(block);
        if (filePath) {
            const applyButton = createToolbarButton(
                "Apply to File",
                "codicon-save",
                () => handleApplyCode(code, filePath)
            );
            applyButton.setAttribute("data-file-path", filePath);
            buttonContainer.appendChild(applyButton);
        }

        toolbar.appendChild(buttonContainer);

        // Insert toolbar before the code block
        block.parentElement?.insertBefore(toolbar, block);

        // Wrap toolbar and code block in a container
        const wrapper = document.createElement("div");
        wrapper.className = "code-block-wrapper";
        block.parentElement?.insertBefore(wrapper, toolbar);
        wrapper.appendChild(toolbar);
        wrapper.appendChild(block);

        block.setAttribute("data-toolbar-ready", "true");
    });
}

// Create a toolbar button
function createToolbarButton(
    label: string,
    iconClass: string,
    onClick: () => void
): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "code-block-button";
    button.title = label;
    button.innerHTML = `<span class="codicon ${iconClass}"></span><span class="button-label">${label}</span>`;
    button.addEventListener("click", onClick);
    return button;
}

// Detect file path from surrounding context (e.g., previous paragraph or comment)
function detectFilePath(codeBlock: Element): string | null {
    // Look for file path in the previous sibling or in a comment within the code
    let current = codeBlock.previousElementSibling;

    // Check previous 2 siblings for file path patterns
    for (let i = 0; i < 2 && current; i++) {
        const text = current.textContent || "";

        // Match common file path patterns
        // Examples: "file: src/app.ts", "// src/app.ts", "src/app.ts:"
        const filePathMatch = text.match(
            /(?:file:|\/\/|^)\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/i
        );
        if (filePathMatch) {
            return filePathMatch[1].trim();
        }

        current = current.previousElementSibling;
    }

    // Check for file path in code comment (first line)
    const codeElement = codeBlock.querySelector("code");
    if (codeElement) {
        const firstLine = (codeElement.textContent || "").split("\n")[0];
        const commentMatch = firstLine.match(
            /^(?:\/\/|#|<!--)\s*([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)/
        );
        if (commentMatch) {
            return commentMatch[1].trim();
        }
    }

    return null;
}

// Handle copy code action
function handleCopyCode(code: string, button: HTMLButtonElement): void {
    vscode.postMessage({ type: "copyCode", code });

    // Visual feedback
    const originalHTML = button.innerHTML;
    button.innerHTML =
        '<span class="codicon codicon-check"></span><span class="button-label">Copied!</span>';
    button.classList.add("success");

    setTimeout(() => {
        button.innerHTML = originalHTML;
        button.classList.remove("success");
    }, 2000);
}

// Handle insert code action
function handleInsertCode(code: string): void {
    vscode.postMessage({ type: "insertCode", code });
}

// Handle apply code action
function handleApplyCode(code: string, filePath: string): void {
    vscode.postMessage({ type: "applyCode", code, filePath });
}

// Create file reference chips component
function createFileReferencesElement(references: FileReference[]): HTMLElement {
    const container = document.createElement("div");
    container.className = "file-references";

    references.forEach((ref) => {
        const chip = document.createElement("div");
        chip.className = `file-reference-chip ${
            ref.exists ? "exists" : "missing"
        }`;

        // Icon
        const icon = document.createElement("span");
        icon.className = `codicon ${
            ref.type === "file" ? "codicon-file" : "codicon-folder"
        }`;
        chip.appendChild(icon);

        // Path
        const path = document.createElement("span");
        path.className = "file-reference-path";
        path.textContent = ref.path;
        chip.appendChild(path);

        // Status indicator
        if (!ref.exists) {
            const status = document.createElement("span");
            status.className = "file-reference-status codicon codicon-warning";
            status.title = "File not found";
            chip.appendChild(status);
        }

        // Click handler to open file
        if (ref.exists) {
            chip.classList.add("clickable");
            chip.addEventListener("click", () => {
                vscode.postMessage({ type: "openFile", path: ref.path });
            });
        }

        container.appendChild(chip);
    });

    return container;
}

// Create file operation notification component
function createFileOperationsElement(operations: FileOperation[]): HTMLElement {
    const container = document.createElement("div");
    container.className = "file-operations";

    // Create header
    const header = document.createElement("div");
    header.className = "file-operations-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "file-operations-header-left";

    const icon = document.createElement("span");
    icon.className = "file-operations-icon codicon codicon-files";
    headerLeft.appendChild(icon);

    const title = document.createElement("span");
    title.className = "file-operations-title";
    title.textContent = "File Operations";
    headerLeft.appendChild(title);

    const count = document.createElement("span");
    count.className = "file-operations-count";
    count.textContent = `(${operations.length})`;
    headerLeft.appendChild(count);

    const toggle = document.createElement("span");
    toggle.className = "file-operations-toggle codicon codicon-chevron-down";

    header.appendChild(headerLeft);
    header.appendChild(toggle);

    // Toggle collapse on header click
    header.addEventListener("click", () => {
        container.classList.toggle("collapsed");
    });

    container.appendChild(header);

    // Create operations list
    const list = document.createElement("ul");
    list.className = "file-operations-list";

    let successCount = 0;
    let errorCount = 0;

    operations.forEach((operation) => {
        const item = createFileOperationItem(operation);
        list.appendChild(item);

        if (operation.success) {
            successCount++;
        } else {
            errorCount++;
        }
    });

    container.appendChild(list);

    // Create summary
    if (operations.length > 1) {
        const summary = document.createElement("div");
        summary.className = "file-operation-summary";

        if (successCount > 0) {
            const successItem = document.createElement("div");
            successItem.className = "file-operation-summary-item success";
            successItem.innerHTML = `<span class="codicon codicon-check"></span><span>${successCount} successful</span>`;
            summary.appendChild(successItem);
        }

        if (errorCount > 0) {
            const errorItem = document.createElement("div");
            errorItem.className = "file-operation-summary-item error";
            errorItem.innerHTML = `<span class="codicon codicon-error"></span><span>${errorCount} failed</span>`;
            summary.appendChild(errorItem);
        }

        container.appendChild(summary);
    }

    return container;
}

// Create individual file operation item
function createFileOperationItem(operation: FileOperation): HTMLElement {
    const item = document.createElement("li");
    item.className = "file-operation-item";

    // Status icon
    const status = document.createElement("div");
    status.className = `file-operation-status ${
        operation.success ? "success" : "error"
    }`;
    status.innerHTML = operation.success
        ? '<span class="codicon codicon-check"></span>'
        : '<span class="codicon codicon-error"></span>';
    item.appendChild(status);

    // Content
    const content = document.createElement("div");
    content.className = "file-operation-content";

    // Header with type and path
    const operationHeader = document.createElement("div");
    operationHeader.className = "file-operation-header";

    const type = document.createElement("span");
    type.className = `file-operation-type ${operation.type}`;
    type.textContent = operation.type;
    operationHeader.appendChild(type);

    const path = document.createElement("span");
    path.className = "file-operation-path";
    path.textContent = operation.path;
    operationHeader.appendChild(path);

    content.appendChild(operationHeader);

    // Error message if failed
    if (!operation.success && operation.error) {
        const error = document.createElement("div");
        error.className = "file-operation-error";
        error.textContent = operation.error;
        content.appendChild(error);
    }

    // Action buttons for successful operations
    if (
        operation.success &&
        (operation.type === "create" || operation.type === "update")
    ) {
        const actions = document.createElement("div");
        actions.className = "file-operation-actions";

        const openButton = document.createElement("button");
        openButton.className = "file-operation-button";
        openButton.innerHTML =
            '<span class="codicon codicon-go-to-file"></span><span>Open File</span>';
        openButton.addEventListener("click", () => {
            vscode.postMessage({ type: "openFile", path: operation.path });
        });
        actions.appendChild(openButton);

        content.appendChild(actions);
    }

    item.appendChild(content);

    return item;
}

// Add file operation to current streaming message or pending operations
function addFileOperation(operation: FileOperation): void {
    if (currentStreamMessageId) {
        // Add to current streaming message
        const messageElement = document.getElementById(
            `message-${currentStreamMessageId}`
        );
        if (messageElement) {
            const contentElement =
                messageElement.querySelector(".message-content");
            if (contentElement) {
                // Check if file operations element already exists
                let fileOpsElement = contentElement.querySelector(
                    ".file-operations"
                ) as HTMLElement;

                if (!fileOpsElement) {
                    // Create new file operations element
                    pendingFileOperations.push(operation);
                    fileOpsElement = createFileOperationsElement(
                        pendingFileOperations
                    );

                    // Insert before timestamp
                    const timestampElement =
                        contentElement.querySelector(".message-timestamp");
                    if (timestampElement) {
                        contentElement.insertBefore(
                            fileOpsElement,
                            timestampElement
                        );
                    } else {
                        contentElement.appendChild(fileOpsElement);
                    }
                } else {
                    // Update existing file operations element
                    pendingFileOperations.push(operation);
                    const newFileOpsElement = createFileOperationsElement(
                        pendingFileOperations
                    );
                    fileOpsElement.replaceWith(newFileOpsElement);
                }
            }
        }
    } else {
        // Store for next message
        pendingFileOperations.push(operation);
    }

    // Auto-scroll to show new operation
    scrollToBottom(false);
}

// Attach pending file operations to the current streaming message
function attachPendingFileOperations(): void {
    if (
        pendingFileOperations.length > 0 &&
        currentStreamMessageId &&
        !isStreaming
    ) {
        const messageElement = document.getElementById(
            `message-${currentStreamMessageId}`
        );
        if (messageElement) {
            const contentElement =
                messageElement.querySelector(".message-content");
            if (contentElement) {
                // Check if file operations element already exists
                let fileOpsElement = contentElement.querySelector(
                    ".file-operations"
                ) as HTMLElement;

                if (!fileOpsElement) {
                    fileOpsElement = createFileOperationsElement(
                        pendingFileOperations
                    );

                    // Insert before timestamp
                    const timestampElement =
                        contentElement.querySelector(".message-timestamp");
                    if (timestampElement) {
                        contentElement.insertBefore(
                            fileOpsElement,
                            timestampElement
                        );
                    } else {
                        contentElement.appendChild(fileOpsElement);
                    }
                }
            }
        }

        // Clear pending operations
        pendingFileOperations = [];
    }
}

// Autocomplete functions
function handleAutocompleteInput(event: InputEvent): void {
    const messageInput = document.getElementById(
        "message-input"
    ) as HTMLTextAreaElement;
    if (!messageInput) {
        return;
    }

    const cursorPos = messageInput.selectionStart;
    const text = messageInput.value;

    // Check if user typed # character
    if (event.data === "#" || (cursorPos > 0 && text[cursorPos - 1] === "#")) {
        // Find the start of the # reference
        let start = cursorPos - 1;
        while (start > 0 && text[start] !== "#") {
            start--;
        }

        autocompleteStartPos = start;
        autocompleteQuery = text.substring(start + 1, cursorPos);

        // Request file list from extension
        vscode.postMessage({
            type: "requestFileList",
            query: autocompleteQuery,
        });
        return;
    }

    // Check if we're currently in a # reference
    if (cursorPos > 0) {
        let start = cursorPos - 1;
        while (start >= 0 && text[start] !== " " && text[start] !== "\n") {
            if (text[start] === "#") {
                // We're in a reference, update query
                autocompleteStartPos = start;
                autocompleteQuery = text.substring(start + 1, cursorPos);

                // Request updated file list
                vscode.postMessage({
                    type: "requestFileList",
                    query: autocompleteQuery,
                });
                return;
            }
            start--;
        }
    }

    // Not in a reference, hide autocomplete
    if (autocompleteVisible) {
        hideAutocomplete();
    }
}

function showAutocomplete(items: AutocompleteItem[]): void {
    autocompleteItems = items;
    autocompleteSelectedIndex = items.length > 0 ? 0 : -1;

    const messageInput = document.getElementById(
        "message-input"
    ) as HTMLTextAreaElement;
    if (!messageInput) {
        return;
    }

    // Create or get autocomplete dropdown
    let dropdown = document.getElementById("autocomplete-dropdown");
    if (!dropdown) {
        dropdown = document.createElement("div");
        dropdown.id = "autocomplete-dropdown";
        dropdown.className = "autocomplete-dropdown";
        messageInput.parentElement?.appendChild(dropdown);
    }

    // Clear existing items
    dropdown.innerHTML = "";

    if (items.length === 0) {
        hideAutocomplete();
        return;
    }

    // Add items to dropdown
    items.forEach((item, index) => {
        const itemElement = document.createElement("div");
        itemElement.className = "autocomplete-item";
        if (index === autocompleteSelectedIndex) {
            itemElement.classList.add("selected");
        }

        const icon = document.createElement("span");
        icon.className = `codicon ${item.icon}`;
        itemElement.appendChild(icon);

        const path = document.createElement("span");
        path.className = "autocomplete-path";
        path.textContent = item.path;
        itemElement.appendChild(path);

        const type = document.createElement("span");
        type.className = "autocomplete-type";
        type.textContent = item.type;
        itemElement.appendChild(type);

        itemElement.addEventListener("click", () => {
            autocompleteSelectedIndex = index;
            selectAutocompleteItem();
        });

        dropdown.appendChild(itemElement);
    });

    dropdown.classList.remove("hidden");
    autocompleteVisible = true;
}

function hideAutocomplete(): void {
    const dropdown = document.getElementById("autocomplete-dropdown");
    if (dropdown) {
        dropdown.classList.add("hidden");
    }
    autocompleteVisible = false;
    autocompleteSelectedIndex = -1;
    autocompleteItems = [];
}

function navigateAutocomplete(direction: number): void {
    if (autocompleteItems.length === 0) {
        return;
    }

    // Update selected index
    autocompleteSelectedIndex += direction;

    // Wrap around
    if (autocompleteSelectedIndex < 0) {
        autocompleteSelectedIndex = autocompleteItems.length - 1;
    } else if (autocompleteSelectedIndex >= autocompleteItems.length) {
        autocompleteSelectedIndex = 0;
    }

    // Update UI
    const dropdown = document.getElementById("autocomplete-dropdown");
    if (!dropdown) {
        return;
    }

    const items = dropdown.querySelectorAll(".autocomplete-item");
    items.forEach((item, index) => {
        if (index === autocompleteSelectedIndex) {
            item.classList.add("selected");
            item.scrollIntoView({ block: "nearest" });
        } else {
            item.classList.remove("selected");
        }
    });
}

function selectAutocompleteItem(): void {
    if (
        autocompleteSelectedIndex < 0 ||
        autocompleteSelectedIndex >= autocompleteItems.length
    ) {
        return;
    }

    const selectedItem = autocompleteItems[autocompleteSelectedIndex];
    const messageInput = document.getElementById(
        "message-input"
    ) as HTMLTextAreaElement;
    if (!messageInput) {
        return;
    }

    // Replace the # reference with the selected path
    const text = messageInput.value;
    const before = text.substring(0, autocompleteStartPos);
    const after = text.substring(messageInput.selectionStart);

    // Format as #File:path or #Folder:path
    const reference = `#${selectedItem.type === "file" ? "File" : "Folder"}:${
        selectedItem.path
    }`;
    messageInput.value = before + reference + " " + after;

    // Move cursor after the inserted reference
    const newCursorPos = before.length + reference.length + 1;
    messageInput.setSelectionRange(newCursorPos, newCursorPos);

    hideAutocomplete();
    adjustTextareaHeight();
}

// Workflow progress display
let currentWorkflowProgressElement: HTMLElement | null = null;
let currentApprovalRequestElement: HTMLElement | null = null;

function updateWorkflowProgress(progress: WorkflowProgress): void {
    // Find or create progress element
    if (!currentWorkflowProgressElement) {
        currentWorkflowProgressElement =
            createWorkflowProgressElement(progress);

        // Add to messages container
        const messagesContainer = document.getElementById("messages");
        if (messagesContainer) {
            messagesContainer.appendChild(currentWorkflowProgressElement);
        }
    } else {
        // Update existing progress element
        updateWorkflowProgressElement(currentWorkflowProgressElement, progress);
    }

    // Remove progress element if workflow is completed or failed
    if (progress.status === "completed" || progress.status === "failed") {
        setTimeout(() => {
            if (currentWorkflowProgressElement) {
                currentWorkflowProgressElement.remove();
                currentWorkflowProgressElement = null;
            }
        }, 3000); // Keep visible for 3 seconds after completion
    }

    // Auto-scroll to show progress
    scrollToBottom(false);
}

function createWorkflowProgressElement(
    progress: WorkflowProgress
): HTMLElement {
    const container = document.createElement("div");
    container.className = "workflow-progress";
    container.id = "workflow-progress";

    // Header
    const header = document.createElement("div");
    header.className = "workflow-progress-header";

    const icon = document.createElement("span");
    icon.className =
        "workflow-progress-icon codicon codicon-loading codicon-modifier-spin";
    header.appendChild(icon);

    const title = document.createElement("span");
    title.className = "workflow-progress-title";
    title.textContent = progress.workflowName;
    header.appendChild(title);

    container.appendChild(header);

    // Progress bar
    const progressBarContainer = document.createElement("div");
    progressBarContainer.className = "workflow-progress-bar-container";

    const progressBar = document.createElement("div");
    progressBar.className = "workflow-progress-bar";
    progressBar.id = "workflow-progress-bar";

    const progressFill = document.createElement("div");
    progressFill.className = "workflow-progress-fill";
    progressFill.id = "workflow-progress-fill";

    const percentage = Math.round(
        (progress.currentStep / progress.totalSteps) * 100
    );
    progressFill.style.width = `${percentage}%`;

    progressBar.appendChild(progressFill);
    progressBarContainer.appendChild(progressBar);
    container.appendChild(progressBarContainer);

    // Step info
    const stepInfo = document.createElement("div");
    stepInfo.className = "workflow-progress-step";
    stepInfo.id = "workflow-progress-step";
    stepInfo.textContent = `Step ${progress.currentStep}/${progress.totalSteps}: ${progress.currentStepName}`;
    container.appendChild(stepInfo);

    // Status message
    if (progress.message) {
        const message = document.createElement("div");
        message.className = "workflow-progress-message";
        message.id = "workflow-progress-message";
        message.textContent = progress.message;
        container.appendChild(message);
    }

    // Status indicator
    const statusClass = `status-${progress.status}`;
    container.classList.add(statusClass);

    return container;
}

function updateWorkflowProgressElement(
    element: HTMLElement,
    progress: WorkflowProgress
): void {
    // Update icon based on status
    const icon = element.querySelector(".workflow-progress-icon");
    if (icon) {
        icon.className = "workflow-progress-icon codicon";

        if (progress.status === "in-progress") {
            icon.classList.add("codicon-loading", "codicon-modifier-spin");
        } else if (progress.status === "completed") {
            icon.classList.add("codicon-check");
        } else if (progress.status === "failed") {
            icon.classList.add("codicon-error");
        } else if (progress.status === "waiting-approval") {
            icon.classList.add("codicon-question");
        }
    }

    // Update title
    const title = element.querySelector(".workflow-progress-title");
    if (title) {
        title.textContent = progress.workflowName;
    }

    // Update progress bar
    const progressFill = element.querySelector(
        "#workflow-progress-fill"
    ) as HTMLElement;
    if (progressFill) {
        const percentage = Math.round(
            (progress.currentStep / progress.totalSteps) * 100
        );
        progressFill.style.width = `${percentage}%`;
    }

    // Update step info
    const stepInfo = element.querySelector("#workflow-progress-step");
    if (stepInfo) {
        stepInfo.textContent = `Step ${progress.currentStep}/${progress.totalSteps}: ${progress.currentStepName}`;
    }

    // Update or create message
    let message = element.querySelector(
        "#workflow-progress-message"
    ) as HTMLElement;
    if (progress.message) {
        if (!message) {
            message = document.createElement("div");
            message.className = "workflow-progress-message";
            message.id = "workflow-progress-message";
            element.appendChild(message);
        }
        message.textContent = progress.message;
    } else if (message) {
        message.remove();
    }

    // Update status class
    element.className = "workflow-progress";
    element.classList.add(`status-${progress.status}`);
}

// Task completion notification
function showTaskCompletionNotification(
    notification: TaskCompletionNotification
): void {
    // Create a temporary notification element
    const notificationElement = document.createElement("div");
    notificationElement.className = "task-completion-notification";

    const icon = document.createElement("span");
    icon.className = "codicon codicon-check task-completion-icon";
    notificationElement.appendChild(icon);

    const text = document.createElement("span");
    text.className = "task-completion-text";
    text.textContent = `Task ${notification.taskNumber} completed`;
    notificationElement.appendChild(text);

    const file = document.createElement("span");
    file.className = "task-completion-file";
    file.textContent = notification.filePath;
    notificationElement.appendChild(file);

    // Add to messages container
    const messagesContainer = document.getElementById("messages");
    if (messagesContainer) {
        messagesContainer.appendChild(notificationElement);
    }

    // Auto-scroll to show notification
    scrollToBottom(true);

    // Remove after 5 seconds with fade out animation
    setTimeout(() => {
        notificationElement.classList.add("fade-out");
        setTimeout(() => {
            notificationElement.remove();
        }, 500);
    }, 5000);
}

// Approval request display
function showApprovalRequest(request: ApprovalRequest): void {
    // Remove any existing approval request
    if (currentApprovalRequestElement) {
        currentApprovalRequestElement.remove();
    }

    // Create approval request element
    currentApprovalRequestElement = createApprovalRequestElement(request);

    // Add to messages container
    const messagesContainer = document.getElementById("messages");
    if (messagesContainer) {
        messagesContainer.appendChild(currentApprovalRequestElement);
    }

    // Auto-scroll to show approval request
    scrollToBottom(true);
}

function createApprovalRequestElement(request: ApprovalRequest): HTMLElement {
    const container = document.createElement("div");
    container.className = "approval-request";
    container.id = `approval-${request.id}`;

    // Header
    const header = document.createElement("div");
    header.className = "approval-request-header";

    const icon = document.createElement("span");
    icon.className = "approval-request-icon codicon codicon-question";
    header.appendChild(icon);

    const title = document.createElement("span");
    title.className = "approval-request-title";
    title.textContent = "Approval Required";
    header.appendChild(title);

    container.appendChild(header);

    // Step name
    const stepName = document.createElement("div");
    stepName.className = "approval-request-step";
    stepName.textContent = request.stepName;
    container.appendChild(stepName);

    // Message
    const message = document.createElement("div");
    message.className = "approval-request-message";
    message.textContent = request.message;
    container.appendChild(message);

    // Options (buttons)
    const optionsContainer = document.createElement("div");
    optionsContainer.className = "approval-request-options";

    request.options.forEach((option) => {
        const button = document.createElement("button");
        button.className = "approval-request-button";

        // Style primary action differently
        if (
            option.toLowerCase().includes("approve") ||
            option.toLowerCase().includes("yes")
        ) {
            button.classList.add("primary");
        } else if (
            option.toLowerCase().includes("reject") ||
            option.toLowerCase().includes("no") ||
            option.toLowerCase().includes("cancel")
        ) {
            button.classList.add("secondary");
        }

        button.textContent = option;
        button.addEventListener("click", () => {
            handleApprovalResponse(request.id, option);
        });

        optionsContainer.appendChild(button);
    });

    container.appendChild(optionsContainer);

    return container;
}

function handleApprovalResponse(requestId: string, response: string): void {
    // Send response to extension
    vscode.postMessage({ type: "approvalResponse", response });

    // Remove approval request element
    const element = document.getElementById(`approval-${requestId}`);
    if (element) {
        element.classList.add("responded");
        setTimeout(() => {
            element.remove();
            if (currentApprovalRequestElement === element) {
                currentApprovalRequestElement = null;
            }
        }, 500);
    }
}

// Handle messages from extension
window.addEventListener("message", (event) => {
    const message = event.data;

    switch (message.type) {
        case "addMessage":
            addMessage(message.message);
            break;

        case "streamChunk":
            isStreaming = true;
            streamChunk(message.text);
            break;

        case "streamComplete":
            streamComplete();
            attachPendingFileOperations();
            break;

        case "modeUpdated":
            updateMode(message.mode);
            break;

        case "fileOperation":
            addFileOperation(message.operation);
            break;

        case "clearMessages":
            clearMessages();
            pendingFileOperations = [];
            break;

        case "fileList":
            showAutocomplete(message.items);
            break;

        case "workflowProgress":
            updateWorkflowProgress(message.progress);
            break;

        case "approvalRequest":
            showApprovalRequest(message.request);
            break;

        case "taskCompleted":
            showTaskCompletionNotification(message.notification);
            break;

        case "loadMoreMessages":
            handleLoadMoreMessages(message.messages, message.hasMore);
            break;

        case "error":
            console.error("Error from extension:", message.message);
            break;
    }
});
