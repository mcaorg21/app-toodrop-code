import { useEffect, useState } from "react";
import { useTranslation } from "@/react-app/i18n";

interface LoadingScreenProps {
  isLoading: boolean;
  minDuration?: number;
  message?: string | null;
  variant?: "dots" | "bar";
}

export function LoadingScreen({ isLoading, minDuration = 1000, message, variant = "dots" }: LoadingScreenProps) {
  const { t } = useTranslation();
  const [show, setShow] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setShow(true);
    } else {
      const timer = setTimeout(() => {
        setShow(false);
      }, minDuration);
      return () => clearTimeout(timer);
    }
  }, [isLoading, minDuration]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[500]">
      <div className="mb-8 animate-pulse">
        <img 
          src="https://mocha-cdn.com/019acbcb-92a6-7eb2-9ee6-8b655e0ba462/Sem-nome-(200-x-80-px).png" 
          alt="Toodrop"
          className="h-14 w-auto max-w-[80vw] object-contain"
        />
      </div>
      
      <div className="flex flex-col items-center gap-4">
        {variant === "bar" ? (
          <>
            <p className="text-neutral-600 font-medium text-lg mb-2">{message || t("loading.default")}</p>
            <div className="w-64 h-2 bg-neutral-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary-600 to-action-600 rounded-full animate-loading-bar"></div>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="w-3 h-3 bg-action-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-3 h-3 bg-action-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-3 h-3 bg-action-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            
            <p className="text-neutral-600 font-medium text-lg">{message || t("loading.default")}</p>
          </>
        )}
      </div>
    </div>
  );
}
