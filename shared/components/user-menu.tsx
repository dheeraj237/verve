/**
 * User Menu - Simplified for demo mode
 * Shows theme toggle and help options
 */
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { User, HelpCircle, Github } from "lucide-react";
import { useTheme } from "next-themes";

export function UserMenu() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <User className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Demo Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          {theme === "light" && "✓ "}Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          {theme === "dark" && "✓ "}Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          {theme === "system" && "✓ "}System
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        {/* <DropdownMenuItem asChild>
          <a
            href="https://github.com/dheeraj237/verve"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center"
          >
            <Github className="mr-2 h-4 w-4" />
            View on GitHub
          </a>
        </DropdownMenuItem> */}
        <DropdownMenuItem>
          <HelpCircle className="mr-2 h-4 w-4" />
          Help
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
