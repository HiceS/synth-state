type StateCallbackSet<T> = Map<T, Array<(from: T, to: T, event?: any) => any>>;

interface TemporalStateCreator<State> {
    go(state: State): State;
    tryGo(state: State): boolean;

    reset(): void;

    addPath(...states: Array<State>): void;

    addTransitions(from: State, loop: boolean, ...to: Array<State>): void;
    addTransition(from: State, to: State, loop: boolean): void;
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
     * Add multiple endpoints to a single from
     * DOES NOT CREATE A LOOP DIRECTLY, you must specify the same from and to in order to construct a loop
     * @param from From State
     * @param to List of States the From State can go to
     */
    addTransitions(from: StateEnum, loop = false, ...to: StateEnum[]): void {
        for (const _to of to) {
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
     * @returns New State that was transitioned
     */
    go(state: StateEnum): StateEnum {
        if (!this.tryGo(state)) {
            console.error("INVALID STATE TRANSITION FROM %s to %s", this._current, state);
            return this.current;
        }

        this._previous = this._current;

        this._current = state;

        if (this._cbMap.get(state)) {
            const cbs = this._cbMap.get(state);
            if (cbs) {
                for (const cb of cbs) {
                    cb(this._previous, state);
                }
            }
        }
        
        return this._current;
    }

    /**
     * Try to transition state to see if it possible, WILL NOT ACTUALLY TRANISITION
     * @param state State to transition to
     * @returns If it is possible to make the transition
     */
    tryGo(state: StateEnum): boolean {
        if (!this._transitions.has(this._current)) {
            throw new Error("Trying to go to a state that doesn't have any transitions : " + state);
        }

        const transitions = this._transitions.get(this._current);
        if (transitions === undefined) return false;

        for (const t of transitions.toStates) {
            if (t === state) return true;
        }

        return false;
    }

    /**
     * Sets the Current state to the initial state
     * Sets the previous to the initial state
     */
    reset(): void {
        this._previous = this._initial; // should previous also be initial in this case?
        this._current = this._initial;
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
}