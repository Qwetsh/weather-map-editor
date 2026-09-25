import { useCallback, useMemo, useReducer } from "react";

/**
 * Historique annuler / rétablir.
 *
 * - `set` enregistre une étape. Avec une clé `coalesce`, les modifications
 *   successives rapprochées (frappe clavier, flèches) fusionnent en une seule étape.
 * - `preview` modifie l'état sans l'enregistrer (glisser-déposer, redimensionnement) ;
 *   `commitPreview` enregistre ensuite le geste entier comme une seule étape.
 */

const MAX_STEPS = 100;
const COALESCE_MS = 1200;

type Updater<T> = (prev: T) => T;

type State<T> = {
  past: T[];
  present: T;
  future: T[];
  previewBase: T | null;
  lastCoalesce: { key: string; at: number } | null;
};

type Action<T> =
  | { type: "set"; updater: Updater<T>; coalesce?: string; now: number }
  | { type: "preview"; updater: Updater<T> }
  | { type: "commitPreview" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset"; value: T };

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case "set": {
      const base = state.previewBase ?? state.present;
      const next = action.updater(state.present);
      if (next === state.present && state.previewBase === null) return state;
      const last = state.lastCoalesce;
      const merge =
        action.coalesce !== undefined &&
        last?.key === action.coalesce &&
        action.now - last.at < COALESCE_MS &&
        state.previewBase === null;
      return {
        past: merge ? state.past : [...state.past, base].slice(-MAX_STEPS),
        present: next,
        future: [],
        previewBase: null,
        lastCoalesce: action.coalesce ? { key: action.coalesce, at: action.now } : null,
      };
    }
    case "preview": {
      const next = action.updater(state.present);
      if (next === state.present) return state;
      return { ...state, present: next, previewBase: state.previewBase ?? state.present };
    }
    case "commitPreview": {
      if (state.previewBase === null) return state;
      if (state.previewBase === state.present) return { ...state, previewBase: null };
      return {
        past: [...state.past, state.previewBase].slice(-MAX_STEPS),
        present: state.present,
        future: [],
        previewBase: null,
        lastCoalesce: null,
      };
    }
    case "undo": {
      const base = state.previewBase ?? state.present;
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [base, ...state.future],
        previewBase: null,
        lastCoalesce: null,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, state.previewBase ?? state.present],
        present: state.future[0],
        future: state.future.slice(1),
        previewBase: null,
        lastCoalesce: null,
      };
    }
    case "reset":
      return { past: [], present: action.value, future: [], previewBase: null, lastCoalesce: null };
  }
}

export function useHistory<T>(init: () => T) {
  const [state, dispatch] = useReducer(reducer<T>, undefined, () => ({
    past: [],
    present: init(),
    future: [],
    previewBase: null,
    lastCoalesce: null,
  }));

  const set = useCallback(
    (updater: Updater<T>, options?: { coalesce?: string }) =>
      dispatch({ type: "set", updater, coalesce: options?.coalesce, now: Date.now() }),
    [],
  );
  const preview = useCallback((updater: Updater<T>) => dispatch({ type: "preview", updater }), []);
  const commitPreview = useCallback(() => dispatch({ type: "commitPreview" }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const reset = useCallback((value: T) => dispatch({ type: "reset", value }), []);

  return useMemo(
    () => ({
      present: state.present,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      set,
      preview,
      commitPreview,
      undo,
      redo,
      reset,
    }),
    [state.present, state.past.length, state.future.length, set, preview, commitPreview, undo, redo, reset],
  );
}
