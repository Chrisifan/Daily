import { createContext, useContext } from "react";

interface AppContextValue {
  openSettings: () => void;
}

export const AppContext = createContext<AppContextValue>({
  openSettings: () => {},
});

export function useAppContext() {
  return useContext(AppContext);
}