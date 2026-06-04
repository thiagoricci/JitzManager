import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ADMIN_ROLES, hasPermission, isRole, Permission, Role } from "@/lib/permissions";

type Profile = {
  id: string;
  organization_id: string | null;
  role: string;
  full_name: string | null;
  email: string | null;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  timezone: string;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean;
  waiver_text: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  role: Role | null;
  isAdmin: boolean;
  can: (permission: Permission) => boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: (silent?: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setOrganization(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError) {
        // Ignore error if profile doesn't exist yet (new user)
        if (profileError.code === "PGRST116") {
          // This is expected for new users, so we can ignore it.
        } else {
          console.error("Error fetching profile:", profileError);
        }
      } else {
        setProfile(profileData);

        if (profileData && profileData.organization_id) {
          const { data: orgData, error: orgError } = await supabase
            .from("organizations")
            .select(
              "id, name, slug, logo_url, address, timezone, stripe_account_id, stripe_charges_enabled, waiver_text"
            )
            .eq("id", profileData.organization_id)
            .single();
            
          if (orgError) {
            console.error("Error fetching organization:", orgError);
          } else {
            setOrganization(orgData);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async (silent = false) => {
    if (user) {
      if (!silent) setLoading(true);
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setOrganization(null);
    setUser(null);
    setSession(null);
  };

  useEffect(() => {
    const link: HTMLLinkElement =
      document.querySelector("link[rel~='icon']") ||
      (() => {
        const l = document.createElement("link");
        l.rel = "icon";
        document.head.appendChild(l);
        return l;
      })();

    if (organization?.logo_url) {
      link.href = organization.logo_url;
      link.type = undefined;
    } else {
      link.href = "/favicon.ico";
      link.type = undefined;
    }
  }, [organization?.logo_url]);

  const role = isRole(profile?.role) ? profile!.role : null;
  const isAdmin = !!role && ADMIN_ROLES.includes(role);
  const can = (permission: Permission) => hasPermission(role, permission);

  return (
    <AuthContext.Provider value={{ session, user, profile, organization, role, isAdmin, can, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};