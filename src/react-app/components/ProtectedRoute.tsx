import { useAuth } from "@getmocha/users-service/react";
import { Navigate, useLocation } from "react-router";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isPending } = useAuth();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    // Preserve query parameters (like ?ref=) when redirecting to login
    const loginUrl = `/login${location.search}`;
    return <Navigate to={loginUrl} replace />;
  }

  return <>{children}</>;
}
