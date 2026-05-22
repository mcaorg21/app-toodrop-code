import { ShoppingBag, Home, Truck } from "lucide-react";
import type { User } from "@/shared/types";

interface ProfileTabsProps {
  activeTab: "consumer" | "receiver" | "delivery";
  onTabChange: (tab: "consumer" | "receiver" | "delivery") => void;
  onDisabledTabClick: (needsCommissionAddress: boolean) => void;
  profile: User | null;
}

export function ProfileTabs({ activeTab, onTabChange, onDisabledTabClick, profile }: ProfileTabsProps) {
  const isProfileComplete = profile?.profile_status !== "incomplete";
  const hasCommissionAddress = !!(profile as any)?.asaas_wallet_id;

  const tabs = [
    {
      id: "consumer" as const,
      label: "Dropper One",
      sublabel: "Quem Compra",
      icon: ShoppingBag,
      enabled: isProfileComplete,
      visible: true,
    },
    {
      id: "receiver" as const,
      label: "TooDropper",
      sublabel: "Quem Recebe",
      icon: Home,
      enabled: isProfileComplete && hasCommissionAddress,
      visible: true,
    },
    {
      id: "delivery" as const,
      label: "Dropper",
      sublabel: "Quem Entrega",
      icon: Truck,
      enabled: isProfileComplete && hasCommissionAddress,
      visible: true,
    },
  ].filter(tab => tab.visible);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 safe-area-inset-bottom z-40">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            const handleClick = (e: React.MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              if (tab.enabled) {
                onTabChange(tab.id);
              } else {
                // Check if profile is complete but missing commission address
                const needsCommissionAddress = isProfileComplete && !hasCommissionAddress && (tab.id === "receiver" || tab.id === "delivery");
                onDisabledTabClick(needsCommissionAddress);
              }
            };

            return (
              <button
                key={tab.id}
                onClick={handleClick}
                className={`
                  flex flex-col items-center justify-center gap-0.5 py-2 px-4 transition-all duration-300 min-w-[80px] relative rounded-lg
                  ${isActive 
                    ? "text-action-600 bg-action-50 shadow-lg shadow-action-200/50 scale-105" 
                    : tab.enabled
                    ? "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50"
                    : "text-neutral-300 cursor-not-allowed"
                  }
                `}
                type="button"
              >
                <Icon className={`transition-all duration-300 ${isActive ? 'w-7 h-7' : 'w-6 h-6'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-xs leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {tab.label}
                </span>
                <span className={`text-[10px] leading-tight ${isActive ? 'font-medium' : 'font-normal'}`}>
                  {tab.sublabel}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 h-1 w-16 bg-gradient-to-r from-action-400 via-action-600 to-action-400 rounded-t-full shadow-md shadow-action-300" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
