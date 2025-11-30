type GenericCallback = (...args: any[]) => void;
type EventContractValidation<TEvent> = { [K in keyof TEvent]: GenericCallback };

/**
 * Generic Dispatcher that can take a interface to a group of functions that can be executed.
 *
 * example ` const dispatcher: WorkerEventDispatcher<PhysicsEvents> `
 *
 * `TEvent` is looking for an interface that maps strings or enums to @type {(...args: any[]) => void}
 */
export interface WorkerEventDispatcher<TEvent extends EventContractValidation<TEvent>> {
    on<E extends keyof TEvent>(event: E, callback: GenericCallback & TEvent[E]): void;
    dispatch<E extends keyof TEvent>(event: E, ...args: Parameters<TEvent[E]>): void;

    // Dispatches a Promise that can resolve to the return type of the input function
    // Or resolves to a success state and no return I suppose
    dispatchPromise<E extends keyof TEvent>(event: E, ...args: Parameters<TEvent[E]>): Promise<ReturnType<TEvent[E]>>;
}