import { LayoutDashboard, Users, CreditCard, CalendarCheck, Calendar, Settings, HelpCircle, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const { organization, isAdmin, can } = useAuth();

  const mainItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Students", url: "/students", icon: Users },
    // Memberships is billing config — only roles that manage billing see it.
    ...(can("manage_billing")
      ? [{ title: "Memberships", url: "/memberships", icon: CreditCard }]
      : []),
    { title: "Attendance", url: "/attendance", icon: CalendarCheck },
    { title: "Schedule", url: "/schedule", icon: Calendar },
  ];

  const secondaryItems = [
    { title: "Profile", url: "/profile", icon: User },
    ...(isAdmin ? [{ title: "Settings", url: "/settings", icon: Settings }] : []),
    { title: "Help Center", url: "/help-center", icon: HelpCircle },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="px-2 flex items-center gap-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <img
            src={organization?.logo_url || "/logo.png"}
            alt={organization?.name || "JitzManager"}
            className="h-12 w-12 shrink-0 object-contain rounded group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10"
          />
          <h1
            className="text-base font-bold leading-tight line-clamp-2 font-display group-data-[collapsible=icon]:hidden"
            title={organization?.name || "Academy Manager"}
          >
            {organization?.name || "Academy Manager"}
          </h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavLink
                    to={item.url}
                    end
                    className={cn(
                      "flex items-center rounded-md p-2 h-12",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      "transition-colors",
                      "gap-3 px-4",
                      "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-12"
                    )}
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <item.icon className="h-6 w-6 shrink-0 group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavLink
                    to={item.url}
                    end
                    className={cn(
                      "flex items-center rounded-md p-2 h-12",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      "transition-colors",
                      "gap-3 px-4",
                      "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-12"
                    )}
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <item.icon className="h-6 w-6 shrink-0 group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
