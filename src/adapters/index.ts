/**
 * Platform Adapters - Main Export Module
 * 
 * This module serves as the main entry point for all platform adapter types,
 * interfaces, and utilities. Import from this module to access:
 * 
 * - Platform-agnostic type definitions (Uri, Disposable, Configuration, etc.)
 * - Error classes for adapter operations (AdapterError, PlatformFeatureUnavailableError, etc.)
 * - Type guards for error handling
 * 
 * @example
 * ```typescript
 * import { 
 *     IPlatformAdapter, 
 *     AdapterError,
 *     isAdapterError,
 *     Uri,
 *     Disposable 
 * } from './adapters';
 * ```
 * 
 * @module adapters
 */

// ============================================================================
// Type Definitions
// ============================================================================

// Core types
export type {
    Uri,
    UriFactory,
    Disposable,
    Event,
    EventEmitter,
    PlatformName
} from './types';

// Input/Output types
export type {
    InputBoxOptions,
    QuickPickItem,
    QuickPickOptions
} from './types';

// UI Component types
export {
    StatusBarAlignment,
    TreeItemCollapsibleState,
    ViewColumn
} from './types';

export type {
    StatusBarItem,
    TreeItem,
    ThemeIcon,
    ThemeColor,
    TreeDataProvider,
    Command
} from './types';

// Configuration types
export {
    ConfigurationTarget
} from './types';

export type {
    Configuration,
    ConfigurationInspection,
    ConfigurationChangeEvent
} from './types';

// File System types
export {
    FileType,
    FilePermission
} from './types';

export type {
    FileStat,
    FileSystemWatcher
} from './types';

// Workspace types
export type {
    WorkspaceFolder
} from './types';

// Editor types
export type {
    TextEditor,
    TextDocument,
    TextLine,
    Position,
    Range,
    Selection,
    TextEditorOptions
} from './types';

// Chat types
export type {
    ChatParticipant,
    ChatRequest,
    ChatPromptReference,
    ChatContext,
    ChatRequestTurn,
    ChatResponseTurn,
    ChatResponsePart,
    ChatResponseMarkdownPart,
    ChatResponseFileTreePart,
    ChatResponseFileTree,
    ChatResponseAnchorPart,
    ChatResponseStream,
    ChatRequestHandler,
    ChatResult,
    ChatErrorDetails,
    ChatFollowupProvider,
    ChatFollowup,
    CancellationToken
} from './types';

// Extension context types
export {
    ExtensionMode,
    ExtensionKind
} from './types';

export type {
    ExtensionContext,
    Memento,
    SecretStorage,
    SecretStorageChangeEvent,
    Extension
} from './types';

// Output channel types
export type {
    OutputChannel
} from './types';

// ============================================================================
// Error Classes
// ============================================================================

export {
    AdapterError,
    PlatformFeatureUnavailableError,
    AdapterInitializationError,
    AdapterMethodError,
    EnvironmentDetectionError,
    FileSystemOperationError,
    ConfigurationError,
    ChatOperationError
} from './errors';

// Error type guards
export {
    isAdapterError,
    isPlatformFeatureUnavailableError,
    isAdapterInitializationError,
    isEnvironmentDetectionError
} from './errors';

// ============================================================================
// Platform Adapter Interface
// ============================================================================

export type {
    IPlatformAdapter,
    PlatformCapabilities,
    PlatformMetadata
} from './IPlatformAdapter';

// ============================================================================
// Adapter Factory
// ============================================================================

export {
    AdapterFactory,
    getAdapter,
    detectEnvironment
} from './AdapterFactory';

export type {
    EnvironmentDetectionResult,
    AdapterFactoryOptions
} from './AdapterFactory';
