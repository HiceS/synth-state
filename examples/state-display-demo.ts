/**
 * Example demonstrating the state machine display and serialization features
 * 
 * This example shows how to use generateStateDisplay() and serializeStateMachine()
 * for debugging, validation, and visualization of your state machines.
 */

import { TSM } from '../src/tsm';

// Define a realistic game state enum
enum GameState {
    MainMenu = 'MainMenu',
    Loading = 'Loading',
    Playing = 'Playing',
    Paused = 'Paused',
    GameOver = 'GameOver',
    Victory = 'Victory',
    Settings = 'Settings'
}

// Create the state machine
const game = new TSM<GameState>(GameState.MainMenu);

// Build a realistic game state flow
game.addPath(GameState.MainMenu, GameState.Loading, GameState.Playing);
game.addTransition(GameState.Playing, GameState.Paused, true); // Can pause and unpause
game.addTransitions(GameState.Playing, GameState.GameOver, GameState.Victory);
game.addTransition(GameState.MainMenu, GameState.Settings, true);
game.addTransitions(GameState.GameOver, GameState.MainMenu, GameState.Playing);
game.addTransitions(GameState.Victory, GameState.MainMenu);
game.addTransition(GameState.Paused, GameState.MainMenu);

// Add timeouts for realistic scenarios
game.setStateTimeout(GameState.Loading, {
    timeoutMs: 5000,
    expireTo: GameState.Playing,
});

game.setStateTimeout(GameState.Paused, {
    timeoutMs: 300000, // 5 minutes
    expireTo: GameState.MainMenu,
});

game.setStateTimeout(GameState.GameOver, {
    timeoutMs: 10000,
    onExpire: (state) => {
        console.log(`\n[TIMEOUT] ${state} expired - returning to main menu`);
        game.go(GameState.MainMenu);
    }
});

// Add some callbacks
game.on(GameState.Playing, (from, to) => {
    console.log(`[CALLBACK] Game started from ${from}`);
});

game.on(GameState.GameOver, (from, to) => {
    console.log(`[CALLBACK] Game over! Player was in ${from}`);
});

game.on(GameState.Victory, (from, to) => {
    console.log(`[CALLBACK] Victory! Player completed the game from ${from}`);
});

// ============================================================================
// DEMONSTRATION 1: Display at initial state
// ============================================================================
console.log('═══════════════════════════════════════════════════════════════');
console.log('DEMO 1: Initial State Machine Configuration');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log(game.generateStateDisplay());

// ============================================================================
// DEMONSTRATION 2: Display after some transitions
// ============================================================================
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('DEMO 2: After transitioning MainMenu → Loading → Playing');
console.log('═══════════════════════════════════════════════════════════════\n');
game.go(GameState.Loading);
game.go(GameState.Playing);
console.log(game.generateStateDisplay());

// ============================================================================
// DEMONSTRATION 3: JSON Serialization
// ============================================================================
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('DEMO 3: JSON Serialization (for persistence/validation)');
console.log('═══════════════════════════════════════════════════════════════\n');
const serialized = game.serializeStateMachine();
console.log(JSON.stringify(serialized, null, 2));

// ============================================================================
// DEMONSTRATION 4: Using serialization for validation
// ============================================================================
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('DEMO 4: State Machine Validation Using Serialization');
console.log('═══════════════════════════════════════════════════════════════\n');

// Validate the state machine configuration
const config = game.serializeStateMachine();

console.log('📊 Summary Statistics:');
console.log(`   Total States: ${config.summary.totalStates}`);
console.log(`   Total Transitions: ${config.summary.totalTransitions}`);
console.log(`   States with Timeouts: ${config.summary.statesWithTimeouts}`);
console.log(`   Active Timers: ${config.summary.activeTimers}`);

console.log('\n✅ Validation Checks:');

// Check 1: Verify critical transitions exist
const playingState = config.states.find(s => s.state === GameState.Playing);
if (playingState?.toStates.includes(GameState.GameOver)) {
    console.log('   ✓ Playing can transition to GameOver');
} else {
    console.log('   ✗ ERROR: Missing transition Playing → GameOver');
}

// Check 2: Verify timeout configurations
const loadingState = config.states.find(s => s.state === GameState.Loading);
if (loadingState?.timeout && loadingState.timeout.timeoutMs === 5000) {
    console.log('   ✓ Loading state has correct timeout (5000ms)');
} else {
    console.log('   ✗ ERROR: Loading state timeout is incorrect');
}

// Check 3: Verify bidirectional transitions
const pausedState = config.states.find(s => s.state === GameState.Paused);
if (
    playingState?.toStates.includes(GameState.Paused) &&
    pausedState?.toStates.includes(GameState.Playing)
) {
    console.log('   ✓ Playing ↔ Paused bidirectional transitions exist');
} else {
    console.log('   ✗ ERROR: Bidirectional transitions incomplete');
}

// Check 4: Verify all states are reachable
const unreachableStates = config.states.filter(s => 
    s.fromStates.length === 0 && s.state !== config.initial
);
if (unreachableStates.length === 0) {
    console.log('   ✓ All states are reachable from some other state');
} else {
    console.log(`   ⚠ Warning: Found ${unreachableStates.length} unreachable states:`, 
        unreachableStates.map(s => s.state).join(', '));
}

// Check 5: Verify dead-end states are intentional
const deadEndStates = config.states.filter(s => s.toStates.length === 0);
console.log(`   ℹ Found ${deadEndStates.length} dead-end states: ` + 
    deadEndStates.map(s => s.state).join(', '));

// ============================================================================
// DEMONSTRATION 5: Monitoring active timers
// ============================================================================
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('DEMO 5: Monitoring Active Timers');
console.log('═══════════════════════════════════════════════════════════════\n');

// Pause the game to start a timer
console.log('Pausing the game...');
game.go(GameState.Paused);

const configWithTimer = game.serializeStateMachine();
const pausedStateWithTimer = configWithTimer.states.find(s => s.state === GameState.Paused);

console.log(`\nPaused state timeout configuration:`);
console.log(`   Timeout: ${pausedStateWithTimer?.timeout?.timeoutMs}ms`);
console.log(`   Expires to: ${pausedStateWithTimer?.timeout?.expireTo}`);
console.log(`   Timer active: ${pausedStateWithTimer?.timeout?.isActive ? '⏱️  YES' : '❌ NO'}`);

console.log('\n📊 Current State Display:');
console.log(game.generateStateDisplay());

// ============================================================================
// DEMONSTRATION 6: Export for documentation
// ============================================================================
console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log('DEMO 6: Generate Documentation from State Machine');
console.log('═══════════════════════════════════════════════════════════════\n');

function generateDocumentation(fsm: TSM<GameState>): string {
    const config = fsm.serializeStateMachine();
    const lines: string[] = [];
    
    lines.push('# Game State Machine Documentation\n');
    lines.push(`## Overview\n`);
    lines.push(`- **Initial State:** ${config.initial}`);
    lines.push(`- **Total States:** ${config.summary.totalStates}`);
    lines.push(`- **Total Transitions:** ${config.summary.totalTransitions}\n`);
    
    lines.push('## States\n');
    
    for (const state of config.states) {
        lines.push(`### ${state.state}\n`);
        
        if (state.toStates.length > 0) {
            lines.push(`**Can transition to:**`);
            state.toStates.forEach(to => lines.push(`- ${to}`));
            lines.push('');
        }
        
        if (state.timeout) {
            lines.push(`**Timeout:** ${state.timeout.timeoutMs}ms`);
            if (state.timeout.expireTo) {
                lines.push(`- Expires to: ${state.timeout.expireTo}`);
            }
            if (state.timeout.hasCallback) {
                lines.push(`- Has custom expiration handler`);
            }
            lines.push('');
        }
        
        if (state.callbackCount > 0) {
            lines.push(`**Event Handlers:** ${state.callbackCount} registered\n`);
        }
    }
    
    return lines.join('\n');
}

const documentation = generateDocumentation(game);
console.log(documentation);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('Demo Complete!');
console.log('═══════════════════════════════════════════════════════════════\n');
