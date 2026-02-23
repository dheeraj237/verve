/**
 * User Menu - Shows user profile when logged in, theme toggle, and help options
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
import { User, HelpCircle, Github, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useUserStore } from "@/core/store/user-store";
import { useNavigate } from "react-router-dom";

export function UserMenu() {
  const { theme, setTheme } = useTheme();
  const { profile, isLoggedIn, logout } = useUserStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 overflow-hidden">
          {isLoggedIn && profile?.image ? (
            <img
              src={profile.image}
              alt={profile.name || "User"}
              className="h-full w-full object-cover rounded-full"
            />
          ) : (
            <User className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {isLoggedIn && profile ? (
          <>
            <DropdownMenuLabel className="truncate">👤 {profile.name || profile.email}</DropdownMenuLabel>
            {profile.email && <div className="px-2 py-1 text-xs text-muted-foreground truncate">{profile.email}</div>}
            <DropdownMenuSeparator />
          </>
        ) : (
          <>
            <DropdownMenuLabel>Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Theme</DropdownMenuLabel>
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
        {isLoggedIn && (
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        )}
        <DropdownMenuItem>
          <HelpCircle className="mr-2 h-4 w-4" />
          Help
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
