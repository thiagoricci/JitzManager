import { useTheme } from "@/contexts/ThemeContext";
import { themePresets } from "@/lib/themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sun, Moon, Monitor } from "lucide-react";

export default function AppearanceCard() {
  const { theme, mode, setThemeById, setMode } = useTheme();

  const modes = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Customize the look and feel of your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium">Mode</label>
          <div className="flex gap-2">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`flex items-center gap-2 rounded-md border px-4 py-2 text-sm transition-colors ${
                  mode === m.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Theme</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {themePresets.map((preset) => {
              const isActive = theme.id === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setThemeById(preset.id)}
                  className={`group relative flex flex-col rounded-lg border p-3 text-left transition-all ${
                    isActive
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="h-5 w-5 rounded-full shrink-0 border border-border"
                      style={{ backgroundColor: preset.preview.primary }}
                    />
                    <div
                      className="h-5 w-5 rounded-full shrink-0 border border-border"
                      style={{ backgroundColor: preset.preview.accent }}
                    />
                    <div
                      className="h-5 w-5 rounded-full shrink-0 border border-border"
                      style={{ backgroundColor: preset.preview.background }}
                    />
                  </div>
                  <span className="text-sm font-medium">{preset.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                  {isActive && (
                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
