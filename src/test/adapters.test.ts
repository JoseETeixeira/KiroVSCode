/**
 * Unit Tests for Platform Adapter Types and Errors
 * 
 * This module tests the platform-agnostic types and error classes
 * to ensure they behave correctly across all scenarios.
 */

import test from 'node:test';
import * as assert from 'assert';
import {
    AdapterError,
    PlatformFeatureUnavailableError,
    AdapterInitializationError,
    AdapterMethodError,
    EnvironmentDetectionError,
    FileSystemOperationError,
    ConfigurationError,
    ChatOperationError,
    isAdapterError,
    isPlatformFeatureUnavailableError,
    isAdapterInitializationError,
    isEnvironmentDetectionError
} from '../adapters/errors';

import {
    StatusBarAlignment,
    TreeItemCollapsibleState,
    ConfigurationTarget,
    FileType,
    FilePermission,
    ExtensionMode,
    ExtensionKind,
    ViewColumn
} from '../adapters/types';

/**
 * Test suite for AdapterError
 */
test('AdapterError should create an error with all properties', () => {
    const error = new AdapterError(
        'Test error message',
        'TEST_ERROR',
        'vscode',
        '1.85.0',
        {
            suggestion: 'Try this instead',
            underlyingError: new Error('Underlying cause')
        }
    );
    
    assert.strictEqual(error.message, 'Test error message');
    assert.strictEqual(error.code, 'TEST_ERROR');
    assert.strictEqual(error.platformName, 'vscode');
    assert.strictEqual(error.platformVersion, '1.85.0');
    assert.strictEqual(error.suggestion, 'Try this instead');
    assert.strictEqual(error.underlyingError?.message, 'Underlying cause');
    assert.strictEqual(error.name, 'AdapterError');
});

test('AdapterError should default platformVersion to unknown', () => {
    const error = new AdapterError('Test', 'TEST', 'antigravity');
    assert.strictEqual(error.platformVersion, 'unknown');
});

test('AdapterError should format toString correctly', () => {
    const error = new AdapterError(
        'Test error',
        'TEST_CODE',
        'vscode',
        '1.85.0',
        { suggestion: 'Fix it' }
    );
    
    const str = error.toString();
    assert.ok(str.includes('[TEST_CODE]'));
    assert.ok(str.includes('Test error'));
    assert.ok(str.includes('vscode'));
    assert.ok(str.includes('1.85.0'));
    assert.ok(str.includes('Suggestion: Fix it'));
});

test('AdapterError should serialize to JSON correctly', () => {
    const error = new AdapterError('Test', 'CODE', 'vscode', '1.0');
    const json = error.toJSON();
    
    assert.strictEqual(json.name, 'AdapterError');
    assert.strictEqual(json.code, 'CODE');
    assert.strictEqual(json.message, 'Test');
    assert.strictEqual(json.platformName, 'vscode');
});

/**
 * Test suite for PlatformFeatureUnavailableError
 */
test('PlatformFeatureUnavailableError should create error with feature name', () => {
    const error = new PlatformFeatureUnavailableError(
        'chatParticipants',
        'antigravity',
        '1.0.0',
        'Use command palette instead'
    );
    
    assert.strictEqual(error.featureName, 'chatParticipants');
    assert.strictEqual(error.platformName, 'antigravity');
    assert.strictEqual(error.code, 'PLATFORM_FEATURE_UNAVAILABLE');
    assert.strictEqual(error.name, 'PlatformFeatureUnavailableError');
    assert.ok(error.message.includes('chatParticipants'));
    assert.ok(error.message.includes('antigravity'));
});

/**
 * Test suite for AdapterInitializationError
 */
test('AdapterInitializationError should create error with phase', () => {
    const error = new AdapterInitializationError(
        'Failed to initialize',
        'detection',
        'unknown',
        { suggestion: 'Check platform' }
    );
    
    assert.strictEqual(error.phase, 'detection');
    assert.strictEqual(error.code, 'ADAPTER_INITIALIZATION_FAILED');
    assert.strictEqual(error.name, 'AdapterInitializationError');
});

test('AdapterInitializationError should support all phases', () => {
    const phases: Array<'detection' | 'instantiation' | 'configuration'> = 
        ['detection', 'instantiation', 'configuration'];
    
    for (const phase of phases) {
        const error = new AdapterInitializationError('Test', phase);
        assert.strictEqual(error.phase, phase);
    }
});

/**
 * Test suite for AdapterMethodError
 */
test('AdapterMethodError should wrap underlying error with method context', () => {
    const underlying = new Error('API call failed');
    const error = new AdapterMethodError(
        'showInputBox',
        'vscode',
        '1.85.0',
        underlying,
        [{ prompt: 'Enter value' }]
    );
    
    assert.strictEqual(error.methodName, 'showInputBox');
    assert.strictEqual(error.underlyingError, underlying);
    assert.deepStrictEqual(error.methodArgs, [{ prompt: 'Enter value' }]);
    assert.ok(error.message.includes('showInputBox'));
    assert.ok(error.message.includes('API call failed'));
});

/**
 * Test suite for EnvironmentDetectionError
 */
test('EnvironmentDetectionError should include detected environments', () => {
    const error = new EnvironmentDetectionError(
        'Ambiguous environment',
        ['vscode', 'antigravity'],
        'Set KIRO_PLATFORM environment variable'
    );
    
    assert.deepStrictEqual(error.detectedEnvironments, ['vscode', 'antigravity']);
    assert.strictEqual(error.platformName, 'unknown');
    assert.strictEqual(error.code, 'ENVIRONMENT_DETECTION_FAILED');
});

test('EnvironmentDetectionError should handle empty detection', () => {
    const error = new EnvironmentDetectionError(
        'No environment detected',
        []
    );
    
    assert.deepStrictEqual(error.detectedEnvironments, []);
});

/**
 * Test suite for FileSystemOperationError
 */
test('FileSystemOperationError should include operation and file path', () => {
    const underlying = new Error('ENOENT: no such file');
    const error = new FileSystemOperationError(
        'read',
        '/path/to/file.txt',
        'vscode',
        '1.85.0',
        underlying
    );
    
    assert.strictEqual(error.operation, 'read');
    assert.strictEqual(error.filePath, '/path/to/file.txt');
    assert.strictEqual(error.code, 'FILE_SYSTEM_OPERATION_FAILED');
    assert.ok(error.message.includes('read'));
    assert.ok(error.message.includes('/path/to/file.txt'));
});

test('FileSystemOperationError should support all operations', () => {
    const operations: Array<'read' | 'write' | 'delete' | 'stat' | 'mkdir' | 'readdir'> = 
        ['read', 'write', 'delete', 'stat', 'mkdir', 'readdir'];
    
    for (const op of operations) {
        const error = new FileSystemOperationError(
            op, '/test', 'vscode', '1.0', new Error('test')
        );
        assert.strictEqual(error.operation, op);
    }
});

/**
 * Test suite for ConfigurationError
 */
test('ConfigurationError should include config key and operation', () => {
    const error = new ConfigurationError(
        'kiroCopilot.mode',
        'update',
        'vscode',
        '1.85.0',
        new Error('Permission denied')
    );
    
    assert.strictEqual(error.configKey, 'kiroCopilot.mode');
    assert.strictEqual(error.operation, 'update');
    assert.strictEqual(error.code, 'CONFIGURATION_OPERATION_FAILED');
});

/**
 * Test suite for ChatOperationError
 */
test('ChatOperationError should include chat operation', () => {
    const error = new ChatOperationError(
        'createParticipant',
        'antigravity',
        '1.0.0',
        new Error('Chat not supported'),
        'Use inline completions instead'
    );
    
    assert.strictEqual(error.operation, 'createParticipant');
    assert.strictEqual(error.code, 'CHAT_OPERATION_FAILED');
    assert.strictEqual(error.suggestion, 'Use inline completions instead');
});

/**
 * Test suite for Type Guards
 */
test('isAdapterError should return true for AdapterError instances', () => {
    const error = new AdapterError('Test', 'CODE', 'vscode');
    assert.strictEqual(isAdapterError(error), true);
});

test('isAdapterError should return true for subclasses', () => {
    const error = new PlatformFeatureUnavailableError('feature', 'vscode');
    assert.strictEqual(isAdapterError(error), true);
});

test('isAdapterError should return false for regular errors', () => {
    const error = new Error('Regular error');
    assert.strictEqual(isAdapterError(error), false);
});

test('isAdapterError should return false for non-error values', () => {
    assert.strictEqual(isAdapterError(null), false);
    assert.strictEqual(isAdapterError(undefined), false);
    assert.strictEqual(isAdapterError('string'), false);
    assert.strictEqual(isAdapterError({}), false);
});

test('isPlatformFeatureUnavailableError should return true for correct type', () => {
    const error = new PlatformFeatureUnavailableError('feature', 'vscode');
    assert.strictEqual(isPlatformFeatureUnavailableError(error), true);
});

test('isPlatformFeatureUnavailableError should return false for other AdapterErrors', () => {
    const error = new AdapterError('Test', 'CODE', 'vscode');
    assert.strictEqual(isPlatformFeatureUnavailableError(error), false);
});

test('isAdapterInitializationError should return true for correct type', () => {
    const error = new AdapterInitializationError('Test', 'detection');
    assert.strictEqual(isAdapterInitializationError(error), true);
});

test('isAdapterInitializationError should return false for other errors', () => {
    const error = new AdapterError('Test', 'CODE', 'vscode');
    assert.strictEqual(isAdapterInitializationError(error), false);
});

test('isEnvironmentDetectionError should return true for correct type', () => {
    const error = new EnvironmentDetectionError('Test', []);
    assert.strictEqual(isEnvironmentDetectionError(error), true);
});

test('isEnvironmentDetectionError should return false for other errors', () => {
    const error = new AdapterError('Test', 'CODE', 'vscode');
    assert.strictEqual(isEnvironmentDetectionError(error), false);
});

/**
 * Test suite for Enum Values
 */
test('StatusBarAlignment should have Left and Right values', () => {
    assert.strictEqual(StatusBarAlignment.Left, 1);
    assert.strictEqual(StatusBarAlignment.Right, 2);
});

test('TreeItemCollapsibleState should have correct values', () => {
    assert.strictEqual(TreeItemCollapsibleState.None, 0);
    assert.strictEqual(TreeItemCollapsibleState.Collapsed, 1);
    assert.strictEqual(TreeItemCollapsibleState.Expanded, 2);
});

test('ConfigurationTarget should have correct values', () => {
    assert.strictEqual(ConfigurationTarget.Global, 1);
    assert.strictEqual(ConfigurationTarget.Workspace, 2);
    assert.strictEqual(ConfigurationTarget.WorkspaceFolder, 3);
});

test('FileType should have correct values', () => {
    assert.strictEqual(FileType.Unknown, 0);
    assert.strictEqual(FileType.File, 1);
    assert.strictEqual(FileType.Directory, 2);
    assert.strictEqual(FileType.SymbolicLink, 64);
});

test('FilePermission should have Readonly value', () => {
    assert.strictEqual(FilePermission.Readonly, 1);
});

test('ExtensionMode should have correct values', () => {
    assert.strictEqual(ExtensionMode.Production, 1);
    assert.strictEqual(ExtensionMode.Development, 2);
    assert.strictEqual(ExtensionMode.Test, 3);
});

test('ExtensionKind should have UI and Workspace values', () => {
    assert.strictEqual(ExtensionKind.UI, 1);
    assert.strictEqual(ExtensionKind.Workspace, 2);
});

test('ViewColumn should have correct values', () => {
    assert.strictEqual(ViewColumn.Active, -1);
    assert.strictEqual(ViewColumn.Beside, -2);
    assert.strictEqual(ViewColumn.One, 1);
    assert.strictEqual(ViewColumn.Nine, 9);
});
