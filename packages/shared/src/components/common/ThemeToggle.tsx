
import { Button } from "@phinduloans/shared/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@phinduloans/shared/components/ui/dropdown-menu";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@phinduloans/shared/theme/ThemeProvider";
import { cn } from "@phinduloans/shared/lib/utils";

interface ThemeToggleProps {
    variant?: "default" | "minimal";
    className?: string;
}

const ThemeToggle = ({ variant = "default", className }: ThemeToggleProps) => {
    const { theme, setTheme, resolvedTheme } = useTheme();

    if (variant === "minimal") {
        return (
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className={cn("h-9 w-9", className)}
            >
                {resolvedTheme === "dark" ? (
                    <Sun size={18} className="text-yellow-500" />
                ) : (
                    <Moon size={18} className="text-slate-700" />
                )}
                <span className="sr-only">Toggle theme</span>
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("h-9 w-9", className)}>
                    {resolvedTheme === "dark" ? (
                        <Moon size={18} className="text-primary" />
                    ) : (
                        <Sun size={18} className="text-yellow-500" />
                    )}
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass border-border/50">
                <DropdownMenuItem
                    onClick={() => setTheme("light")}
                    className={cn("cursor-pointer gap-2", theme === "light" && "bg-primary/10")}
                >
                    <Sun size={16} className="text-yellow-500" />
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme("dark")}
                    className={cn("cursor-pointer gap-2", theme === "dark" && "bg-primary/10")}
                >
                    <Moon size={16} className="text-slate-400" />
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => setTheme("system")}
                    className={cn("cursor-pointer gap-2", theme === "system" && "bg-primary/10")}
                >
                    <Monitor size={16} className="text-muted-foreground" />
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

export default ThemeToggle;
