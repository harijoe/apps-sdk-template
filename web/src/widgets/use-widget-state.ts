import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { useOpenAiGlobal } from "skybridge/web";

type UnknownObject = Record<string, unknown>;
export function useWidgetState<T extends UnknownObject>(
  defaultState: T | (() => T),
): readonly [T, (state: SetStateAction<T>) => void];
export function useWidgetState<T extends UnknownObject>(
  defaultState?: T | (() => T | null) | null,
): readonly [T | null, (state: SetStateAction<T | null>) => void];
export function useWidgetState<T extends UnknownObject>(
  defaultState?: T | (() => T | null) | null,
): readonly [T | null, (state: SetStateAction<T | null>) => void] {
  const widgetStateFromWindow = useOpenAiGlobal("widgetState") as T;

  const [widgetState, _setWidgetState] = useState<T | null>(() => {
    console.log("[INIT] INITIALIZING LOCAL STATE");
    if (widgetStateFromWindow != null) {
      console.log("[INIT] OPEN AI STATE NOT NULL, RETURNING OPENAI STATE");
      console.log(widgetStateFromWindow);
      return widgetStateFromWindow;
    }

    console.log("[INIT] OPEN AI STATE IS NULL, RETURNING DEFAULT STATE");
    return typeof defaultState === "function" ? defaultState() : (defaultState ?? null);
  });

  useEffect(() => {
    console.log("[UPDATE] RECEIVING OPENAI STATE");
    if (widgetStateFromWindow != null) {
      console.log("[UPDATE] OPEN AI STATE NOT NULL, TRIGGERING LOCAL STATE UPDATE");
      console.log(widgetStateFromWindow);
      _setWidgetState(widgetStateFromWindow);
    }
  }, [widgetStateFromWindow]);

  const setWidgetState = useCallback(
    (state: SetStateAction<T | null>) => {
      console.log("[SET] SETTING WIDGET STATE");
      _setWidgetState((prevState) => {
        const newState = typeof state === "function" ? state(prevState) : state;

        if (newState != null) {
          console.log("[SET] NEW STATE IS NOT NULL, TRIGGERING OPENAI STATE UPDATE");
          window.openai.setWidgetState(newState);
        }

        return newState;
      });
    },
    [window.openai.setWidgetState],
  );

  return [widgetState, setWidgetState] as const;
}
