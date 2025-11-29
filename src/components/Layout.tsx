import { Link } from "react-router-dom";
import { UserCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <Link to="/" className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-primary">
                    <span className="text-xl font-bold text-primary-foreground">BJJ</span>
                  </div>
                  <span className="hidden font-bold text-foreground sm:inline-block">
                    Academy Manager
                  </span>
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <Link to="/add-student">
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Student
                  </Button>
                </Link>
                <Button variant="ghost" size="icon">
                  <UserCircle className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
