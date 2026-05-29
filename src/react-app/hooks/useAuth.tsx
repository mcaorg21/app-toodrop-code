import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AuthUser {
  id: string;
  email: string;
  isEmailAuth?: boolean;
  emailCredentialId?: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isPending: boolean;
  redirectToLogin: () => Promise<void>;
  exchangeCodeForSessionToken: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    fetch("/api/users/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setIsPending(false));
  }, []);

  async function redirectToLogin() {
    const res = await fetch("/api/oauth/google/redirect_url");
    const data = await res.json();
    window.location.href = data.redirectUrl;
  }

  async function exchangeCodeForSessionToken() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) throw new Error("No code in URL");

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Authentication failed");
    }

    // Cookie was just set — fetch user so AuthProvider state is ready before navigate
    const userRes = await fetch("/api/users/me", { credentials: "include" });
    const userData = userRes.ok ? await userRes.json() : null;
    setUser(userData);
  }

  async function logout() {
    await fetch("/api/logout", { credentials: "include" });
    setUser(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider value={{ user, isPending, redirectToLogin, exchangeCodeForSessionToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
