import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

export default function usePWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [installationCompleted, setInstallationCompleted] = useState(
    window.localStorage?.getItem("wasInstalled") === "true"
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const saveInstallState = () => {
      console.log("PWA was installed 🎉");
      window.localStorage?.setItem("wasInstalled", "true");
      setInstallationCompleted(true);
    };

    if (window?.addEventListener) {
      window?.addEventListener("beforeinstallprompt", handler);
      window?.addEventListener("appinstalled", saveInstallState);
      
      return () => {
        window?.removeEventListener("beforeinstallprompt", handler);
        window?.removeEventListener("appinstalled", saveInstallState);
      };
    }
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsInstallable(false);
    return outcome === "accepted";
  };

  const wasInstalled = () => {
    let standalone = false;
    if (window?.matchMedia) {
      standalone =
        window?.matchMedia("(display-mode: standalone)").matches ||
        (window?.navigator as any).standalone === true;
    }

    const wasInstall = window.localStorage?.getItem("wasInstalled") === "true";
    return standalone || wasInstall;
  };

  const isStandalone = () => {
    let standalone = false;
    if (window?.matchMedia) {
      standalone =
        window?.matchMedia("(display-mode: standalone)").matches ||
        (window?.navigator as any).standalone === true;
    }
    return standalone;
  };

  return { 
    isInstallable, 
    promptInstall, 
    wasInstalled, 
    isStandalone, 
    installationCompleted 
  };
}
