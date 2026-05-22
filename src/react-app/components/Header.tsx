import { useState, useRef, useEffect } from "react";
import { useAuth } from "@getmocha/users-service/react";
import { Power, User as UserIcon, Shield, ChevronDown, ShoppingBag, Home, Truck, Settings, Receipt } from "lucide-react";
import { Link, useLocation } from "react-router";
import type { User } from "@/shared/types";
import { useLoading } from "@/react-app/hooks/useLoading";
import { useTranslation } from "@/react-app/i18n";
import { ProfileMenuModal } from "./ProfileMenuModal";

interface HeaderProps {
  profile: User | null;
  showAdminLink?: boolean;
  onProfileUpdate?: (profile: User) => void;
  activeTab?: "consumer" | "receiver" | "delivery";
  onTabChange?: (tab: "consumer" | "receiver" | "delivery") => void;
  onShowExtract?: () => void;
}

export function Header({ profile, showAdminLink = false, onProfileUpdate, activeTab, onShowExtract }: HeaderProps) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { showLoading } = useLoading();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const profileTabs = [
    { id: "consumer" as const, label: t("profiles.consumer.name"), sublabel: t("profiles.consumer.subtitle"), icon: ShoppingBag },
    { id: "receiver" as const, label: t("profiles.receiver.name"), sublabel: t("profiles.receiver.subtitle"), icon: Home },
    { id: "delivery" as const, label: t("profiles.driver.name"), sublabel: t("profiles.driver.subtitle"), icon: Truck },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentTab = profileTabs.find(t => t.id === activeTab);
  const isProfileComplete = profile?.profile_status !== "incomplete";

  const handleLogout = async () => {
    showLoading();
    await logout();
  };

  return (
    <header className="bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/">
              <img 
                src="https://mocha-cdn.com/019acbcb-92a6-7eb2-9ee6-8b655e0ba462/Sem-nome-(200-x-80-px).png" 
                alt="Toodrop Logo"
                className="h-9 w-auto object-contain"
              />
            </Link>
            {showAdminLink && (
              <>
                {location.pathname.startsWith("/admin") ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold border border-red-200">
                      <Shield className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {t("header.adminMode")}
                    </span>
                    <Link
                      to="/"
                      className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      {t("header.userMode")}
                    </Link>
                  </div>
                ) : (
                  <Link
                    to="/admin"
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-semibold border border-red-200 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" strokeWidth={2.5} />
                    {t("header.admin")}
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Logout button - visible when profile is incomplete */}
            {profile && !isProfileComplete && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200"
              >
                <Power className="w-4 h-4" strokeWidth={2} />
                <span className="text-sm font-medium hidden sm:inline">{t("header.logout")}</span>
              </button>
            )}
            
            {/* Combined User & Profile Selector - only show when profile is complete */}
            {profile?.full_name && isProfileComplete && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 hover:bg-neutral-100 rounded-lg px-2 sm:px-3 py-2 transition-colors group"
                >
                  {/* Profile icon with tab indicator */}
                  <div className="relative">
                    <div className="bg-primary-100 p-2 rounded-full group-hover:bg-primary-200 transition-colors">
                      <UserIcon className="w-4 h-4 text-primary-700" strokeWidth={2.5} />
                    </div>
                    {isProfileComplete && (
                      <div className="absolute -bottom-2 -right-2 bg-action-600 p-1 rounded-full border-2 border-white shadow-sm">
                        <Settings className="w-3 h-3 text-white" strokeWidth={2.5} />
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <span className="text-sm font-medium text-neutral-700 block leading-tight">
                      {profile.full_name.split(' ')[0]}
                    </span>
                    {currentTab && isProfileComplete && (
                      <span className="text-xs text-action-600 font-medium leading-tight">
                        {currentTab.label}
                      </span>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-neutral-500 group-hover:text-neutral-700 transition-all ${showDropdown ? 'rotate-180' : ''}`} strokeWidth={2} />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-neutral-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* Extrato - only show if commission address is configured */}
                    {(profile as any)?.asaas_wallet_id && (profile as any)?.asaas_api_key && (
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          onShowExtract?.();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 text-neutral-700 transition-colors"
                      >
                        <div className="p-1.5 rounded-lg bg-neutral-100">
                          <Receipt className="w-4 h-4 text-neutral-500" strokeWidth={2} />
                        </div>
                        <span className="text-sm font-medium">{t("header.extract")}</span>
                      </button>
                    )}

                    {/* Settings - only show if profile is complete */}
                    {isProfileComplete && (
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          setShowProfileMenu(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-50 text-neutral-700 transition-colors"
                      >
                        <div className="p-1.5 rounded-lg bg-neutral-100">
                          <Settings className="w-4 h-4 text-neutral-500" strokeWidth={2} />
                        </div>
                        <span className="text-sm font-medium">{t("header.settings")}</span>
                      </button>
                    )}

                    {/* Logout - always show when profile is complete */}
                    {isProfileComplete && (
                      <>
                        <div className="border-t border-neutral-100 my-2" />
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-red-600 transition-colors"
                        >
                          <div className="p-1.5 rounded-lg bg-red-50">
                            <Power className="w-4 h-4 text-red-600" strokeWidth={2} />
                          </div>
                          <span className="text-sm font-medium">{t("header.logout")}</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showProfileMenu && (
        <ProfileMenuModal
          profile={profile}
          onClose={() => setShowProfileMenu(false)}
          onProfileUpdate={onProfileUpdate}
          activeTab={activeTab}
        />
      )}
    </header>
  );
}
