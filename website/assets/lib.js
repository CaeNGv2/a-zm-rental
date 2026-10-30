/**
 * @template T
 */
class State {
  // A global pointer to the active side-effect/render function
  /**
   * @type {Function|null}
   */
  static #activeEffect = null;

  /**
   * runs the effect immediately, during which it will track all read states inside the effect.
   * all relevant state changes will be subscribed to and the effect re-run.
   * @param {Function} effect
   */
  static watchEffect(effect) {
    State.#activeEffect = effect;
    effect(); // Run initially to trigger getters and track dependencies
    State.#activeEffect = null;
  }

  /**
   * @type {Set<Function>}
   */
  #subscribers; // Stores functions that depend on this ref
  /**
   * current raw val
   * @type {T}
   */
  #value;

  /**
   * 
   * @param {T} initialValue 
   */
  constructor(initialValue) {
    this.#value = initialValue;
    this.#subscribers = new Set();
  }

  get value() {
    if (State.#activeEffect) {
      this.#subscribers.add(State.#activeEffect); // Track
    }
    return this.#value;
  }

  set value(newValue) {
    if (newValue !== this.#value) {
      this.#value = newValue;
      this.#subscribers.forEach((effect) => effect()); // Trigger
    }
  }

  /**
   * @template T2
   * @param {T2} initialValue 
   * @returns 
   */
  static ref(initialValue) {
    /** @type {State<T2>} */
    return new State(initialValue);
  }
}

//export state lib
window.State = State;
