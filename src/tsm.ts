type StateCallbackSet<T> = Map<T, Array<(from: T, to: T, event?: any) => any>>;
type ExpireCallback<T> = (expiredState: T) => void;

interface StateTimeoutConfig<StateEnum> {
    timeoutMs: number;
    expireTo?: StateEnum;
    onExpire?: ExpireCallback<StateEnum>;
}

/**
 * Options for setting a state timeout
 */
export interface StateTimeoutOptions<StateEnum> {
    /** Timeout duration in milliseconds */
    timeoutMs: number;
    /** State to transition to when expired (optional) */
    expireTo?: StateEnum;
    /** Callback function called when state expires (optional, takes precedence over expireTo) */
    onExpire?: ExpireCallback<StateEnum>;
}

/**
 * Options for adding transitions
 */
export interface TransitionOptions {
    /** Whether to create bidirectional transitions (default: false) */
    loop?: boolean;
}

/**
 * Options for the go() method
 */
export interface GoOptions {
    /** Whether to throw an error on invalid transition (default: false) */
    throwOnInvalid?: boolean;
}

interface TemporalStateCreator<State> {
    go(state: State, options?: GoOptions): State;
    canTransition(state: State): boolean;
    getValidTransitions(): State[];

    reset(): void;

    addPath(...states: Array<State>): void;

    addTransitions(from: State, ...args: Array<State | TransitionOptions>): void;
    addTransition(from: State, to: State, loop?: boolean): void;
}

class Transitions<StateEnum> {
    constructor(state: StateEnum) {
        this.state = state;
    }

    public state: StateEnum;
    public fromStates: StateEnum[] = [];
    public toStates: StateEnum[] = [];
}

/**
 * Template class for creating Finite State Machines that will eventually be temporal
 *
 * Eventually relationships can expire over time and create a more dynamic appeal (timeouts)
 */
export class TSM<StateEnum> implements TemporalStateCreator<StateEnum> {
    private _initial: StateEnum;
    private _current: StateEnum;
    private _previous: StateEnum;
    private _cbMap: StateCallbackSet<StateEnum> = new Map();
    private _transitions: Map<StateEnum, Transitions<StateEnum>> = new Map();
    private _timeoutConfigs: Map<StateEnum, StateTimeoutConfig<StateEnum>> = new Map();
    private _activeTimers: Map<StateEnum, ReturnType<typeof setTimeout>> = new Map();

    constructor(initial: StateEnum) {
        this._initial = initial;
        this._current = initial;
        this._previous = initial; // just so I don't need to throw alot of errors
    }

    /**
     * Gets current State
     */
    public get current() {
        return this._current;
    }

    /**
     * Gets previous State
     */
    public get previous() {
        return this._previous;
    }

    /**
     * This function allows you to specify a path that will link itself together in the parameter order.
     * For instance `TSM.addPath(Running, Paused, Transform, Paused, Running)` but it doesn't need to exist
     * @param states Parameters that list a path, clicked, paused, open
     */
    addPath(...states: StateEnum[]): void {
        let previous: StateEnum | undefined;
        for (const state of states) {
            if (previous !== undefined) this.addFromState(previous, state);
            previous = state;
        }
    }

    /**
     * Add multiple endpoints to a single from state
     * DOES NOT CREATE A LOOP DIRECTLY, you must specify the loop option to construct bidirectional transitions
     * @param from From State
     * @param args List of States the From State can go to, optionally followed by TransitionOptions
     * 
     * @example
     * // One-way transitions: A → B, A → C, A → D
     * stateMachine.addTransitions(StateA, StateB, StateC, StateD);
     * 
     * @example
     * // Bidirectional transitions: A ↔ B, A ↔ C
     * stateMachine.addTransitions(StateA, StateB, StateC, { loop: true });
     */
    addTransitions(from: StateEnum, ...args: Array<StateEnum | TransitionOptions>): void {
        // Extract options (last arg if it's an object, otherwise undefined)
        const lastArg = args[args.length - 1];
        const options: TransitionOptions = (typeof lastArg === 'object' && lastArg !== null && !Array.isArray(lastArg) && 'loop' in lastArg)
            ? lastArg as TransitionOptions
            : { loop: false };
        const loop = options.loop ?? false;
        
        // Extract states (all args except the last if it's options)
        const toStates = (typeof lastArg === 'object' && lastArg !== null && !Array.isArray(lastArg) && 'loop' in lastArg)
            ? args.slice(0, -1) as StateEnum[]
            : args as StateEnum[];

        for (const _to of toStates) {
            this.addFromState(from, _to);
            if (loop) this.addFromState(_to, from);
        }
    }

    /**
     * Simple way to construct a single relationship
     *
     * This represents  `a -> b` but not `b -> a` , that will require you to specify the loop flag.
     * @param from From State
     * @param to To State
     * @param loop (default: `False`) - ` a -> b ` and ` b -> a `
     */
    addTransition(from: StateEnum, to: StateEnum, loop = false): void {
        this.addFromState(from, to);
        if (loop) this.addFromState(to, from);
    }

    /**
     * Helper function to ensure the map properties are defined,
     * Also will limit the amount of the from and to properties pushed to the transitions
     * @param from State From
     * @param to State To go to
     */
    private addFromState(from: StateEnum, to: StateEnum) {
        if (!this._transitions.has(from)) {
            this._transitions.set(from, new Transitions(from));
        }

        const transitionsfrom = this._transitions.get(from);
        if (!transitionsfrom?.toStates.includes(to)) transitionsfrom?.toStates.push(to);

        if (!this._transitions.has(to)) {
            this._transitions.set(to, new Transitions(to));
        }

        const transitionsto = this._transitions.get(to);
        if (!transitionsto?.fromStates.includes(from)) transitionsto?.fromStates.push(from);
    }

    /**
     * Attempts to transition to the new state if possible
     * @param state State to transition to
     * @param options Optional configuration (throwOnInvalid: throw error on invalid transition)
     * @returns New State that was transitioned (or current state if invalid and not throwing)
     * @throws {Error} If throwOnInvalid is true and transition is invalid
     * 
     * @example
     * // Silent failure (default)
     * stateMachine.go(StateB);
     * 
     * @example
     * // Throw on invalid transition
     * try {
     *   stateMachine.go(StateB, { throwOnInvalid: true });
     * } catch (error) {
     *   console.error('Invalid transition:', error);
     * }
     */
    go(state: StateEnum, options?: GoOptions): StateEnum {
        if (!this.canTransition(state)) {
            if (options?.throwOnInvalid) {
                throw new Error(
                    `Invalid state transition from ${this._current} to ${state}. ` +
                    `Valid transitions from ${this._current}: ${this._getValidTransitions().join(', ')}`
                );
            }
            return this.current;
        }

        // Clear any active timeout for the current state
        this._clearStateTimeout(this._current);

        this._previous = this._current;
        this._current = state;

        // Trigger state entry callbacks
        if (this._cbMap.get(state)) {
            const cbs = this._cbMap.get(state);
            if (cbs) {
                for (const cb of cbs) {
                    cb(this._previous, state);
                }
            }
        }

        // Start timeout if configured for this state
        this._startStateTimeout(state);
        
        return this._current;
    }

    /**
     * Check if a transition to the given state is valid from the current state.
     * This method does NOT perform the transition, only checks if it's possible.
     * @param state State to check transition to
     * @returns true if transition is valid, false otherwise
     * 
     * @example
     * if (stateMachine.canTransition(StateB)) {
     *   stateMachine.go(StateB);
     * }
     */
    canTransition(state: StateEnum): boolean {
        if (!this._transitions.has(this._current)) {
            return false;
        }

        const transitions = this._transitions.get(this._current);
        if (transitions === undefined) return false;

        for (const t of transitions.toStates) {
            if (t === state) return true;
        }

        return false;
    }

    /**
     * Get list of valid transitions from the current state
     * @returns Array of states that can be transitioned to from current state
     */
    getValidTransitions(): StateEnum[] {
        return this._getValidTransitions();
    }

    /**
     * Get list of valid transitions from the current state (internal)
     * @private
     */
    private _getValidTransitions(): StateEnum[] {
        const transitions = this._transitions.get(this._current);
        return transitions ? [...transitions.toStates] : [];
    }

    /**
     * Sets the Current state to the initial state
     * Sets the previous to the initial state
     * Clears all active timeouts
     */
    reset(): void {
        // Clear all active timeouts
        this._clearAllTimeouts();
        
        this._previous = this._initial; // should previous also be initial in this case?
        this._current = this._initial;
        
        // Start timeout if configured for initial state
        this._startStateTimeout(this._initial);
    }

    /**
     * This will register a callback that will trigger when a `to` state is triggered
     * Eventually this will have an expiration
     * @param to Transition State that triggers callback
     * @param callback Event that is triggered
     * @returns This class
     */
    on(to: StateEnum, callback: (from: StateEnum, to: StateEnum, event?: any) => any): TSM<StateEnum> {
        if (!this._cbMap.has(to)) {
            this._cbMap.set(to, []);
        }

        const cbSet = this._cbMap.get(to);

        if (!cbSet) {
            throw new Error("Cannot create callback with State : " + to);
        }

        if (!cbSet.includes(callback)) {
            cbSet.push(callback);
        }

        return this;
    }

    /**
     * Sets a timeout for a state. When the state expires (timeout is reached),
     * it will either transition to the specified state or call the expiration callback.
     * 
     * If the state transitions before the timeout, the timer is automatically cleared.
     * 
     * @param state The state to set a timeout for
     * @param options Timeout configuration (timeoutMs, expireTo, onExpire)
     * @returns This class for method chaining
     * 
     * @example
     * // Auto-transition on expiration
     * stateMachine.setStateTimeout(State.Loading, {
     *   timeoutMs: 5000,
     *   expireTo: State.Timeout
     * });
     * 
     * @example
     * // Custom callback on expiration
     * stateMachine.setStateTimeout(State.Loading, {
     *   timeoutMs: 5000,
     *   onExpire: (state) => console.log(`${state} expired!`)
     * });
     * 
     * @example
     * // Both callback and auto-transition (callback takes precedence)
     * stateMachine.setStateTimeout(State.Loading, {
     *   timeoutMs: 5000,
     *   expireTo: State.Timeout,
     *   onExpire: (state) => {
     *     console.log('Expired!');
     *     // Custom logic here
     *   }
     * });
     */
    setStateTimeout(state: StateEnum, options: StateTimeoutOptions<StateEnum>): TSM<StateEnum> {
        if (options.timeoutMs <= 0) {
            throw new Error("Timeout must be greater than 0");
        }

        if (!options.expireTo && !options.onExpire) {
            throw new Error("Either expireTo or onExpire must be provided");
        }

        this._timeoutConfigs.set(state, {
            timeoutMs: options.timeoutMs,
            expireTo: options.expireTo,
            onExpire: options.onExpire,
        });

        // If this state is currently active, start the timeout
        if (this._current === state) {
            this._startStateTimeout(state);
        }

        return this;
    }

    /**
     * Removes the timeout configuration for a state
     * @param state The state to remove timeout for
     * @returns This class for method chaining
     */
    clearStateTimeout(state: StateEnum): TSM<StateEnum> {
        this._timeoutConfigs.delete(state);
        this._clearStateTimeout(state);
        return this;
    }

    /**
     * Starts a timeout timer for the given state if configured
     * @private
     */
    private _startStateTimeout(state: StateEnum): void {
        const config = this._timeoutConfigs.get(state);
        if (!config) {
            return;
        }

        // Clear any existing timer for this state
        this._clearStateTimeout(state);

        const timer = setTimeout(() => {
            this._handleStateExpiration(state, config);
        }, config.timeoutMs);

        this._activeTimers.set(state, timer);
    }

    /**
     * Clears the timeout timer for a specific state
     * @private
     */
    private _clearStateTimeout(state: StateEnum): void {
        const timer = this._activeTimers.get(state);
        if (timer) {
            clearTimeout(timer);
            this._activeTimers.delete(state);
        }
    }

    /**
     * Clears all active timeout timers
     * @private
     */
    private _clearAllTimeouts(): void {
        for (const timer of this._activeTimers.values()) {
            clearTimeout(timer);
        }
        this._activeTimers.clear();
    }

    /**
     * Handles state expiration - either transitions to expireTo state or calls onExpire callback
     * @private
     */
    private _handleStateExpiration(state: StateEnum, config: StateTimeoutConfig<StateEnum>): void {
        // Only handle expiration if we're still in this state
        if (this._current !== state) {
            return;
        }

        // Remove the timer from active timers
        this._activeTimers.delete(state);

        // If onExpire callback is provided, call it
        if (config.onExpire) {
            config.onExpire(state);
            return;
        }

        // Otherwise, try to transition to expireTo state
        if (config.expireTo !== undefined) {
            if (this.canTransition(config.expireTo)) {
                // Use go() which will trigger callbacks and handle state properly
                this.go(config.expireTo);
            } else {
                console.warn(
                    `State ${state} expired but cannot transition to ${config.expireTo} - invalid transition`
                );
            }
        }
    }
}