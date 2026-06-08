import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserCircle, Plus, LogOut, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useMemo } from "react";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/students": "Students",
  "/add-student": "Add Student",
  "/memberships": "Memberships",
  "/past-due": "Past Due",
  "/attendance": "Attendance",
  "/schedule": "Schedule",
  "/settings": "Settings",
  "/profile": "Profile",
  "/help-center": "Help Center",
};

function Breadcrumbs() {
  const location = useLocation();
  const segments = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.map((_, i) => {
      const path = "/" + parts.slice(0, i + 1).join("/");
      const label = routeLabels[path];
      if (label) return { path, label };
      if (i > 0 && parts[i - 1] === "student") return { path, label: "Student Detail" };
      if (i > 0 && parts[i - 1] === "membership") return { path, label: "Membership Detail" };
      return { path, label: decodeURIComponent(parts[i]) };
    });
  }, [location.pathname]);

  if (segments.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground overflow-hidden">
      {segments.map((seg, i) => (
        <span key={seg.path} className="flex items-center gap-1 truncate">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
          {i < segments.length - 1 ? (
            <Link to={seg.path} className="hover:text-foreground transition-colors truncate">
              {seg.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium truncate">{seg.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { can, isAdmin } = useAuth();

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate("/login");
    } catch (error) {
      toast.error(error.message || "Error signing out");
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <Breadcrumbs />
              </div>
              <div className="flex items-center gap-4">
                {can("manage_students") && (
                  <Link to="/add-student">
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Student
                    </Button>
                  </Link>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <UserCircle className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {isAdmin && (
                      <>
                        <DropdownMenuItem onClick={() => navigate("/settings")}>
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
