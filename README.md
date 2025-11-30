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
- **Temporal expiration** - States can automatically expire after a timeout period
- **Type-safe** - Full TypeScript support with your custom state enums/types

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
// From one state to many states (one-way)
stateMachine.addTransitions(
  StateA,        // from
  StateB,        // to
  StateC,        // to
  StateD         // to
);
// Creates: A → B, A → C, A → D

// With bidirectional transitions
stateMachine.addTransitions(StateA, StateB, StateC, { loop: true });
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
// Attempts to transition (silently fails if invalid - default)
const newState = stateMachine.go(StateB);

// Throw error on invalid transition
try {
  stateMachine.go(StateB, { throwOnInvalid: true });
} catch (error) {
  console.error('Invalid transition:', error.message);
}
```

#### Check if Transition is Valid

```typescript
// Returns true/false without actually transitioning
if (stateMachine.canTransition(StateB)) {
  // Safe to transition
  stateMachine.go(StateB);
}

// Get all valid transitions from current state
const validStates = stateMachine.getValidTransitions();
// Returns: [StateB, StateC, ...]
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
// Reset to initial state (clears all active timeouts)
stateMachine.reset();
```

### State Machine Display and Serialization

Visualize and debug your state machine with built-in display and serialization functions. These are especially useful for validation and debugging complex state machines.

#### Display State Machine

Generate a human-readable representation of your state machine:

```typescript
// Using toString() method
console.log(stateMachine.toString());

// Or implicitly with String conversion
console.log(String(stateMachine));

// Or using the explicit method
const display = stateMachine.generateStateDisplay();
console.log(display);
```

The display includes:
- Current, previous, and initial states
- All states with their outgoing transitions
- Timeout configurations (duration, expiration target, active status)
- Registered callback counts
- Summary statistics

Example output:
```
STATE MACHINE
Current:  Playing
Previous: Loading
Initial:  Menu

  GameOver
    -> Menu, Playing
    (timeout: 10000ms, custom callback)
    [1 callback]

  Loading
    -> Playing
    (timeout: 5000ms, expires to Playing)

* Playing
    -> Paused, GameOver, Victory
    [1 callback]

  Paused
    -> Playing, Menu
    (timeout: 3000ms, expires to Menu)

States: 6 | Transitions: 10 | Timeouts: 3 | Active: 0
```

#### Serialize State Machine

Generate a JSON-serializable representation:

```typescript
const serialized = stateMachine.serializeStateMachine();
const json = JSON.stringify(serialized, null, 2);

// Save to file, send over network, etc.
fs.writeFileSync('state-machine.json', json);
```

The serialized format includes:
- Current, previous, and initial states
- All states with their transitions
- Timeout configurations (without callbacks, since they're not serializable)
- Callback counts
- Summary statistics

Example output:
```json
{
  "current": "Playing",
  "previous": "Loading",
  "initial": "Menu",
  "states": [
    {
      "state": "Loading",
      "toStates": ["Playing"],
      "fromStates": ["Menu"],
      "callbackCount": 0,
      "timeout": {
        "timeoutMs": 5000,
        "expireTo": "Playing",
        "hasCallback": false,
        "isActive": false
      }
    }
  ],
  "summary": {
    "totalStates": 6,
    "totalTransitions": 10,
    "statesWithTimeouts": 3,
    "activeTimers": 0
  }
}
```

### Temporal State Expiration

States can be configured to automatically expire after a timeout period. This is useful for scenarios like connection timeouts, session expiration, or operation timeouts.

#### Setting State Timeouts

```typescript
// Auto-transition on expiration
stateMachine.setStateTimeout(State.Loading, {
  timeoutMs: 5000,        // 5 seconds
  expireTo: State.Timeout  // Transition to Timeout state
});

// Custom callback on expiration
stateMachine.setStateTimeout(State.Loading, {
  timeoutMs: 5000,
  onExpire: (expiredState) => {
    console.log(`${expiredState} expired after 5 seconds!`);
    // Custom logic here
  }
});

// Both callback and auto-transition (callback takes precedence)
stateMachine.setStateTimeout(State.Loading, {
  timeoutMs: 5000,
  expireTo: State.Timeout,
  onExpire: (state) => {
    console.log('Handling expiration...');
    // Custom logic, then auto-transition will happen if callback doesn't prevent it
  }
});
```

#### Clearing Timeouts

```typescript
// Remove timeout configuration for a state
stateMachine.clearStateTimeout(State.Loading);

// Timeouts are automatically cleared when:
// - State transitions to a different state
// - reset() is called
```

#### How Timeouts Work

- When you transition into a state with a timeout configured, a timer starts automatically
- If you transition away before the timeout, the timer is cleared
- If the timeout expires:
  - If `onExpire` callback is provided, it's called
  - Otherwise, if `expireTo` is provided, it attempts to transition (validates transition first)
  - If neither is provided, nothing happens

## Complete Examples

### File Upload State Machine

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
  if (uploadFSM.canTransition(UploadState.Uploading)) {
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

### Connection State Machine with Timeouts

Here's an example demonstrating temporal state expiration:

```typescript
import { TSM } from 'synth-state';

enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Timeout = 'timeout',
  Error = 'error'
}

const connectionFSM = new TSM<ConnectionState>(ConnectionState.Disconnected);

// Define state flow
connectionFSM.addPath(
  ConnectionState.Disconnected,
  ConnectionState.Connecting,
  ConnectionState.Connected
);

// Error and timeout paths
connectionFSM.addTransition(ConnectionState.Connecting, ConnectionState.Error);
connectionFSM.addTransition(ConnectionState.Connecting, ConnectionState.Timeout);
connectionFSM.addTransition(ConnectionState.Timeout, ConnectionState.Disconnected);
connectionFSM.addTransition(ConnectionState.Error, ConnectionState.Disconnected);

// Set timeout: Connecting state expires after 10 seconds
connectionFSM.setStateTimeout(ConnectionState.Connecting, {
  timeoutMs: 10000, // 10 seconds
  expireTo: ConnectionState.Timeout
});

// Set up event handlers
connectionFSM
  .on(ConnectionState.Connecting, (from, to) => {
    console.log('Attempting to connect...');
    // Timer starts automatically when entering this state
    attemptConnection();
  })
  .on(ConnectionState.Connected, (from, to) => {
    console.log('Connected! Timeout was automatically cleared.');
    // Timer was cleared when we transitioned away from Connecting
  })
  .on(ConnectionState.Timeout, (from, to) => {
    console.log('Connection timed out after 10 seconds');
    showTimeoutMessage();
  })
  .on(ConnectionState.Error, (from, to) => {
    console.log('Connection error occurred');
    showErrorMessage();
  });

// Usage
function startConnection() {
  connectionFSM.go(ConnectionState.Connecting);
  // Timer starts automatically
  // If connection succeeds within 10 seconds, timer is cleared
  // If 10 seconds pass, automatically transitions to Timeout
}

function onConnectionSuccess() {
  // This clears the timeout automatically
  connectionFSM.go(ConnectionState.Connected);
}

function onConnectionError() {
  // This also clears the timeout
  connectionFSM.go(ConnectionState.Error);
}
```

### Session Management with Custom Expiration

Example using expiration callbacks for custom logic:

```typescript
enum SessionState {
  Active = 'active',
  Idle = 'idle',
  Expired = 'expired'
}

const sessionFSM = new TSM<SessionState>(SessionState.Active);

sessionFSM.addTransition(SessionState.Active, SessionState.Idle);
sessionFSM.addTransition(SessionState.Idle, SessionState.Active);
sessionFSM.addTransition(SessionState.Idle, SessionState.Expired);
sessionFSM.addTransition(SessionState.Expired, SessionState.Active);

// Idle state expires after 30 minutes with custom handling
sessionFSM.setStateTimeout(SessionState.Idle, {
  timeoutMs: 30 * 60 * 1000, // 30 minutes
  onExpire: (state) => {
    console.log('Session idle timeout - saving data...');
    saveUserData();
    // Manually transition after custom logic
    sessionFSM.go(SessionState.Expired);
  }
});

sessionFSM.on(SessionState.Idle, (from, to) => {
  console.log('User is idle, starting 30-minute timer...');
  // Timer starts automatically
});

sessionFSM.on(SessionState.Active, (from, to) => {
  console.log('User is active, timer cleared');
  // Timer was automatically cleared when transitioning from Idle
});
```

### Debugging and Validation Example

Here's how to use the display and serialization functions for debugging:

```typescript
import { TSM } from 'synth-state';

enum GameState {
  Menu = 'Menu',
  Loading = 'Loading',
  Playing = 'Playing',
  Paused = 'Paused',
  GameOver = 'GameOver'
}

const game = new TSM<GameState>(GameState.Menu);

// Build your state machine
game.addPath(GameState.Menu, GameState.Loading, GameState.Playing);
game.addTransition(GameState.Playing, GameState.Paused, true);
game.addTransitions(GameState.Playing, GameState.GameOver, GameState.Menu);

// Add timeouts
game.setStateTimeout(GameState.Loading, {
  timeoutMs: 5000,
  expireTo: GameState.Playing
});

game.setStateTimeout(GameState.Paused, {
  timeoutMs: 3000,
  expireTo: GameState.Menu
});

// Display the complete state machine for debugging
console.log(game.toString());

// Or serialize for validation/testing
const config = game.serializeStateMachine();
console.log(`Total states: ${config.summary.totalStates}`);
console.log(`Total transitions: ${config.summary.totalTransitions}`);
console.log(`States with timeouts: ${config.summary.statesWithTimeouts}`);

// Validate that all expected transitions exist
const playingState = config.states.find(s => s.state === GameState.Playing);
if (playingState && !playingState.toStates.includes(GameState.GameOver)) {
  throw new Error('Missing required transition: Playing → GameOver');
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
