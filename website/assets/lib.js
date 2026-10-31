/**
 * internal obj managing effect states
 * @typedef {Object} EffectRecord
 * @property {() => void} run assigned by watch
 * @property {Set<State<any>>} deps States this effect is currently subscribed to.
 * @property {Function | null} cleanup cleanup returned by the most recent run, if any.
 * @property {boolean} running true while executing (blocks self-retrigger)
 * @property {boolean} stopped true once stopped. A stopped effect never runs again.
 */

/**
 * @template T
 */
class State {
  /**
   * @type {EffectRecord | null}
   */
  static #activeEffect = null;

  /** @return {EffectRecord} */
  static #createEffect() {
    return {
      run: () => {}, // assigned by watch / watchEffect
      deps: new Set(), // States this effect is subscribed to
      cleanup: null, // user cleanup fn returned by the last run
      running: false, // true while executing (blocks self-retrigger)
      stopped: false,
    };
  }

  /**
   * @param {EffectRecord} effect
   */
  static #runCleanup(effect) {
    if (effect.cleanup) {
      const fn = effect.cleanup;
      effect.cleanup = null;
      fn();
    }
  }

  /**
   * Unsubscribe the effect from every state it depends on.
   * @param {EffectRecord} effect
   */
  static #clearDeps(effect) {
    for (const state of effect.deps) {
      state.#subscribers.delete(effect);
    }
    effect.deps.clear();
  }

  /**
   * Subscribe the effect to a state (both directions).
   * @param {EffectRecord} effect
   * @param {State<any>} state
   */
  static #link(effect, state) {
    state.#subscribers.add(effect);
    effect.deps.add(state);
  }

  /**
   * Permanently stops the effect: runs the final cleanup and unsubscribes
   * @param {EffectRecord} effect 
   * @returns 
   */
  static #stop(effect) {
    if (effect.stopped) return;
    effect.stopped = true;
    State.#runCleanup(effect);
    State.#clearDeps(effect);
  }

  /**
   * Run `fn` with `effect` as the active tracker (or null for untracked),
   * restoring the previous tracker afterwards even if `fn` throws.
   * @param {EffectRecord} effect 
   * @param {EffectRecord?} tracker 
   * @param {Function} fn 
   */
  static #runWith(effect, tracker, fn) {
    const prevActive = State.#activeEffect;
    State.#activeEffect = tracker;
    effect.running = true;
    try {
      return fn();
    } finally {
      effect.running = false;
      State.#activeEffect = prevActive;
    }
  }

  /**
   * runs the effect immediately, during which it will track all read states inside the effect.
   * all relevant state changes will be subscribed to and the effect re-run.
   * @param {() => Function|void} effectFn may return a cleanup function, called before the
   *   next run and when stopped
   */
  static watchEffect(effectFn) {
    const effect = State.#createEffect();

    effect.run = () => {
      if (effect.stopped) return;

      State.#runCleanup(effect);
      State.#clearDeps(effect); // drop old deps, they're rebuilt below

      State.#runWith(effect, effect, () => {
        const cleanup = effectFn();
        if (typeof cleanup === "function") effect.cleanup = cleanup;
      });
    };

    effect.run();
    return () => State.#stop(effect);
  }

  /**
   * Watches a specific array of State instances.
   * Triggers immediately on setup and subsequently whenever any listed state changes.
   *
   * @param {State<any>[]} states - Array of State instances to watch
   * @param {(newValues: any[], oldValues: any[]) => Function|void} callback - Runs on change; can return a cleanup function.
   */
  static watch(states, callback) {
    if (!Array.isArray(states) || !states.every((s) => s instanceof State)) {
      console.error("State.watch expects an array of State instances.");
      return () => {};
    }

    const effect = State.#createEffect();

    /** @type {any[]} */
    let oldValues = states.map((s) => s.getValueUntracked());

    /**
     * Invokes the user callback untracked and stores its cleanup.
     * @param {any[]} newValues
     * @param {any[]} prevValues
     * @returns {void}
     */
    const execute = (newValues, prevValues) => {
      // tracker = null so callback reads dont trigger unwanted 
      State.#runWith(effect, null, () => {
        const cleanup = callback(newValues, prevValues);
        if (typeof cleanup === "function") effect.cleanup = cleanup;
      });
    };

    effect.run = () => {
      if (effect.stopped) return;
      State.#runCleanup(effect);

      const prevValues = oldValues;
      const newValues = states.map((s) => s.getValueUntracked());
      oldValues = newValues;
      execute(newValues, prevValues);
    };

    // Static dependency list: subscribe once, never rebuilt
    for (const state of states) State.#link(effect, state);

    execute(oldValues, []); // initial call
    return () => State.#stop(effect);
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

  /**
   * effects subscribed to this state
   * @type {Set<EffectRecord>}
   */
  #subscribers;
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
    const effect = State.#activeEffect;
    if (effect) State.#link(effect, this);
    return this.#value;
  }

  set value(newValue) {
    if (Object.is(newValue, this.#value)) return;
    this.#value = newValue;

    // in case effects unsubscribe/resubscribe while running, try stop infinite loop
    for (const effect of [...this.#subscribers]) {
      if (effect.running || effect.stopped) continue; // no self-retrigger
      effect.run();
    }
  }

  /**
   * Reads the current value without subscribing the active effect.
   * @returns {T}
   */
  getValueUntracked() {
    return this.#value;
  }
}

//export state lib
window.State = State;
