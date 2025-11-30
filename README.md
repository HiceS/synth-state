# synth-state   [![npm](https://img.shields.io/badge/https%3A%2F%2Fwww.npmjs.com%2Fpackage%2Fsynth-state?style=flat&logo=npm&label=npm)](https://www.npmjs.com/package/synth-state)

A lightweight TypeScript library for managing application state with **Temporal State Machines (TSM)**. Build robust, type-safe finite state machines with transition validation, event callbacks, and a clean API.

## Installation

```bash
npm install synth-state
```

## Quick Start

```typescript
import { TSM } from 'synth-state';

// Define your states
enum AppState {
  Idle = 'idle',
  Loading = 'loading',
  Success = 'success',
  Error = 'error'
}

// Create a state machine with an initial state
const stateMachine = new TSM<AppState>(AppState.Idle);

// Define valid transitions
stateMachine.addTransition(AppState.Idle, AppState.Loading);
stateMachine.addTransition(AppState.Loading, AppState.Success);
stateMachine.addTransition(AppState.Loading, AppState.Error);
stateMachine.addTransition(AppState.Success, AppState.Idle, true); // loop back

// Add callbacks for state changes
stateMachine.on(AppState.Loading, (from, to) => {
  console.log(`Transitioned from ${from} to ${to}`);
  // Start loading data...
});

stateMachine.on(AppState.Success, (from, to) => {
  console.log('Data loaded successfully!');
});

// Transition between states
stateMachine.go(AppState.Loading);  // ✅ Valid transition
stateMachine.go(AppState.Success);  // ✅ Valid transition
stateMachine.go(AppState.Error);    // ❌ Invalid (from Success, can only go to Idle)
```

## What is Temporal State Management?

Temporal State Management (TSM) is a finite state machine implementation that enforces valid state transitions at runtime. Unlike simple state variables, TSM:

- **Prevents invalid transitions** - Only allows transitions you've explicitly defined
- **Tracks state history** - Knows both current and previous states
- **Supports event callbacks** - React to state changes with callbacks
- **Type-safe** - Full TypeScript support with your custom state enums/types
- **Future-ready** - Designed to support temporal features like timeouts and expiring transitions

## API Reference

### Creating a State Machine

```typescript
const stateMachine = new TSM<YourStateType>(initialState);
```

### Defining Transitions

#### Single Transition

```typescript
// One-way transition: A → B
stateMachine.addTransition(StateA, StateB);

// Bidirectional transition: A ↔ B
stateMachine.addTransition(StateA, StateB, true);
```

#### Multiple Transitions

```typescript
// From one state to many states
stateMachine.addTransitions(
  StateA,        // from
  false,         // loop (bidirectional)
  StateB,        // to
  StateC,        // to
  StateD         // to
);

// With bidirectional transitions
stateMachine.addTransitions(StateA, true, StateB, StateC);
// Creates: A ↔ B, A ↔ C
```

#### Path Definition

Define a sequence of states that link together:

```typescript
// Creates: A → B → C → D → E
stateMachine.addPath(StateA, StateB, StateC, StateD, StateE);
```

### State Transitions

#### Transition to a State

```typescript
// Attempts to transition, logs error if invalid
const newState = stateMachine.go(StateB);
```

#### Check if Transition is Valid

```typescript
// Returns true/false without actually transitioning
if (stateMachine.tryGo(StateB)) {
  // Safe to transition
  stateMachine.go(StateB);
}
```

### State Information

```typescript
const current = stateMachine.current;  // Current state
const previous = stateMachine.previous; // Previous state
```

### Event Callbacks

Register callbacks that fire when entering a specific state:

```typescript
stateMachine.on(StateB, (from, to, event?) => {
  console.log(`Entered ${to} from ${from}`);
  // Your logic here
});

// Multiple callbacks can be registered for the same state
stateMachine
  .on(StateB, callback1)
  .on(StateB, callback2);
```

### Reset

```typescript
// Reset to initial state
stateMachine.reset();
```

## Complete Example

Here's a practical example modeling a file upload process:

```typescript
import { TSM } from 'synth-state';

enum UploadState {
  Idle = 'idle',
  Uploading = 'uploading',
  Processing = 'processing',
  Complete = 'complete',
  Failed = 'failed'
}

const uploadFSM = new TSM<UploadState>(UploadState.Idle);

// Define the state flow
uploadFSM.addPath(
  UploadState.Idle,
  UploadState.Uploading,
  UploadState.Processing,
  UploadState.Complete
);

// Allow retry from Failed
uploadFSM.addTransition(UploadState.Failed, UploadState.Uploading);
uploadFSM.addTransition(UploadState.Uploading, UploadState.Failed);

// Set up event handlers
uploadFSM
  .on(UploadState.Uploading, (from, to) => {
    console.log('Starting upload...');
    startUpload();
  })
  .on(UploadState.Processing, (from, to) => {
    console.log('Processing file...');
    processFile();
  })
  .on(UploadState.Complete, (from, to) => {
    console.log('Upload complete!');
    showSuccess();
  })
  .on(UploadState.Failed, (from, to) => {
    console.log('Upload failed');
    showError();
  });

// Use the state machine
function handleFileSelect() {
  if (uploadFSM.tryGo(UploadState.Uploading)) {
    uploadFSM.go(UploadState.Uploading);
  }
}

function handleUploadComplete() {
  uploadFSM.go(UploadState.Processing);
  // After processing...
  uploadFSM.go(UploadState.Complete);
}

function handleUploadError() {
  uploadFSM.go(UploadState.Failed);
}

function retryUpload() {
  if (uploadFSM.current === UploadState.Failed) {
    uploadFSM.go(UploadState.Uploading);
  }
}
```

## Tree Shaking

For optimal bundle size, import only what you need:

```typescript
// Import only TSM
import { TSM } from 'synth-state/tsm';

// Or import everything
import { TSM, WorkerEventDispatcher } from 'synth-state';
```

## Additional Utilities

This package also includes `WorkerEventDispatcher`, a type-safe event dispatcher interface. See the source code for implementation details.

## Development

### Building

```bash
npm run build
```

This generates:
- TypeScript declaration files (`.d.ts`)
- ESM modules (`.js`)
- CommonJS modules (`.cjs`)
- Source maps for all outputs

### Publishing

1. Update the version in `package.json`
2. Create a git tag: `git tag v1.0.0`
3. Push the tag: `git push origin v1.0.0`

The GitHub Actions workflow automatically builds and publishes to NPM when a tag starting with `v` is pushed.

**Note:** Make sure to set up the `NPM_TOKEN` secret in your GitHub repository settings for the publish workflow to work.

## License

ISC
