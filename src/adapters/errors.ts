/**
 * Platform Adapter Error Definitions
 * 
 * This module defines error classes for platform adapter operations.
 * These errors provide clear, actionable feedback when platform-specific
 * features are unavailable or fail.
 * 
 * @module adapters/errors
 */

import type { PlatformName } from './types';

/**
 * Base error class for all adapter-related errors.
 * Provides consistent error structure with platform context.
 */
export class AdapterError extends Error {
    /** The name of the platform where the error occurred */
    public readonly platformName: PlatformName;
    
    /** The platform version (if available) */
    public readonly platformVersion: string;
    
    /** Optional suggestion for resolving the error */
    public readonly suggestion?: string;
    
    /** The underlying error that caused this error (if any) */
    public readonly underlyingError?: Error;
    
    /** Unique error code for programmatic handling */
    public readonly code: string;
    
    /**
     * Creates a new AdapterError.
     * @param message The error message
     * @param code Unique error code
     * @param platformName The platform where the error occurred
     * @param platformVersion The version of the platform
     * @param options Additional error options
     */
    constructor(
        message: string,
        code: string,
        platformName: PlatformName,
        platformVersion: string = 'unknown',
        options?: {
            suggestion?: string;
            underlyingError?: Error;
        }
    ) {
        super(message);
        this.name = 'AdapterError';
        this.code = code;
        this.platformName = platformName;
        this.platformVersion = platformVersion;
        this.suggestion = options?.suggestion;
        this.underlyingError = options?.underlyingError;
        
        // Maintains proper stack trace for where the error was thrown (V8 engines)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AdapterError);
        }
    }
    
    /**
     * Returns a formatted string representation of the error.
     */
    public toString(): string {
        let result = `[${this.code}] ${this.message} (Platform: ${this.platformName} v${this.platformVersion})`;
        if (this.suggestion) {
            result += `\n  Suggestion: ${this.suggestion}`;
        }
        if (this.underlyingError) {
            result += `\n  Caused by: ${this.underlyingError.message}`;
        }
        return result;
    }
    
    /**
     * Returns a JSON representation of the error for logging.
     */
    public toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            platformName: this.platformName,
            platformVersion: this.platformVersion,
            suggestion: this.suggestion,
            underlyingError: this.underlyingError?.message,
            stack: this.stack
        };
    }
}

/**
 * Error thrown when a platform feature is not available.
 * This is used for graceful degradation when a feature exists on one
 * platform but not another.
 */
export class PlatformFeatureUnavailableError extends AdapterError {
    /** The name of the unavailable feature */
    public readonly featureName: string;
    
    /**
     * Creates a new PlatformFeatureUnavailableError.
     * @param featureName The name of the unavailable feature
     * @param platformName The platform that doesn't support the feature
     * @param platformVersion The version of the platform
     * @param suggestion Optional suggestion for an alternative approach
     */
    constructor(
        featureName: string,
        platformName: PlatformName,
        platformVersion: string = 'unknown',
        suggestion?: string
    ) {
        const message = `Feature "${featureName}" is not available on ${platformName}`;
        super(
            message,
            'PLATFORM_FEATURE_UNAVAILABLE',
            platformName,
            platformVersion,
            { suggestion }
        );
        this.name = 'PlatformFeatureUnavailableError';
        this.featureName = featureName;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, PlatformFeatureUnavailableError);
        }
    }
}

/**
 * Error thrown when adapter initialization fails.
 * This typically occurs during extension activation if the platform
 * adapter cannot be properly instantiated.
 */
export class AdapterInitializationError extends AdapterError {
    /** The phase of initialization that failed */
    public readonly phase: 'detection' | 'instantiation' | 'configuration';
    
    /**
     * Creates a new AdapterInitializationError.
     * @param message The error message
     * @param phase The phase of initialization that failed
     * @param platformName The platform (if known) or 'unknown'
     * @param options Additional error options
     */
    constructor(
        message: string,
        phase: 'detection' | 'instantiation' | 'configuration',
        platformName: PlatformName = 'unknown',
        options?: {
            suggestion?: string;
            underlyingError?: Error;
        }
    ) {
        super(
            message,
            'ADAPTER_INITIALIZATION_FAILED',
            platformName,
            'unknown',
            options
        );
        this.name = 'AdapterInitializationError';
        this.phase = phase;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AdapterInitializationError);
        }
    }
}

/**
 * Error thrown when an adapter method fails during execution.
 * Wraps platform-specific errors with additional context.
 */
export class AdapterMethodError extends AdapterError {
    /** The name of the method that failed */
    public readonly methodName: string;
    
    /** The arguments passed to the method (for debugging) */
    public readonly methodArgs?: unknown[];
    
    /**
     * Creates a new AdapterMethodError.
     * @param methodName The name of the method that failed
     * @param platformName The platform where the error occurred
     * @param platformVersion The version of the platform
     * @param underlyingError The original error from the platform API
     * @param methodArgs The arguments passed to the method
     */
    constructor(
        methodName: string,
        platformName: PlatformName,
        platformVersion: string,
        underlyingError: Error,
        methodArgs?: unknown[]
    ) {
        const message = `Method "${methodName}" failed on ${platformName}: ${underlyingError.message}`;
        super(
            message,
            'ADAPTER_METHOD_FAILED',
            platformName,
            platformVersion,
            { underlyingError }
        );
        this.name = 'AdapterMethodError';
        this.methodName = methodName;
        this.methodArgs = methodArgs;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AdapterMethodError);
        }
    }
}

/**
 * Error thrown when environment detection is ambiguous or fails.
 * This may occur if both VS Code and Antigravity globals are present
 * or if neither is detected.
 */
export class EnvironmentDetectionError extends AdapterError {
    /** The environments that were detected (may be empty or multiple) */
    public readonly detectedEnvironments: PlatformName[];
    
    /**
     * Creates a new EnvironmentDetectionError.
     * @param message The error message
     * @param detectedEnvironments The environments that were detected
     * @param suggestion Suggestion for resolving the ambiguity
     */
    constructor(
        message: string,
        detectedEnvironments: PlatformName[],
        suggestion?: string
    ) {
        super(
            message,
            'ENVIRONMENT_DETECTION_FAILED',
            'unknown',
            'unknown',
            { suggestion }
        );
        this.name = 'EnvironmentDetectionError';
        this.detectedEnvironments = detectedEnvironments;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, EnvironmentDetectionError);
        }
    }
}

/**
 * Error thrown when a file system operation fails.
 * Provides additional context about the file and operation.
 */
export class FileSystemOperationError extends AdapterError {
    /** The operation that failed */
    public readonly operation: 'read' | 'write' | 'delete' | 'stat' | 'mkdir' | 'readdir';
    
    /** The URI or path of the file/directory */
    public readonly filePath: string;
    
    /**
     * Creates a new FileSystemOperationError.
     * @param operation The operation that failed
     * @param filePath The path of the file or directory
     * @param platformName The platform where the error occurred
     * @param platformVersion The version of the platform
     * @param underlyingError The original file system error
     */
    constructor(
        operation: 'read' | 'write' | 'delete' | 'stat' | 'mkdir' | 'readdir',
        filePath: string,
        platformName: PlatformName,
        platformVersion: string,
        underlyingError: Error
    ) {
        const message = `File system ${operation} failed for "${filePath}": ${underlyingError.message}`;
        super(
            message,
            'FILE_SYSTEM_OPERATION_FAILED',
            platformName,
            platformVersion,
            { underlyingError }
        );
        this.name = 'FileSystemOperationError';
        this.operation = operation;
        this.filePath = filePath;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FileSystemOperationError);
        }
    }
}

/**
 * Error thrown when a configuration operation fails.
 */
export class ConfigurationError extends AdapterError {
    /** The configuration key involved */
    public readonly configKey: string;
    
    /** The operation that failed */
    public readonly operation: 'get' | 'update' | 'inspect';
    
    /**
     * Creates a new ConfigurationError.
     * @param configKey The configuration key
     * @param operation The operation that failed
     * @param platformName The platform where the error occurred
     * @param platformVersion The version of the platform
     * @param underlyingError The original error
     */
    constructor(
        configKey: string,
        operation: 'get' | 'update' | 'inspect',
        platformName: PlatformName,
        platformVersion: string,
        underlyingError?: Error
    ) {
        const message = `Configuration ${operation} failed for key "${configKey}"${underlyingError ? `: ${underlyingError.message}` : ''}`;
        super(
            message,
            'CONFIGURATION_OPERATION_FAILED',
            platformName,
            platformVersion,
            { underlyingError }
        );
        this.name = 'ConfigurationError';
        this.configKey = configKey;
        this.operation = operation;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ConfigurationError);
        }
    }
}

/**
 * Error thrown when a chat operation fails.
 */
export class ChatOperationError extends AdapterError {
    /** The chat operation that failed */
    public readonly operation: 'createParticipant' | 'sendMessage' | 'streamResponse';
    
    /**
     * Creates a new ChatOperationError.
     * @param operation The chat operation that failed
     * @param platformName The platform where the error occurred
     * @param platformVersion The version of the platform
     * @param underlyingError The original error
     * @param suggestion Suggestion for resolving the error
     */
    constructor(
        operation: 'createParticipant' | 'sendMessage' | 'streamResponse',
        platformName: PlatformName,
        platformVersion: string,
        underlyingError?: Error,
        suggestion?: string
    ) {
        const message = `Chat ${operation} failed${underlyingError ? `: ${underlyingError.message}` : ''}`;
        super(
            message,
            'CHAT_OPERATION_FAILED',
            platformName,
            platformVersion,
            { underlyingError, suggestion }
        );
        this.name = 'ChatOperationError';
        this.operation = operation;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ChatOperationError);
        }
    }
}

/**
 * Type guard to check if an error is an AdapterError.
 * @param error The error to check
 * @returns True if the error is an AdapterError
 */
export function isAdapterError(error: unknown): error is AdapterError {
    return error instanceof AdapterError;
}

/**
 * Type guard to check if an error is a PlatformFeatureUnavailableError.
 * @param error The error to check
 * @returns True if the error is a PlatformFeatureUnavailableError
 */
export function isPlatformFeatureUnavailableError(error: unknown): error is PlatformFeatureUnavailableError {
    return error instanceof PlatformFeatureUnavailableError;
}

/**
 * Type guard to check if an error is an AdapterInitializationError.
 * @param error The error to check
 * @returns True if the error is an AdapterInitializationError
 */
export function isAdapterInitializationError(error: unknown): error is AdapterInitializationError {
    return error instanceof AdapterInitializationError;
}

/**
 * Type guard to check if an error is an EnvironmentDetectionError.
 * @param error The error to check
 * @returns True if the error is an EnvironmentDetectionError
 */
export function isEnvironmentDetectionError(error: unknown): error is EnvironmentDetectionError {
    return error instanceof EnvironmentDetectionError;
}
