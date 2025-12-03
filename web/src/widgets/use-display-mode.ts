import { useOpenAiGlobal } from "skybridge/web";

export function useDisplayMode() {
  const displayMode = useOpenAiGlobal("displayMode") as "pip" | "inline" | "fullscreen";
  // const setDisplayMode = useOpenAiGlobal("requestDisplayMode") as (options: {
  //   mode: "pip" | "inline" | "fullscreen";
  // }) => void;
  return [displayMode];
}
