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
import { useUserStore } from "@/core/store/user-store";
import { useNavigate } from "react-router-dom";

export function UserMenu() {
  const { profile, isLoggedIn, logout } = useUserStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // console.log("UserMenu - isLoggedIn:", isLoggedIn, "profile:", profile);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 p-0 rounded-full overflow-hidden border border-border"
        >
          {isLoggedIn && profile?.image ? (
            <img
              src={profile.image}
              alt={profile.name || "User"}
              className="h-8 w-8 object-cover rounded-full"
            />
          ) : (
              <User className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] border border-border backdrop-blur-none"
      >
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
