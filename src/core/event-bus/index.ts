/**
 * A lightweight Event Bus implemented with EventTarget.
 * This is used inside the Main process to decouple the sandbox runtime, executor, and UI emitter.
 */
import { EventEmitter } from 'events';

class EventBus extends EventEmitter {}

export const eventBus = new EventBus();

// Strongly typed event wrappers
export const emitCodeChanged = (code: string) => eventBus.emit('code:changed', code);
export const onCodeChanged = (cb: (code: string) => void) => eventBus.on('code:changed', cb);

export const emitConsoleLog = (logData: unknown) => eventBus.emit('console:log', logData);
export const onConsoleLog = (cb: (logData: unknown) => void) => eventBus.on('console:log', cb);

export const emitExecutionComplete = (executionData: unknown) => eventBus.emit('execution:complete', executionData);
export const onExecutionComplete = (cb: (executionData: unknown) => void) => eventBus.on('execution:complete', cb);


// Future hooks for the package system
export const emitPackageInstall = (pkg: string) => eventBus.emit('package:install', pkg);

export const emitWorkerStatus = (status: 'running' | 'stopped') => eventBus.emit('worker:status', status);
export const onWorkerStatus = (cb: (status: 'running' | 'stopped') => void) => eventBus.on('worker:status', cb);

