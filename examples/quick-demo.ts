/**
 * Quick demonstration of the state machine display features
 */

import { TSM } from '../src/tsm';

enum GameState {
    Menu = 'Menu',
    Loading = 'Loading',
    Playing = 'Playing',
    Paused = 'Paused',
    GameOver = 'GameOver'
}

const game = new TSM<GameState>(GameState.Menu);

// Setup state machine
game.addPath(GameState.Menu, GameState.Loading, GameState.Playing);
game.addTransition(GameState.Playing, GameState.Paused, true);
game.addTransition(GameState.Playing, GameState.GameOver);
game.addTransition(GameState.GameOver, GameState.Menu);
game.addTransition(GameState.Paused, GameState.Menu);

// Add timeouts
game.setStateTimeout(GameState.Loading, {
    timeoutMs: 2000,
    expireTo: GameState.Playing
});

game.setStateTimeout(GameState.Paused, {
    timeoutMs: 3000,
    expireTo: GameState.Menu
});

// Display using toString()
console.log('Initial state machine:\n');
console.log(game.toString());

// Transition and display again
console.log('\n\nAfter going to Loading:\n');
game.go(GameState.Loading);
console.log(game.toString());

// Serialize to JSON
console.log('\n\nSerialized as JSON:');
const config = game.serializeStateMachine();
console.log(JSON.stringify(config, null, 2));

console.log('\n\nDone!');
