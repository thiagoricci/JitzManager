import { LayoutDashboard, Users, CreditCard, CalendarCheck, Calendar, Settings, HelpCircle } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Students", url: "/students", icon: Users },
  { title: "Memberships", url: "/memberships", icon: CreditCard },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck },
  { title: "Schedule", url: "/schedule", icon: Calendar },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Help Center", url: "/help-center", icon: HelpCircle },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const { organization } = useAuth();

  return (
    <Sidebar className={open ? "w-64" : "w-16"} collapsible="icon">
      <SidebarHeader className="p-4">
        {open && (
          <div className="px-2 flex items-center gap-3">
            {organization?.logo_url && (
              <img
                src={organization.logo_url}
                alt={organization?.name || "Logo"}
                className="h-12 w-12 shrink-0 object-contain rounded"
              />
            )}
            <h1 className="text-base font-bold leading-tight line-clamp-2" title={organization?.name || "Academy Manager"}>
              {organization?.name || "Academy Manager"}
            </h1>
          </div>
        )}
        {!open && organization?.logo_url && (
          <img
            src={organization.logo_url}
            alt=""
            className="h-12 w-12 mx-auto object-contain"
          />
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="lg" className="text-lg h-12">
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-muted/50"
                      activeClassName="bg-muted text-primary font-medium"
                    >
                      <item.icon className="h-6 w-6" />
                      {open && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
