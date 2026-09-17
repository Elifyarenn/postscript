/**
 * Undo / redo for the avatar builder (D-195). Every change, "Rastgele" and
 * "Sıfırla" go through `set`, so each can be taken back. Pure, so it is tested
 * without a browser.
 */
import type { AvatarConfig } from "./registry";

export type History = { past: AvatarConfig[]; present: AvatarConfig; future: AvatarConfig[] };
export type HistoryAction = { type: "set"; config: AvatarConfig } | { type: "undo" } | { type: "redo" };

/** Enough to walk back a whole session; older steps fall off. */
export const HISTORY_LIMIT = 60;

export function historyReducer(state: History, action: HistoryAction): History {
  switch (action.type) {
    case "set":
      // Picking what is already chosen must not add an empty step
      if (JSON.stringify(action.config) === JSON.stringify(state.present)) return state;
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: action.config, future: [] };
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return { past: [...state.past, state.present], present: next, future: state.future.slice(1) };
    }
  }
}
