import { useEffect, useRef } from "react";
import { useAuth } from "@getmocha/users-service/react";
import { useNavigate } from "react-router";
import { LoadingScreen } from "@/react-app/components/LoadingScreen";

export default function AuthCallbackPage() {
  const { exchangeCodeForSessionToken } = useAuth();
  const navigate = useNavigate();
  const hasAttemptedAuth = useRef(false);

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasAttemptedAuth.current) {
      return;
    }
    hasAttemptedAuth.current = true;

    const handleCallback = async () => {
      try {
        const result = await exchangeCodeForSessionToken();
        
        if (result === undefined || result === null) {
          throw new Error("Authentication failed: no session token received");
        }
        
        navigate("/", { replace: true });
      } catch (error) {
        console.error("[AuthCallback] Authentication error");
        navigate("/login", { replace: true });
      }
    };

    handleCallback();
  }, [exchangeCodeForSessionToken, navigate]);

  return <LoadingScreen isLoading={true} />;
}
