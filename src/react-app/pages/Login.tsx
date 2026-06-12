import { useEffect, useState } from "react";
import { useAuth } from "@/react-app/hooks/useAuth";
import { Navigate, useSearchParams } from "react-router";
import { useLoading } from "@/react-app/hooks/useLoading";
import { useTranslation } from "@/react-app/i18n";
import { AlertCircle, Mail, Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";

type AuthStep = "initial" | "email-input" | "login" | "register" | "verify-code" | "forgot-password" | "reset-password";

export default function LoginPage() {
  const { user, isPending, redirectToLogin } = useAuth();
  const { hideLoading } = useLoading();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const isSuspended = searchParams.get("suspended") === "true";
  const refCode = searchParams.get("ref");

  // Capture referral code on mount
  useEffect(() => {
    if (refCode) {
      localStorage.setItem("toodrop_referral_code", refCode);
      console.log("[Referral] Code captured:", refCode);
    }
  }, [refCode]);

  // Auth flow state
  const [step, setStep] = useState<AuthStep>("initial");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Helper to navigate with animation
  const navigateToStep = (newStep: AuthStep) => {
    setStep(newStep);
  };

  // Use scale + fade animation for all transitions
  const animationClass = "scale-fade-in";

  useEffect(() => {
    hideLoading();
  }, [hideLoading]);

  const resetForm = () => {
    navigateToStep("initial");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setVerificationCode("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError("");
    setSuccessMessage("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
  };

  const handleCheckEmail = async () => {
    if (!email.trim()) {
      setError(t("auth.enterEmail"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t("errors.invalidEmail"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/email-auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (data.isGoogleAccount) {
        setError(data.message);
        return;
      }

      if (data.exists && data.isVerified) {
        navigateToStep("login");
      } else if (data.exists && !data.isVerified) {
        // Account exists but not verified - go to register to get new code
        navigateToStep("register");
      } else {
        navigateToStep("register");
      }
    } catch (err) {
      setError(t("errors.verifyEmailError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!password) {
      setError(t("auth.enterPassword"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/email-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.isGoogleAccount) {
          setError(data.error);
          return;
        }
        if (data.needsVerification) {
          navigateToStep("register");
          return;
        }
        if (data.needsPasswordReset || data.isLocked) {
          setError(data.error);
          // Auto redirect to forgot password after 2 seconds
          setTimeout(() => {
            navigateToStep("forgot-password");
            setPassword("");
            setError("");
          }, 2000);
          return;
        }
        setError(data.error || t("errors.loginError"));
        return;
      }

      // Login successful - reload to update auth state
      window.location.href = "/";
    } catch (err) {
      setError(t("errors.loginError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!password) {
      setError(t("auth.enterPassword"));
      return;
    }

    if (password.length < 6) {
      setError(t("auth.minChars"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.passwordsNotMatch"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/email-auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.isGoogleAccount) {
          setError(data.error);
          return;
        }
        setError(data.error || t("errors.registerError"));
        return;
      }

      setSuccessMessage(t("auth.codeSent"));
      navigateToStep("verify-code");
    } catch (err) {
      setError(t("errors.registerError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError(t("auth.enterCode"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/email-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("errors.invalidCode"));
        return;
      }

      // Link referral if there's a stored referral code
      const storedReferralCode = localStorage.getItem("toodrop_referral_code");
      if (storedReferralCode) {
        try {
          const refRes = await fetch("/api/referrals/link-referred", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ referralCode: storedReferralCode }),
          });
          if (!refRes.ok) {
            const refData = await refRes.json().catch(() => ({}));
            console.error("[Referral] link-referred failed:", refRes.status, refData);
          }
        } catch (err) {
          console.error("[Referral] Error linking referral:", err);
        } finally {
          localStorage.removeItem("toodrop_referral_code");
        }
      }

      // Verification successful - reload to update auth state
      window.location.href = "/";
    } catch (err) {
      setError(t("errors.verifyCodeError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/email-auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("errors.resendCodeError"));
        return;
      }

      setSuccessMessage(t("auth.newCodeSent"));
    } catch (err) {
      setError(t("errors.resendCodeError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/email-auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("errors.sendCodeError"));
        return;
      }

      setSuccessMessage(t("auth.codeSent"));
      navigateToStep("reset-password");
    } catch (err) {
      setError(t("errors.sendCodeError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError(t("auth.enterCode"));
      return;
    }

    if (!newPassword) {
      setError(t("auth.enterNewPassword"));
      return;
    }

    if (newPassword.length < 6) {
      setError(t("auth.minChars"));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(t("auth.passwordsNotMatch"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/email-auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          email: email.trim(), 
          code: verificationCode,
          newPassword 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("errors.resetPasswordError"));
        return;
      }

      // Link referral if there's a stored referral code (not applicable for password reset, but clear it)
      localStorage.removeItem("toodrop_referral_code");

      // Password reset successful - reload to update auth state
      window.location.href = "/";
    } catch (err) {
      setError(t("errors.resetPasswordError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/email-auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("errors.resendCodeError"));
        return;
      }

      setSuccessMessage(t("auth.newCodeSent"));
    } catch (err) {
      setError(t("errors.resendCodeError"));
    } finally {
      setIsLoading(false);
    }
  };

  if (isPending) {
    return null;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <img 
        src="https://mocha-cdn.com/019acbcb-92a6-7eb2-9ee6-8b655e0ba462/Gemini_Generated_Image_sbx9ijsbx9ijsbx9-1-1-square-(1).png"
        alt="Background"
        className="absolute inset-0 w-full h-full object-cover animate-background"
      />
      
      {/* Animated gradient blobs */}
      <div className="absolute inset-0">
        <div className="gradient-blob-1 absolute top-0 -left-20 w-96 h-96 bg-gradient-to-br from-cyan-400/30 via-blue-500/20 to-transparent rounded-full blur-3xl"></div>
        <div className="gradient-blob-2 absolute bottom-0 -right-20 w-[500px] h-[500px] bg-gradient-to-tl from-blue-600/30 via-cyan-400/20 to-transparent rounded-full blur-3xl"></div>
        <div className="gradient-blob-1 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-teal-400/20 via-blue-400/15 to-cyan-300/20 rounded-full blur-3xl" style={{ animationDelay: '-5s' }}></div>
      </div>
      
      {/* Floating geometric shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="float-element absolute top-20 left-10 w-12 h-12 border-2 border-white/20 rounded-lg" style={{ animationDelay: '0s', animationDuration: '18s' }}></div>
        <div className="float-element absolute top-40 right-16 w-8 h-8 border-2 border-white/15 rounded-full" style={{ animationDelay: '-3s', animationDuration: '22s' }}></div>
        <div className="float-element absolute bottom-32 left-20 w-10 h-10 border-2 border-white/20 rounded-lg rotate-45" style={{ animationDelay: '-7s', animationDuration: '20s' }}></div>
        <div className="float-element absolute bottom-20 right-12 w-6 h-6 border-2 border-white/25 rounded-full" style={{ animationDelay: '-10s', animationDuration: '25s' }}></div>
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/5"></div>
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-3xl shadow-strong p-10 text-center">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl mb-6 px-8 py-4">
            <img 
              src="https://mocha-cdn.com/019acbcb-92a6-7eb2-9ee6-8b655e0ba462/Sem-nome-(200-x-80-px).png" 
              alt="Toodrop Logo"
              className="h-20 w-auto object-contain"
            />
          </div>
          
          {isSuspended && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-red-800 font-medium text-sm">{t("auth.accountSuspended")}</p>
                <p className="text-red-600 text-xs mt-1">
                  {t("auth.accountSuspendedMsg")}
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              {error.includes("conta Google") || error.includes("Google account") ? (
                <p className="text-red-700 text-sm text-left">
                  {t("auth.googleAccountError")}{" "}
                  <button 
                    onClick={resetForm}
                    className="font-bold underline hover:text-red-800"
                  >
                    {t("auth.clickHere")}
                  </button>{" "}
                  {t("auth.toGoBack")}
                </p>
              ) : (
                <p className="text-red-700 text-sm text-left">{error}</p>
              )}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-green-700 text-sm">{successMessage}</p>
            </div>
          )}

          {/* Initial Screen - Choose Login Method */}
          {step === "initial" && (
            <div className={animationClass}>
              <button
                onClick={redirectToLogin}
                className="w-full bg-action-600 hover:bg-action-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-medium hover:shadow-strong active:scale-98 flex items-center justify-center gap-3 mb-3"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
                  <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z" fill="#34A853"/>
                  <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05"/>
                  <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z" fill="#EA4335"/>
                </svg>
                {t("auth.loginWithGoogle")}
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-neutral-200"></div>
                <span className="text-neutral-400 text-sm">{t("auth.orContinueWith")}</span>
                <div className="flex-1 h-px bg-neutral-200"></div>
              </div>

              <button
                onClick={() => navigateToStep("email-input")}
                className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3"
              >
                <Mail className="w-5 h-5" />
                {t("auth.loginWithEmail")}
              </button>
            </div>
          )}

          {/* Email Input Screen */}
          {step === "email-input" && (
            <div className={animationClass}>
              <button
                onClick={resetForm}
                className="absolute top-6 left-6 p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-600" />
              </button>

              <h2 className="text-lg font-semibold text-neutral-800 mb-4">{t("auth.enterEmail")}</h2>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-action-500 focus:border-action-500 outline-none transition-all mb-4"
                onKeyDown={(e) => e.key === "Enter" && handleCheckEmail()}
                autoFocus
              />

              <button
                onClick={handleCheckEmail}
                disabled={isLoading}
                className="w-full bg-action-600 hover:bg-action-700 disabled:bg-action-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t("common.continue")
                )}
              </button>
            </div>
          )}

          {/* Login Screen */}
          {step === "login" && (
            <div className={animationClass}>
              <button
                onClick={() => { navigateToStep("email-input"); setPassword(""); setError(""); }}
                className="absolute top-6 left-6 p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-600" />
              </button>

              <h2 className="text-lg font-semibold text-neutral-800 mb-2">{t("auth.welcomeBack")}</h2>
              <p className="text-sm text-neutral-500 mb-4">{email}</p>

              <div className="relative mb-4">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.password")}
                  className="w-full px-4 py-3 pr-12 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-action-500 focus:border-action-500 outline-none transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full bg-action-600 hover:bg-action-700 disabled:bg-action-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t("auth.login")
                )}
              </button>

              <button
                onClick={() => { navigateToStep("forgot-password"); setPassword(""); setError(""); }}
                className="mt-3 text-action-600 hover:text-action-700 text-sm font-medium"
              >
                {t("auth.forgotPassword")}
              </button>
            </div>
          )}

          {/* Register Screen */}
          {step === "register" && (
            <div className={animationClass}>
              <button
                onClick={() => { navigateToStep("email-input"); setPassword(""); setConfirmPassword(""); setError(""); }}
                className="absolute top-6 left-6 p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-600" />
              </button>

              <h2 className="text-lg font-semibold text-neutral-800 mb-2">{t("auth.createAccount")}</h2>
              <p className="text-sm text-neutral-500 mb-4">{email}</p>

              <div className="relative mb-3">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.createPassword")}
                  className="w-full px-4 py-3 pr-12 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-action-500 focus:border-action-500 outline-none transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="relative mb-4">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.confirmPassword")}
                  className="w-full px-4 py-3 pr-12 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-action-500 focus:border-action-500 outline-none transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <button
                onClick={handleRegister}
                disabled={isLoading}
                className="w-full bg-action-600 hover:bg-action-700 disabled:bg-action-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t("auth.register")
                )}
              </button>
            </div>
          )}

          {/* Verify Code Screen */}
          {step === "verify-code" && (
            <div className={animationClass}>
              <button
                onClick={() => { navigateToStep("register"); setVerificationCode(""); setError(""); setSuccessMessage(""); }}
                className="absolute top-6 left-6 p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-600" />
              </button>

              <h2 className="text-lg font-semibold text-neutral-800 mb-2">{t("auth.verifyEmail")}</h2>
              <p className="text-sm text-neutral-500 mb-4">
                {t("auth.enterCodeSentTo")}<br />
                <span className="font-medium text-neutral-700">{email}</span>
              </p>

              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-4 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-action-500 focus:border-action-500 outline-none transition-all text-center text-2xl font-bold tracking-[0.5em] mb-4"
                onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                autoFocus
                maxLength={6}
              />

              <button
                onClick={handleVerifyCode}
                disabled={isLoading || verificationCode.length !== 6}
                className="w-full bg-action-600 hover:bg-action-700 disabled:bg-action-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mb-3"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t("auth.verify")
                )}
              </button>

              <button
                onClick={handleResendCode}
                disabled={isLoading}
                className="text-action-600 hover:text-action-700 text-sm font-medium"
              >
                {t("auth.resendCode")}
              </button>
            </div>
          )}

          {/* Forgot Password Screen */}
          {step === "forgot-password" && (
            <div className={animationClass}>
              <button
                onClick={() => { navigateToStep("login"); setError(""); }}
                className="absolute top-6 left-6 p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-600" />
              </button>

              <h2 className="text-lg font-semibold text-neutral-800 mb-2">{t("auth.recoverPassword")}</h2>
              <p className="text-sm text-neutral-500 mb-4">
                {t("auth.recoveryCodeSentTo")}<br />
                <span className="font-medium text-neutral-700">{email}</span>
              </p>

              <button
                onClick={handleForgotPassword}
                disabled={isLoading}
                className="w-full bg-action-600 hover:bg-action-700 disabled:bg-action-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t("auth.sendCode")
                )}
              </button>
            </div>
          )}

          {/* Reset Password Screen */}
          {step === "reset-password" && (
            <div className={animationClass}>
              <button
                onClick={() => { navigateToStep("forgot-password"); setVerificationCode(""); setNewPassword(""); setConfirmNewPassword(""); setError(""); setSuccessMessage(""); }}
                className="absolute top-6 left-6 p-2 hover:bg-neutral-100 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-neutral-600" />
              </button>

              <h2 className="text-lg font-semibold text-neutral-800 mb-2">{t("auth.newPassword")}</h2>
              <p className="text-sm text-neutral-500 mb-4">
                {t("auth.enterCodeTo")}<br />
                <span className="font-medium text-neutral-700">{email}</span>
              </p>

              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-4 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-action-500 focus:border-action-500 outline-none transition-all text-center text-2xl font-bold tracking-[0.5em] mb-3"
                autoFocus
                maxLength={6}
              />

              <div className="relative mb-3">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("auth.createPassword")}
                  className="w-full px-4 py-3 pr-12 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-action-500 focus:border-action-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="relative mb-4">
                <input
                  type={showConfirmNewPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder={t("auth.confirmNewPassword")}
                  className="w-full px-4 py-3 pr-12 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-action-500 focus:border-action-500 outline-none transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {showConfirmNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <button
                onClick={handleResetPassword}
                disabled={isLoading || verificationCode.length !== 6}
                className="w-full bg-action-600 hover:bg-action-700 disabled:bg-action-400 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 mb-3"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t("auth.resetPassword")
                )}
              </button>

              <button
                onClick={handleResendResetCode}
                disabled={isLoading}
                className="text-action-600 hover:text-action-700 text-sm font-medium"
              >
                {t("auth.resendCode")}
              </button>
            </div>
          )}

          <p className="text-xs text-neutral-500 mt-8">
            {t("auth.termsAgree")}{" "}
            <a 
              href="https://www.toodrop.com/termos-de-uso" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-action-600 hover:text-action-700 underline"
            >
              {t("auth.termsOfUse")}
            </a>
            {" "}{t("common.and")}{" "}
            <a 
              href="https://www.toodrop.com/privacidade" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-action-600 hover:text-action-700 underline"
            >
              {t("auth.privacyPolicy")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

