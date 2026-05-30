import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { themePresets, type ThemePreset } from "@/lib/themes";
import { useAuth } from "./AuthContext";

type ThemeMode = "light" | "dark" | "system";

type ThemeContextType = {
  theme: ThemePreset;
  mode: ThemeMode;
  setThemeById: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
  resolvedMode: "light" | "dark";
};

const STORAGE_KEY_THEME = "app-theme-id";
const STORAGE_KEY_MODE = "app-theme-mode";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemMode(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemePreset>(() => {
    const savedId = localStorage.getItem(STORAGE_KEY_THEME);
    return themePresets.find((t) => t.id === savedId) || themePresets[0];
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    const savedMode = localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode | null;
    return savedMode || "system";
  });

  const [systemDark, setSystemDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedMode: "light" | "dark" =
    mode === "system" ? (systemDark ? "dark" : "light") : mode;

  const setThemeById = (id: string) => {
    const preset = themePresets.find((t) => t.id === id);
    if (preset) {
      setTheme(preset);
      localStorage.setItem(STORAGE_KEY_THEME, id);
    }
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY_MODE, newMode);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, mode, setThemeById, setMode, resolvedMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export function AccountThemeScope({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, mode, resolvedMode, setThemeById, setMode } = useTheme();
  const { organization } = useAuth();
  const orgIdRef = useRef<string | null>(null);
  const appliedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const orgId = organization?.id;
    if (!orgId) return;

    if (orgIdRef.current !== orgId) {
      orgIdRef.current = orgId;
      const savedThemeId = localStorage.getItem(`org-theme-${orgId}`);
      const savedMode = localStorage.getItem(`org-mode-${orgId}`);

      if (savedThemeId) {
        const preset = themePresets.find((t) => t.id === savedThemeId);
        if (preset) setThemeById(savedThemeId);
      }
      if (
        savedMode === "light" ||
        savedMode === "dark" ||
        savedMode === "system"
      ) {
        setMode(savedMode);
      }
    }
  }, [organization?.id, setThemeById, setMode]);

  useEffect(() => {
    const orgId = organization?.id;
    if (!orgId) return;
    localStorage.setItem(`org-theme-${orgId}`, theme.id);
  }, [theme.id, organization?.id]);

  useEffect(() => {
    const orgId = organization?.id;
    if (!orgId) return;
    localStorage.setItem(`org-mode-${orgId}`, mode);
  }, [mode, organization?.id]);

  useEffect(() => {
    const root = document.documentElement;
    const vars =
      resolvedMode === "dark" ? theme.dark : theme.light;
    const keys = Object.keys(vars);

    root.classList.toggle("dark", resolvedMode === "dark");

    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    appliedKeysRef.current = new Set(keys);

    return () => {
      for (const key of appliedKeysRef.current) {
        root.style.removeProperty(key);
      }
      root.classList.remove("dark");
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      root.classList.toggle("dark", prefersDark);
    };
  }, [theme, resolvedMode]);

  return <>{children}</>;
}
