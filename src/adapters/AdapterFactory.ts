/**
 * Adapter Factory with Environment Detection
 * 
 * This module provides the central factory for creating platform adapters.
 * It automatically detects the runtime environment (VS Code or Antigravity)
 * and instantiates the appropriate adapter implementation.
 * 
 * The factory uses a singleton pattern to ensure consistent adapter usage
 * throughout the extension lifecycle.
 * 
 * @module adapters/AdapterFactory
 */

import type { IPlatformAdapter, PlatformCapabilities, PlatformMetadata } from './IPlatformAdapter';
import type { ExtensionContext, PlatformName } from './types';
import { EnvironmentDetectionError, AdapterInitializationError } from './errors';

// ============================================================================
// Environment Detection Types
// ============================================================================

/**
 * Result of environment detection with timing information.
 */
export interface EnvironmentDetectionResult {
    /** The detected platform name */
    platform: PlatformName;
    
    /** The detected platform version */
    version: string;
    
    /** Whether the detection was successful or used fallback */
    success: boolean;
    
    /** Time taken for detection in milliseconds */
    detectionTimeMs: number;
    
    /** Additional detection details for debugging */
    details: {
        vsCodeDetected: boolean;
        antigravityDetected: boolean;
        fallbackUsed: boolean;
        warningMessage?: string;
    };
}

/**
 * Options for adapter factory configuration.
 */
export interface AdapterFactoryOptions {
    /** Whether to suppress warning logs (useful for testing) */
    suppressWarnings?: boolean;
    
    /** Custom logger function */
    logger?: (message: string, level: 'info' | 'warn' | 'error') => void;
    
    /** Force a specific platform (for testing) */
    forcePlatform?: PlatformName;
}

// ============================================================================
// Default Capabilities
// ============================================================================

/**
 * Default capabilities for VS Code platform.
 * All features are supported.
 */
const VSCODE_CAPABILITIES: PlatformCapabilities = {
    supportsChatParticipants: true,
    supportsTreeViews: true,
    supportsFileSystemWatchers: true,
    supportsCustomEditors: true,
    supportsWebviews: true,
    supportsStatusBar: true,
    supportsOutputChannels: true
};

/**
 * Default capabilities for Antigravity platform.
 * Assume similar capabilities until we know more about the API.
 */
const ANTIGRAVITY_CAPABILITIES: PlatformCapabilities = {
    supportsChatParticipants: true, // Assumed available
    supportsTreeViews: true,
    supportsFileSystemWatchers: true,
    supportsCustomEditors: false, // May not be available
    supportsWebviews: true,
    supportsStatusBar: true,
    supportsOutputChannels: true
};

/**
 * Minimal capabilities for unknown platform.
 * Only basic features assumed to work.
 */
const UNKNOWN_CAPABILITIES: PlatformCapabilities = {
    supportsChatParticipants: false,
    supportsTreeViews: false,
    supportsFileSystemWatchers: false,
    supportsCustomEditors: false,
    supportsWebviews: false,
    supportsStatusBar: false,
    supportsOutputChannels: false
};

// ============================================================================
// Adapter Factory
// ============================================================================

/**
 * Factory class for creating and managing platform adapters.
 * 
 * This class handles:
 * - Automatic environment detection (VS Code vs Antigravity)
 * - Singleton adapter instance management
 * - Graceful fallback handling
 * - Performance monitoring for detection
 * 
 * @example
 * ```typescript
 * // In extension.ts activate function:
 * import { AdapterFactory } from './adapters/AdapterFactory';
 * 
 * export async function activate(context: vscode.ExtensionContext) {
 *     try {
 *         const adapter = await AdapterFactory.getAdapter(context);
 *         console.log(`Running on ${adapter.platformName} v${adapter.version}`);
 *         
 *         // Use adapter for all platform operations
 *         await adapter.showInformationMessage('Extension activated!');
 *     } catch (error) {
 *         console.error('Failed to initialize adapter:', error);
 *     }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // For testing, reset between tests:
 * beforeEach(() => {
 *     AdapterFactory.reset();
 * });
 * ```
 */
export class AdapterFactory {
    // ========================================================================
    // Private State
    // ========================================================================
    
    /** Singleton adapter instance */
    private static adapter: IPlatformAdapter | undefined;
    
    /** Cached detection result */
    private static detectionResult: EnvironmentDetectionResult | undefined;
    
    /** Factory options */
    private static options: AdapterFactoryOptions = {};
    
    /** Maximum allowed detection time in milliseconds */
    private static readonly MAX_DETECTION_TIME_MS = 50;
    
    // ========================================================================
    // Private Constructor (Prevent Instantiation)
    // ========================================================================
    
    /**
     * Private constructor to prevent instantiation.
     * Use static methods instead.
     */
    private constructor() {
        // This class is a static factory and should not be instantiated
    }
    
    // ========================================================================
    // Public API
    // ========================================================================
    
    /**
     * Gets or creates the platform adapter.
     * 
     * On first call, this method:
     * 1. Detects the runtime environment
     * 2. Instantiates the appropriate adapter
     * 3. Caches the adapter for subsequent calls
     * 
     * Subsequent calls return the cached adapter immediately.
     * 
     * @param context The extension context provided by the IDE
     * @param options Optional factory configuration
     * @returns The platform adapter (VSCodeAdapter or AntigravityAdapter)
     * @throws AdapterInitializationError if adapter creation fails
     * 
     * @example
     * ```typescript
     * const adapter = await AdapterFactory.getAdapter(context);
     * const folders = adapter.getWorkspaceFolders();
     * ```
     */
    public static async getAdapter(
        context: ExtensionContext,
        options?: AdapterFactoryOptions
    ): Promise<IPlatformAdapter> {
        // Merge options
        if (options) {
            this.options = { ...this.options, ...options };
        }
        
        // Return cached adapter if available
        if (this.adapter) {
            return this.adapter;
        }
        
        // Detect environment and create adapter
        const detection = this.detectEnvironment();
        this.detectionResult = detection;
        
        // Log detection results
        this.log(
            `Environment detected: ${detection.platform} v${detection.version} ` +
            `(${detection.detectionTimeMs.toFixed(2)}ms)`,
            'info'
        );
        
        // Check detection time
        if (detection.detectionTimeMs > this.MAX_DETECTION_TIME_MS) {
            this.log(
                `Environment detection took ${detection.detectionTimeMs.toFixed(2)}ms ` +
                `(exceeds ${this.MAX_DETECTION_TIME_MS}ms target)`,
                'warn'
            );
        }
        
        // Log warnings if any
        if (detection.details.warningMessage) {
            this.log(detection.details.warningMessage, 'warn');
        }
        
        // Create adapter based on detected platform
        try {
            this.adapter = await this.createAdapter(detection.platform, context);
            return this.adapter;
        } catch (error) {
            throw new AdapterInitializationError(
                `Failed to create adapter for platform '${detection.platform}'`,
                'instantiation', // phase
                detection.platform, // platformName
                {
                    suggestion: 'Please ensure the extension is running in a supported IDE',
                    underlyingError: error instanceof Error ? error : new Error(String(error))
                }
            );
        }
    }
    
    /**
     * Gets the adapter synchronously if it has already been initialized.
     * 
     * Use this method when you know the adapter has been created (e.g., after activation).
     * 
     * @returns The cached adapter, or undefined if not yet initialized
     * 
     * @example
     * ```typescript
     * const adapter = AdapterFactory.getAdapterSync();
     * if (adapter) {
     *     adapter.showInformationMessage('Hello!');
     * }
     * ```
     */
    public static getAdapterSync(): IPlatformAdapter | undefined {
        return this.adapter;
    }
    
    /**
     * Checks if the adapter has been initialized.
     * 
     * @returns true if the adapter has been created
     */
    public static isInitialized(): boolean {
        return this.adapter !== undefined;
    }
    
    /**
     * Gets the last environment detection result.
     * 
     * Useful for debugging and logging platform information.
     * 
     * @returns The detection result, or undefined if detection hasn't run
     */
    public static getDetectionResult(): EnvironmentDetectionResult | undefined {
        return this.detectionResult;
    }
    
    /**
     * Gets platform metadata including capabilities.
     * 
     * @returns Platform metadata, or undefined if not yet detected
     */
    public static getPlatformMetadata(): PlatformMetadata | undefined {
        if (!this.detectionResult) {
            return undefined;
        }
        
        return {
            name: this.detectionResult.platform,
            version: this.detectionResult.version,
            capabilities: this.getCapabilitiesForPlatform(this.detectionResult.platform)
        };
    }
    
    /**
     * Resets the factory state.
     * 
     * This method is primarily intended for testing, allowing tests to
     * run with a clean factory state.
     * 
     * **Warning**: Do not call this in production code as it will
     * invalidate all existing adapter references.
     * 
     * @example
     * ```typescript
     * // In test setup:
     * beforeEach(() => {
     *     AdapterFactory.reset();
     * });
     * ```
     */
    public static reset(): void {
        this.adapter = undefined;
        this.detectionResult = undefined;
        this.options = {};
    }
    
    /**
     * Configures factory options.
     * 
     * @param options The options to set
     */
    public static configure(options: AdapterFactoryOptions): void {
        this.options = { ...this.options, ...options };
    }
    
    // ========================================================================
    // Environment Detection
    // ========================================================================
    
    /**
     * Detects the current IDE environment.
     * 
     * This method checks for the presence of VS Code and Antigravity global
     * objects and their version properties. Detection is designed to complete
     * in under 50ms.
     * 
     * Detection logic:
     * 1. Check for VS Code: `typeof vscode !== 'undefined' && vscode.version`
     * 2. Check for Antigravity: `typeof antigravity !== 'undefined' && antigravity.version`
     * 3. If both detected (shouldn't happen), prefer VS Code with warning
     * 4. If neither detected, fall back to VS Code with warning
     * 
     * @returns The detection result with platform, version, and timing info
     */
    public static detectEnvironment(): EnvironmentDetectionResult {
        const startTime = performance.now();
        
        // Check if platform is forced (for testing)
        if (this.options.forcePlatform) {
            const endTime = performance.now();
            return {
                platform: this.options.forcePlatform,
                version: 'forced',
                success: true,
                detectionTimeMs: endTime - startTime,
                details: {
                    vsCodeDetected: false,
                    antigravityDetected: false,
                    fallbackUsed: false,
                    warningMessage: `Platform forced to '${this.options.forcePlatform}' (testing mode)`
                }
            };
        }
        
        // Perform actual detection
        const vsCodeDetected = this.isVSCodeEnvironment();
        const antigravityDetected = this.isAntigravityEnvironment();
        
        let platform: PlatformName;
        let version: string;
        let success = true;
        let fallbackUsed = false;
        let warningMessage: string | undefined;
        
        if (vsCodeDetected && antigravityDetected) {
            // Both detected - unusual situation, prefer VS Code
            platform = 'vscode';
            version = this.getVSCodeVersion();
            warningMessage = 'Both VS Code and Antigravity environments detected. Using VS Code.';
        } else if (vsCodeDetected) {
            // VS Code detected
            platform = 'vscode';
            version = this.getVSCodeVersion();
        } else if (antigravityDetected) {
            // Antigravity detected
            platform = 'antigravity';
            version = this.getAntigravityVersion();
        } else {
            // Neither detected - fall back to VS Code with warning
            platform = 'vscode';
            version = 'unknown';
            success = false;
            fallbackUsed = true;
            warningMessage = 
                'Could not detect IDE environment. Defaulting to VS Code mode. ' +
                'Some features may not work correctly.';
        }
        
        const endTime = performance.now();
        
        return {
            platform,
            version,
            success,
            detectionTimeMs: endTime - startTime,
            details: {
                vsCodeDetected,
                antigravityDetected,
                fallbackUsed,
                warningMessage
            }
        };
    }
    
    // ========================================================================
    // Private Helper Methods
    // ========================================================================
    
    /**
     * Checks if the current environment is VS Code.
     */
    private static isVSCodeEnvironment(): boolean {
        try {
            // In VS Code extensions, the vscode module is available via require
            // Check if we can access it
            const vscodeModule = this.tryRequireVSCode();
            return vscodeModule !== undefined && typeof vscodeModule.version === 'string';
        } catch {
            return false;
        }
    }
    
    /**
     * Checks if the current environment is Antigravity.
     */
    private static isAntigravityEnvironment(): boolean {
        try {
            // Check for Antigravity global object
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const globalAntigravity = (globalThis as any).antigravity;
            return globalAntigravity !== undefined && typeof globalAntigravity.version === 'string';
        } catch {
            return false;
        }
    }
    
    /**
     * Attempts to require the vscode module.
     * Returns the module if successful, undefined otherwise.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static tryRequireVSCode(): any {
        try {
            // Use dynamic require to avoid bundling issues
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            return require('vscode');
        } catch {
            return undefined;
        }
    }
    
    /**
     * Gets the VS Code version string.
     */
    private static getVSCodeVersion(): string {
        try {
            const vscodeModule = this.tryRequireVSCode();
            return vscodeModule?.version || 'unknown';
        } catch {
            return 'unknown';
        }
    }
    
    /**
     * Gets the Antigravity version string.
     */
    private static getAntigravityVersion(): string {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const globalAntigravity = (globalThis as any).antigravity;
            return globalAntigravity?.version || 'unknown';
        } catch {
            return 'unknown';
        }
    }
    
    /**
     * Gets platform capabilities for a given platform.
     */
    private static getCapabilitiesForPlatform(platform: PlatformName): PlatformCapabilities {
        switch (platform) {
            case 'vscode':
                return { ...VSCODE_CAPABILITIES };
            case 'antigravity':
                return { ...ANTIGRAVITY_CAPABILITIES };
            default:
                return { ...UNKNOWN_CAPABILITIES };
        }
    }
    
    /**
     * Creates the appropriate adapter for the detected platform.
     */
    private static async createAdapter(
        platform: PlatformName,
        context: ExtensionContext
    ): Promise<IPlatformAdapter> {
        switch (platform) {
            case 'vscode': {
                // Dynamic import to avoid loading unnecessary modules
                const { VSCodeAdapter } = await import('./VSCodeAdapter');
                return new VSCodeAdapter(context);
            }
            case 'antigravity': {
                // Dynamic import for Antigravity adapter
                const { AntigravityAdapter } = await import('./AntigravityAdapter');
                return new AntigravityAdapter(context);
            }
            default: {
                // Unknown platform - throw error with guidance
                throw new EnvironmentDetectionError(
                    `Unsupported platform: ${platform}`,
                    [platform], // detectedEnvironments array
                    'The extension only supports VS Code and Antigravity IDE.'
                );
            }
        }
    }
    
    /**
     * Logs a message using the configured logger or console.
     */
    private static log(message: string, level: 'info' | 'warn' | 'error'): void {
        if (this.options.suppressWarnings && level === 'warn') {
            return;
        }
        
        const prefix = '[AdapterFactory]';
        
        if (this.options.logger) {
            this.options.logger(`${prefix} ${message}`, level);
        } else {
            switch (level) {
                case 'info':
                    console.log(`${prefix} ${message}`);
                    break;
                case 'warn':
                    console.warn(`${prefix} ${message}`);
                    break;
                case 'error':
                    console.error(`${prefix} ${message}`);
                    break;
            }
        }
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Convenience function to get the platform adapter.
 * 
 * This is a shorthand for `AdapterFactory.getAdapter(context)`.
 * 
 * @param context The extension context
 * @param options Optional factory configuration
 * @returns The platform adapter
 * 
 * @example
 * ```typescript
 * import { getAdapter } from './adapters/AdapterFactory';
 * 
 * const adapter = await getAdapter(context);
 * ```
 */
export async function getAdapter(
    context: ExtensionContext,
    options?: AdapterFactoryOptions
): Promise<IPlatformAdapter> {
    return AdapterFactory.getAdapter(context, options);
}

/**
 * Convenience function to detect the environment without creating an adapter.
 * 
 * @returns The environment detection result
 * 
 * @example
 * ```typescript
 * import { detectEnvironment } from './adapters/AdapterFactory';
 * 
 * const result = detectEnvironment();
 * console.log(`Detected: ${result.platform} v${result.version}`);
 * ```
 */
export function detectEnvironment(): EnvironmentDetectionResult {
    return AdapterFactory.detectEnvironment();
}
