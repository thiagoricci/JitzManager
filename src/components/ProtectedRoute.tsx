import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Permission } from "@/lib/permissions";

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  permission,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  permission?: Permission;
}) {
  const { session, profile, isAdmin, can, loading } = useAuth();
  const [profileCheckComplete, setProfileCheckComplete] = useState(false);

  // If user is authenticated but no profile, wait a bit for profile to load
  useEffect(() => {
    if (session && profile === null && !loading) {
      const timeout = setTimeout(() => {
        setProfileCheckComplete(true);
      }, 2000); // Wait up to 2 seconds for profile to load

      return () => clearTimeout(timeout);
    } else {
      setProfileCheckComplete(true);
    }
  }, [session, profile, loading]);

  if (loading || !profileCheckComplete) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  if (!profile || !profile.organization_id) {
    return <Navigate to="/onboarding" />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" />;
  }

  if (permission && !can(permission)) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
}