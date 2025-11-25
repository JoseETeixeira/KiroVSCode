/**
 * Platform-Agnostic Type Definitions
 * 
 * These types mirror the VS Code extension API surface but are defined independently
 * to allow both VSCodeAdapter and AntigravityAdapter to implement them without
 * direct coupling to the vscode module.
 * 
 * @module adapters/types
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Represents a Uniform Resource Identifier (URI).
 * Can represent files, folders, and other resources.
 */
export interface Uri {
    /** The scheme of the URI (e.g., 'file', 'untitled', 'vscode-resource') */
    readonly scheme: string;
    /** The authority of the URI (e.g., host for http URIs) */
    readonly authority: string;
    /** The path of the URI */
    readonly path: string;
    /** The query string of the URI */
    readonly query: string;
    /** The fragment of the URI */
    readonly fragment: string;
    /** The file system path for file URIs */
    readonly fsPath: string;
    
    /** Returns the string representation of the URI */
    toString(): string;
    /** Returns a JSON representation of the URI */
    toJSON(): { scheme: string; authority: string; path: string; query: string; fragment: string };
}

/**
 * Factory for creating Uri instances.
 * Each adapter provides its own implementation.
 */
export interface UriFactory {
    file(path: string): Uri;
    parse(value: string): Uri;
    joinPath(base: Uri, ...pathSegments: string[]): Uri;
}

/**
 * Represents a resource that can be disposed to free up resources.
 */
export interface Disposable {
    /** Dispose this object and free up resources */
    dispose(): void;
}

/**
 * Represents a typed event.
 * Use this interface to listen to events emitted by the platform.
 */
export interface Event<T> {
    /**
     * Register a listener for this event.
     * @param listener The listener function to call when the event fires
     * @param thisArgs Optional `this` context for the listener
     * @param disposables Optional array to which to add the listener's disposable
     * @returns A Disposable that unregisters the listener when disposed
     */
    (listener: (e: T) => any, thisArgs?: any, disposables?: Disposable[]): Disposable;
}

/**
 * An event emitter that can be used to create and fire events.
 */
export interface EventEmitter<T> {
    /** The event that listeners can subscribe to */
    readonly event: Event<T>;
    /** Fire an event with the given data */
    fire(data: T): void;
    /** Dispose the event emitter */
    dispose(): void;
}

// ============================================================================
// Input/Output Types
// ============================================================================

/**
 * Options for showing an input box.
 */
export interface InputBoxOptions {
    /** The title of the input box (shown in the title bar) */
    title?: string;
    /** The value to prefill in the input box */
    value?: string;
    /** Selection of the prefilled value (start, end) */
    valueSelection?: [number, number];
    /** The text to display underneath the input box */
    prompt?: string;
    /** An optional string to show as placeholder in the input box */
    placeHolder?: string;
    /** Set to `true` to show a password input box that masks the input */
    password?: boolean;
    /** Controls if a cancel button should be shown to allow the user to cancel the input box */
    ignoreFocusOut?: boolean;
    /**
     * An optional function that validates the input.
     * Return a string with an error message, null/undefined for valid input.
     */
    validateInput?(value: string): string | undefined | null | Promise<string | undefined | null>;
}

/**
 * Represents an item in a quick pick list.
 */
export interface QuickPickItem {
    /** A human-readable string which is rendered prominent */
    label: string;
    /** A human-readable string which is rendered less prominent in the same line */
    description?: string;
    /** A human-readable string which is rendered less prominent on a separate line */
    detail?: string;
    /** Optional flag indicating if this item is picked initially */
    picked?: boolean;
    /** Always show this item (even when filtering) */
    alwaysShow?: boolean;
}

/**
 * Options for showing a quick pick.
 */
export interface QuickPickOptions {
    /** An optional title */
    title?: string;
    /** An optional string to show as placeholder when the input is empty */
    placeHolder?: string;
    /** Set to `true` to keep the quick pick open when focus moves to another part of the editor */
    ignoreFocusOut?: boolean;
    /** An optional flag to include the description when filtering */
    matchOnDescription?: boolean;
    /** An optional flag to include the detail when filtering */
    matchOnDetail?: boolean;
    /** An optional flag to make the picker accept multiple selections */
    canPickMany?: boolean;
}

// ============================================================================
// UI Component Types
// ============================================================================

/**
 * Alignment of a status bar item.
 */
export enum StatusBarAlignment {
    Left = 1,
    Right = 2
}

/**
 * A status bar item that can be shown in the IDE's status bar.
 */
export interface StatusBarItem {
    /** The alignment of this item */
    readonly alignment: StatusBarAlignment;
    /** The priority of this item (higher = more to the left/right) */
    readonly priority: number | undefined;
    /** The identifier of this item */
    readonly id: string;
    /** The name of this item */
    name: string | undefined;
    /** The text to show for the item */
    text: string;
    /** The tooltip text when hovering over the item */
    tooltip: string | undefined;
    /** The foreground color for this item */
    color: string | undefined;
    /** The background color for this item */
    backgroundColor: string | undefined;
    /** The command to execute when the item is clicked */
    command: string | { command: string; arguments?: any[] } | undefined;
    /** The accessibility information for this item */
    accessibilityInformation?: { label: string; role?: string };
    /** Shows the item in the status bar */
    show(): void;
    /** Hides the item from the status bar */
    hide(): void;
    /** Disposes the item */
    dispose(): void;
}

/**
 * Represents an item in a tree view.
 */
export interface TreeItem {
    /** The label of this tree item */
    label?: string | { label: string; highlights?: [number, number][] };
    /** The unique identifier of this tree item */
    id?: string;
    /** The icon path or ThemeIcon for this tree item */
    iconPath?: string | Uri | { light: string | Uri; dark: string | Uri } | ThemeIcon;
    /** A human-readable string describing this item */
    description?: string | boolean;
    /** The tooltip text when hovering over this item */
    tooltip?: string | undefined;
    /** The command to execute when the item is selected */
    command?: Command;
    /** The collapsible state of this item */
    collapsibleState?: TreeItemCollapsibleState;
    /** Context value for this item (used for when clauses) */
    contextValue?: string;
    /** The accessibility information for this item */
    accessibilityInformation?: { label: string; role?: string };
    /** Resource URI of this item */
    resourceUri?: Uri;
}

/**
 * The collapsible state of a tree item.
 */
export enum TreeItemCollapsibleState {
    None = 0,
    Collapsed = 1,
    Expanded = 2
}

/**
 * Represents a theme icon (built-in icons).
 */
export interface ThemeIcon {
    /** The identifier of the icon */
    readonly id: string;
    /** The color of the icon */
    readonly color?: ThemeColor;
}

/**
 * Represents a theme color.
 */
export interface ThemeColor {
    /** The identifier of the color */
    readonly id: string;
}

/**
 * A data provider for tree views.
 */
export interface TreeDataProvider<T> {
    /** An optional event that signals that tree data has changed */
    onDidChangeTreeData?: Event<T | undefined | null | void>;
    
    /**
     * Get the tree item for an element.
     * @param element The element for which to get the tree item
     * @returns The tree item or a promise that resolves to the tree item
     */
    getTreeItem(element: T): TreeItem | Promise<TreeItem>;
    
    /**
     * Get the children of an element.
     * @param element The element for which to get children, or undefined for root
     * @returns The children or a promise that resolves to the children
     */
    getChildren(element?: T): T[] | undefined | null | Promise<T[] | undefined | null>;
    
    /**
     * Optional method to get the parent of an element.
     * @param element The element for which to get the parent
     * @returns The parent or undefined if element is a root
     */
    getParent?(element: T): T | undefined | null | Promise<T | undefined | null>;
    
    /**
     * Optional method to resolve additional properties for a tree item.
     * @param item The tree item to resolve
     * @param element The element associated with the tree item
     * @returns The resolved tree item
     */
    resolveTreeItem?(item: TreeItem, element: T): TreeItem | Promise<TreeItem>;
}

/**
 * A command that can be executed.
 */
export interface Command {
    /** The identifier of the command to execute */
    command: string;
    /** The title of the command */
    title: string;
    /** A tooltip for the command */
    tooltip?: string;
    /** Arguments that the command handler should be invoked with */
    arguments?: any[];
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Represents the target for configuration updates.
 */
export enum ConfigurationTarget {
    /** Global configuration (user settings) */
    Global = 1,
    /** Workspace configuration */
    Workspace = 2,
    /** Workspace folder configuration */
    WorkspaceFolder = 3
}

/**
 * Represents a configuration scope.
 */
export interface Configuration {
    /**
     * Get a configuration value.
     * @param key The configuration key
     * @param defaultValue Optional default value if key is not found
     * @returns The configuration value or default value
     */
    get<T>(key: string, defaultValue?: T): T | undefined;
    
    /**
     * Check if a configuration key exists.
     * @param key The configuration key
     * @returns True if the key exists
     */
    has(key: string): boolean;
    
    /**
     * Update a configuration value.
     * @param key The configuration key
     * @param value The new value
     * @param target The configuration target (global, workspace, folder)
     * @returns A promise that resolves when the update is complete
     */
    update(key: string, value: any, target?: ConfigurationTarget): Promise<void>;
    
    /**
     * Get the configuration inspection for a key.
     * @param key The configuration key
     * @returns Inspection result with global, workspace, and folder values
     */
    inspect<T>(key: string): ConfigurationInspection<T> | undefined;
}

/**
 * Represents the inspection of a configuration key.
 */
export interface ConfigurationInspection<T> {
    /** The key being inspected */
    key: string;
    /** The default value */
    defaultValue?: T;
    /** The global (user) value */
    globalValue?: T;
    /** The workspace value */
    workspaceValue?: T;
    /** The workspace folder value */
    workspaceFolderValue?: T;
}

/**
 * An event that describes a configuration change.
 */
export interface ConfigurationChangeEvent {
    /**
     * Check if the given section is affected by the configuration change.
     * @param section A configuration section
     * @param scope The scope to check against
     * @returns True if the section is affected
     */
    affectsConfiguration(section: string, scope?: { uri?: Uri; languageId?: string }): boolean;
}

// ============================================================================
// File System Types
// ============================================================================

/**
 * The type of a file.
 */
export enum FileType {
    Unknown = 0,
    File = 1,
    Directory = 2,
    SymbolicLink = 64
}

/**
 * Metadata about a file.
 */
export interface FileStat {
    /** The type of the file */
    type: FileType;
    /** The creation timestamp in milliseconds since epoch */
    ctime: number;
    /** The modification timestamp in milliseconds since epoch */
    mtime: number;
    /** The size in bytes */
    size: number;
    /** The permissions of the file (readonly flag) */
    permissions?: FilePermission;
}

/**
 * File permissions.
 */
export enum FilePermission {
    Readonly = 1
}

/**
 * A file system watcher that can watch for file changes.
 */
export interface FileSystemWatcher extends Disposable {
    /** Event fired when a file is created */
    readonly onDidCreate: Event<Uri>;
    /** Event fired when a file is changed */
    readonly onDidChange: Event<Uri>;
    /** Event fired when a file is deleted */
    readonly onDidDelete: Event<Uri>;
}

// ============================================================================
// Workspace Types
// ============================================================================

/**
 * A workspace folder.
 */
export interface WorkspaceFolder {
    /** The URI of the workspace folder */
    readonly uri: Uri;
    /** The name of the workspace folder */
    readonly name: string;
    /** The ordinal index of this folder in the workspace */
    readonly index: number;
}

// ============================================================================
// Editor Types
// ============================================================================

/**
 * Represents a text editor.
 */
export interface TextEditor {
    /** The document associated with this editor */
    readonly document: TextDocument;
    /** The primary selection */
    selection: Selection;
    /** The selections in this editor */
    selections: readonly Selection[];
    /** The visible ranges of this editor */
    readonly visibleRanges: readonly Range[];
    /** The options of this editor */
    options: TextEditorOptions;
    /** The column of this editor */
    readonly viewColumn: ViewColumn | undefined;
}

/**
 * Represents a text document.
 */
export interface TextDocument {
    /** The URI of the document */
    readonly uri: Uri;
    /** The file system path of the document */
    readonly fileName: string;
    /** Whether the document has been modified */
    readonly isDirty: boolean;
    /** Whether the document is untitled */
    readonly isUntitled: boolean;
    /** The language identifier of the document */
    readonly languageId: string;
    /** The version number of the document */
    readonly version: number;
    /** Whether the document has been closed */
    readonly isClosed: boolean;
    /** The number of lines in the document */
    readonly lineCount: number;
    
    /** Get a line at the given line number */
    lineAt(line: number): TextLine;
    /** Get the text of the document in a range */
    getText(range?: Range): string;
    /** Get the word range at a position */
    getWordRangeAtPosition(position: Position, regex?: RegExp): Range | undefined;
    /** Validate a position in the document */
    validatePosition(position: Position): Position;
    /** Validate a range in the document */
    validateRange(range: Range): Range;
    /** Get the position at a character offset */
    positionAt(offset: number): Position;
    /** Get the character offset at a position */
    offsetAt(position: Position): number;
}

/**
 * Represents a line of text in a document.
 */
export interface TextLine {
    /** The line number (zero-based) */
    readonly lineNumber: number;
    /** The text of the line */
    readonly text: string;
    /** The range of the line (excluding line break) */
    readonly range: Range;
    /** The range of the line (including line break) */
    readonly rangeIncludingLineBreak: Range;
    /** The offset of the first non-whitespace character */
    readonly firstNonWhitespaceCharacterIndex: number;
    /** Whether the line is empty or contains only whitespace */
    readonly isEmptyOrWhitespace: boolean;
}

/**
 * Represents a position in a document.
 */
export interface Position {
    /** The zero-based line value */
    readonly line: number;
    /** The zero-based character value */
    readonly character: number;
    
    /** Check if this position is before another */
    isBefore(other: Position): boolean;
    /** Check if this position is before or equal to another */
    isBeforeOrEqual(other: Position): boolean;
    /** Check if this position is after another */
    isAfter(other: Position): boolean;
    /** Check if this position is after or equal to another */
    isAfterOrEqual(other: Position): boolean;
    /** Check if this position is equal to another */
    isEqual(other: Position): boolean;
    /** Compare this position to another */
    compareTo(other: Position): number;
    /** Create a new position relative to this position */
    translate(lineDelta?: number, characterDelta?: number): Position;
    /** Create a new position with the given line and/or character */
    with(line?: number, character?: number): Position;
}

/**
 * Represents a range of text in a document.
 */
export interface Range {
    /** The start position */
    readonly start: Position;
    /** The end position */
    readonly end: Position;
    /** Whether the range is empty (start equals end) */
    readonly isEmpty: boolean;
    /** Whether the range spans a single line */
    readonly isSingleLine: boolean;
    
    /** Check if a position or range is contained within this range */
    contains(positionOrRange: Position | Range): boolean;
    /** Check if this range is equal to another */
    isEqual(other: Range): boolean;
    /** Get the intersection of this range with another */
    intersection(range: Range): Range | undefined;
    /** Get the union of this range with another */
    union(other: Range): Range;
    /** Create a new range with a different start and/or end */
    with(start?: Position, end?: Position): Range;
}

/**
 * Represents a selection in an editor.
 */
export interface Selection extends Range {
    /** The position where the selection starts */
    readonly anchor: Position;
    /** The position of the cursor */
    readonly active: Position;
    /** Whether the selection is reversed (active before anchor) */
    readonly isReversed: boolean;
}

/**
 * Text editor options.
 */
export interface TextEditorOptions {
    /** The tab size */
    tabSize?: number | string;
    /** Whether to insert spaces for tabs */
    insertSpaces?: boolean | string;
    /** The cursor style */
    cursorStyle?: number;
    /** The line numbers style */
    lineNumbers?: number;
}

/**
 * Represents a view column in the editor.
 */
export enum ViewColumn {
    Active = -1,
    Beside = -2,
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9
}

// ============================================================================
// Chat Types
// ============================================================================

/**
 * A chat participant that can respond to chat requests.
 */
export interface ChatParticipant extends Disposable {
    /** The unique identifier of the participant */
    readonly id: string;
    /** The icon path for the participant */
    iconPath?: Uri | { light: Uri; dark: Uri } | ThemeIcon;
    /** Handler for follow-up provider */
    followupProvider?: ChatFollowupProvider;
}

/**
 * A chat request from the user.
 */
export interface ChatRequest {
    /** The prompt text */
    readonly prompt: string;
    /** The command (slash command) if any */
    readonly command: string | undefined;
    /** References included in the request */
    readonly references: readonly ChatPromptReference[];
}

/**
 * A reference in a chat prompt.
 */
export interface ChatPromptReference {
    /** The identifier of the reference */
    readonly id: string;
    /** The value of the reference */
    readonly value: Uri | { uri: Uri; range: Range } | string;
}

/**
 * Context for a chat request.
 */
export interface ChatContext {
    /** The history of the conversation */
    readonly history: readonly (ChatRequestTurn | ChatResponseTurn)[];
}

/**
 * A request turn in chat history.
 */
export interface ChatRequestTurn {
    /** The prompt text */
    readonly prompt: string;
    /** The command (slash command) if any */
    readonly command: string | undefined;
    /** The participant ID */
    readonly participant: string;
    /** References in the request */
    readonly references: readonly ChatPromptReference[];
}

/**
 * A response turn in chat history.
 */
export interface ChatResponseTurn {
    /** The participant ID */
    readonly participant: string;
    /** The command (slash command) if any */
    readonly command: string | undefined;
    /** The response parts */
    readonly response: readonly ChatResponsePart[];
}

/**
 * A part of a chat response.
 */
export interface ChatResponsePart {
    /** The value of the part */
    value: string | ChatResponseMarkdownPart | ChatResponseFileTreePart | ChatResponseAnchorPart;
}

/**
 * A markdown part of a chat response.
 */
export interface ChatResponseMarkdownPart {
    /** The markdown content */
    value: string;
}

/**
 * A file tree part of a chat response.
 */
export interface ChatResponseFileTreePart {
    /** The root of the file tree */
    value: ChatResponseFileTree[];
}

/**
 * A node in a chat response file tree.
 */
export interface ChatResponseFileTree {
    /** The name of the file or folder */
    name: string;
    /** Child nodes (for folders) */
    children?: ChatResponseFileTree[];
}

/**
 * An anchor part of a chat response.
 */
export interface ChatResponseAnchorPart {
    /** The value (URI or location) */
    value: Uri | { uri: Uri; range: Range };
    /** The display title */
    title?: string;
}

/**
 * A stream for building chat responses.
 */
export interface ChatResponseStream {
    /** Push markdown content */
    markdown(value: string): void;
    /** Push an anchor (link to file/location) */
    anchor(value: Uri | { uri: Uri; range: Range }, title?: string): void;
    /** Push a button */
    button(command: Command): void;
    /** Push a file tree */
    filetree(value: ChatResponseFileTree[], baseUri: Uri): void;
    /** Push a progress message */
    progress(value: string): void;
    /** Push a reference */
    reference(value: Uri | { uri: Uri; range: Range }): void;
    /** Push a warning message */
    warning(value: string): void;
    /** Push arbitrary content */
    push(part: ChatResponsePart): void;
}

/**
 * Handler for chat requests.
 */
export type ChatRequestHandler = (
    request: ChatRequest,
    context: ChatContext,
    stream: ChatResponseStream,
    token: CancellationToken
) => Promise<ChatResult | void>;

/**
 * The result of a chat request.
 */
export interface ChatResult {
    /** Metadata about the result */
    metadata?: { [key: string]: any };
    /** Error details if the request failed */
    errorDetails?: ChatErrorDetails;
}

/**
 * Error details for a failed chat request.
 */
export interface ChatErrorDetails {
    /** The error message */
    message: string;
    /** Whether the response is incomplete */
    responseIsIncomplete?: boolean;
    /** Whether the response was filtered */
    responseIsFiltered?: boolean;
}

/**
 * A provider for chat follow-ups.
 */
export interface ChatFollowupProvider {
    /** Provide follow-ups for a chat result */
    provideFollowups(
        result: ChatResult,
        context: ChatContext,
        token: CancellationToken
    ): Promise<ChatFollowup[]>;
}

/**
 * A follow-up suggestion for a chat response.
 */
export interface ChatFollowup {
    /** The prompt for the follow-up */
    prompt: string;
    /** The label to display */
    label?: string;
    /** The command for the follow-up */
    command?: string;
}

/**
 * A cancellation token.
 */
export interface CancellationToken {
    /** Whether cancellation has been requested */
    readonly isCancellationRequested: boolean;
    /** Event fired when cancellation is requested */
    readonly onCancellationRequested: Event<void>;
}

// ============================================================================
// Extension Context Types
// ============================================================================

/**
 * The extension context provided by the IDE.
 */
export interface ExtensionContext {
    /** The absolute file path of the extension's directory */
    readonly extensionPath: string;
    /** The URI of the extension's directory */
    readonly extensionUri: Uri;
    /** The absolute file path of a workspace-specific directory for the extension */
    readonly storagePath: string | undefined;
    /** The URI of the workspace-specific directory */
    readonly storageUri: Uri | undefined;
    /** The absolute file path of a global directory for the extension */
    readonly globalStoragePath: string;
    /** The URI of the global directory */
    readonly globalStorageUri: Uri;
    /** The absolute file path for logging */
    readonly logPath: string;
    /** The URI for logging */
    readonly logUri: Uri;
    /** The mode the extension is running in */
    readonly extensionMode: ExtensionMode;
    /** An array to which disposables can be added */
    subscriptions: Disposable[];
    /** A memento for workspace state */
    readonly workspaceState: Memento;
    /** A memento for global state */
    readonly globalState: Memento & { setKeysForSync(keys: readonly string[]): void };
    /** Secret storage for sensitive data */
    readonly secrets: SecretStorage;
    /** The extension itself */
    readonly extension: Extension;
}

/**
 * The mode the extension is running in.
 */
export enum ExtensionMode {
    Production = 1,
    Development = 2,
    Test = 3
}

/**
 * A memento for persisting state.
 */
export interface Memento {
    /** Get all keys in the memento */
    keys(): readonly string[];
    /** Get a value from the memento */
    get<T>(key: string): T | undefined;
    /** Get a value from the memento with a default */
    get<T>(key: string, defaultValue: T): T;
    /** Update a value in the memento */
    update(key: string, value: any): Promise<void>;
}

/**
 * Secret storage for sensitive data.
 */
export interface SecretStorage {
    /** Get a secret */
    get(key: string): Promise<string | undefined>;
    /** Store a secret */
    store(key: string, value: string): Promise<void>;
    /** Delete a secret */
    delete(key: string): Promise<void>;
    /** Event fired when a secret changes */
    onDidChange: Event<SecretStorageChangeEvent>;
}

/**
 * Event for secret storage changes.
 */
export interface SecretStorageChangeEvent {
    /** The key that changed */
    readonly key: string;
}

/**
 * Represents an extension.
 */
export interface Extension {
    /** The unique identifier of the extension */
    readonly id: string;
    /** The URI of the extension's directory */
    readonly extensionUri: Uri;
    /** The extension's kind (UI, workspace, or unknown) */
    readonly extensionKind: ExtensionKind;
    /** Whether the extension is active */
    readonly isActive: boolean;
    /** The package.json of the extension */
    readonly packageJSON: any;
    /** The exports of the extension (if any) */
    readonly exports: any;
    /** Activate the extension */
    activate(): Promise<any>;
}

/**
 * The kind of extension.
 */
export enum ExtensionKind {
    UI = 1,
    Workspace = 2
}

// ============================================================================
// Output Channel Types
// ============================================================================

/**
 * An output channel for displaying output.
 */
export interface OutputChannel extends Disposable {
    /** The name of the output channel */
    readonly name: string;
    /** Append text to the output channel */
    append(value: string): void;
    /** Append a line to the output channel */
    appendLine(value: string): void;
    /** Replace all content in the output channel */
    replace(value: string): void;
    /** Clear the output channel */
    clear(): void;
    /** Show the output channel */
    show(preserveFocus?: boolean): void;
    /** Hide the output channel */
    hide(): void;
}

// ============================================================================
// Platform Name Type
// ============================================================================

/**
 * The supported platform names.
 */
export type PlatformName = 'vscode' | 'antigravity' | 'unknown';
