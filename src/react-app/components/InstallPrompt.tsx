import { Download, Share, SquarePlus, X } from "lucide-react";
import { useTranslation } from "@/react-app/i18n";
import { useInstallPrompt } from "@/react-app/hooks/useInstallPrompt";

export function InstallPrompt() {
  const { t } = useTranslation();
  const { visible, platform, install, dismiss } = useInstallPrompt();

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[220] px-4 pb-4 sm:pb-6 sm:px-6 flex justify-center pointer-events-none">
      <div className="fade-in pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-strong border border-neutral-100 p-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src="/favicon-192x192.png" alt="Toodrop" className="w-full h-full object-cover" />
          </div>

          <div className="flex-1 min-w-0">
            {platform === "ios" ? (
              <>
                <p className="font-semibold text-neutral-800 text-sm">{t("installPrompt.iosTitle")}</p>
                <div className="mt-2 space-y-1.5 text-sm text-neutral-600">
                  <div className="flex items-center gap-2">
                    <Share className="w-4 h-4 text-primary-600 flex-shrink-0" strokeWidth={2} />
                    <span>{t("installPrompt.iosStep1")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <SquarePlus className="w-4 h-4 text-primary-600 flex-shrink-0" strokeWidth={2} />
                    <span>{t("installPrompt.iosStep2")}</span>
                  </div>
                </div>
                <button
                  onClick={dismiss}
                  className="mt-3 w-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
                >
                  {t("installPrompt.iosDismiss")}
                </button>
              </>
            ) : (
              <>
                <p className="font-semibold text-neutral-800 text-sm">{t("installPrompt.title")}</p>
                <p className="text-sm text-neutral-500 mt-0.5">{t("installPrompt.description")}</p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={install}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
                  >
                    <Download className="w-4 h-4" strokeWidth={2} />
                    {t("installPrompt.installButton")}
                  </button>
                  <button
                    onClick={dismiss}
                    className="px-3 py-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                  >
                    {t("installPrompt.laterButton")}
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            onClick={dismiss}
            aria-label={t("common.close")}
            className="text-neutral-400 hover:text-neutral-600 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
