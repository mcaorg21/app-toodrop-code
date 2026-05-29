import { useEffect, useRef } from "react";
import { useAuth } from "@/react-app/hooks/useAuth";
import { LoadingScreen } from "@/react-app/components/LoadingScreen";

export default function AuthCallbackPage() {
  const { exchangeCodeForSessionToken } = useAuth();
  const hasAttemptedAuth = useRef(false);

  useEffect(() => {
    if (hasAttemptedAuth.current) return;
    hasAttemptedAuth.current = true;

    exchangeCodeForSessionToken()
      .then(() => {
        // Full reload so AuthProvider re-fetches the user with the new cookie
        window.location.replace("/");
      })
      .catch(() => {
        window.location.replace("/login");
      });
  }, [exchangeCodeForSessionToken]);

  return <LoadingScreen isLoading={true} />;
}
