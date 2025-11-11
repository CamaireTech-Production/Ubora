import { PaymentRequest, CampayPaymentData } from '../types/payment';

/**
 * Configuration pour ouvrir le modal Campay
 */
export interface CampayConfig {
  /** Montant réel en FCFA (sera ajusté selon l'environnement) */
  amount: number;
  /** Description du paiement */
  description: string;
  /** Référence externe unique */
  externalReference: string;
  /** Devise (par défaut: XAF) */
  currency?: string;
  /** URL de redirection après paiement (optionnel) */
  redirectUrl?: string;
  /** Callback appelé en cas de succès */
  onSuccess: (data: CampayPaymentData) => void;
  /** Callback appelé en cas d'échec */
  onFail: (data: CampayPaymentData) => void;
  /** Callback appelé quand le modal est fermé */
  onModalClose: (data: CampayPaymentData) => void;
}

/**
 * Interface du SDK Campay global
 */
interface CampaySDK {
  options: (config: {
    payButtonId: string;
    description: string;
    amount: string;
    currency: string;
    externalReference: string;
    redirectUrl?: string;
  }) => void;
  onSuccess: (data: CampayPaymentData) => void;
  onFail: (data: CampayPaymentData) => void;
  onModalClose: (data: CampayPaymentData) => void;
  close?: () => void;
}

/**
 * Service unifié pour gérer les paiements Campay
 * 
 * Ce service :
 * - Charge dynamiquement le script Campay avec l'App ID depuis les variables d'environnement
 * - Gère l'initialisation et l'ouverture du modal
 * - Calcule automatiquement le montant selon l'environnement (dev: 10 FCFA, prod: prix réel)
 * - Fournit une API simple pour tous les cas d'usage
 */
export class CampayService {
  private static scriptLoaded = false;
  private static loadingPromise: Promise<void> | null = null;
  private static campaySDK: CampaySDK | null = null;
  private static currentButtonId: string | null = null;
  private static currentConfig: CampayConfig | null = null;

  /**
   * Charge le script Campay dynamiquement
   */
  private static async loadScript(): Promise<void> {
    // Si déjà chargé, retourner immédiatement
    if (this.scriptLoaded && this.campaySDK) {
      return Promise.resolve();
    }

    // Si en cours de chargement, retourner la promesse existante
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    // Créer une nouvelle promesse de chargement
    this.loadingPromise = new Promise((resolve, reject) => {
      // Vérifier si le script est déjà présent dans le DOM
      const existingScript = document.querySelector('script[src*="campay.net/sdk"]');
      if (existingScript) {
        // Script déjà présent, attendre qu'il soit chargé
        this.waitForCampaySDK(resolve, reject);
        return;
      }

      // Récupérer l'App ID depuis les variables d'environnement
      const appId = import.meta.env.VITE_CAMPAY_APP_ID;
      if (!appId) {
        const error = new Error('VITE_CAMPAY_APP_ID n\'est pas défini dans les variables d\'environnement');
        reject(error);
        return;
      }

      // Créer et charger le script
      const script = document.createElement('script');
      script.src = `https://www.campay.net/sdk/js?app-id=${appId}`;
      script.async = true;
      script.onload = () => {
        this.waitForCampaySDK(resolve, reject);
      };
      script.onerror = () => {
        const error = new Error('Erreur lors du chargement du script Campay');
        this.loadingPromise = null;
        reject(error);
      };

      document.head.appendChild(script);
    });

    return this.loadingPromise;
  }

  /**
   * Attend que le SDK Campay soit disponible
   */
  private static waitForCampaySDK(
    resolve: () => void,
    reject: (error: Error) => void,
    retryCount: number = 0,
    maxRetries: number = 100
  ): void {
    // Vérifier plusieurs façons dont campay peut être disponible
    let campayObj: CampaySDK | null = null;

    try {
      // Vérifier dans l'ordre : global scope, window, globalThis
      if (typeof (globalThis as any).campay !== 'undefined' && (globalThis as any).campay) {
        campayObj = (globalThis as any).campay;
      } else if (typeof (window as any).campay !== 'undefined' && (window as any).campay) {
        campayObj = (window as any).campay;
      } else if (typeof (globalThis as any).Campay !== 'undefined' && (globalThis as any).Campay) {
        campayObj = (globalThis as any).Campay;
      }
    } catch (e) {
      // Ignorer les erreurs lors de la vérification
    }

    // Vérifier si campay est disponible et a la méthode options
    if (campayObj && typeof campayObj.options === 'function') {
      this.campaySDK = campayObj;
      this.scriptLoaded = true;
      
      // S'assurer que window.campay et globalThis.campay sont définis pour compatibilité
      if (!(window as any).campay) {
        (window as any).campay = campayObj;
      }
      if (!(globalThis as any).campay) {
        (globalThis as any).campay = campayObj;
      }

      this.loadingPromise = null;
      resolve();
    } else if (retryCount >= maxRetries) {
      const error = new Error('Le SDK Campay n\'a pas pu être chargé après ' + maxRetries + ' tentatives');
      this.loadingPromise = null;
      reject(error);
    } else {
      // Réessayer après un court délai
      setTimeout(() => {
        this.waitForCampaySDK(resolve, reject, retryCount + 1, maxRetries);
      }, 50);
    }
  }

  /**
   * Calcule le montant à charger selon l'environnement
   * - Dev/Demo: utilise VITE_CAMPAY_DEMO_AMOUNT (défaut: 10 FCFA)
   * - Prod/Live: utilise le montant réel
   */
  private static getChargeAmount(realAmount: number): number {
    const environment = import.meta.env.VITE_CAMPAY_ENVIRONMENT || 'demo';
    const demoAmount = parseInt(import.meta.env.VITE_CAMPAY_DEMO_AMOUNT || '10', 10);

    if (environment === 'demo' || environment === 'dev') {
      return demoAmount;
    }

    return realAmount;
  }

  /**
   * Ouvre le modal Campay avec la configuration fournie
   * 
   * @param config Configuration du paiement
   * @returns Promise qui se résout quand le modal est prêt à être ouvert
   */
  static async openPaymentModal(config: CampayConfig): Promise<void> {
    try {
      // Charger le script si nécessaire
      await this.loadScript();

      if (!this.campaySDK) {
        throw new Error('Le SDK Campay n\'est pas disponible');
      }

      // Générer un ID unique pour le bouton
      const buttonId = `campay-pay-button-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      this.currentButtonId = buttonId;
      this.currentConfig = config;

      // Calculer le montant à charger
      const chargeAmount = this.getChargeAmount(config.amount);
      const currency = config.currency || 'XAF';
      const redirectUrl = config.redirectUrl || import.meta.env.VITE_CAMPAY_REDIRECT_URL || '';

      // IMPORTANT: Créer le bouton AVANT d'appeler campay.options()
      // Campay a besoin que le bouton existe dans le DOM avant la configuration
      const button = document.createElement('button');
      button.id = buttonId;
      button.type = 'button';
      // Rendre le bouton invisible mais présent dans le DOM
      button.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: 0; border: 0; overflow: hidden; clip: rect(0, 0, 0, 0); opacity: 0; pointer-events: none; z-index: -1;';
      document.body.appendChild(button);

      // Attendre que le bouton soit dans le DOM avant de configurer Campay
      await new Promise(resolve => setTimeout(resolve, 50));

      // Configurer Campay (le bouton doit déjà exister dans le DOM)
      this.campaySDK.options({
        payButtonId: buttonId,
        description: config.description,
        amount: chargeAmount.toString(),
        currency: currency,
        externalReference: config.externalReference,
        redirectUrl: redirectUrl,
      });

      // Configurer les callbacks
      this.campaySDK.onSuccess = (data: CampayPaymentData) => {
        config.onSuccess(data);
      };

      this.campaySDK.onFail = (data: CampayPaymentData) => {
        config.onFail(data);
      };

      this.campaySDK.onModalClose = (data: CampayPaymentData) => {
        config.onModalClose(data);
        // Réinitialiser les états
        this.currentButtonId = null;
        this.currentConfig = null;
      };

      // Attendre un délai pour que Campay associe le bouton avec l'ID
      // Puis cliquer sur le bouton pour ouvrir le modal
      setTimeout(() => {
        try {
          // Vérifier que le bouton existe toujours
          const btn = document.getElementById(buttonId);
          if (btn) {
            btn.click();
            
            // Détecter l'ouverture du modal en observant les changements dans le DOM
            // Campay ouvre généralement un iframe ou une popup
            const modalObserver = new MutationObserver(() => {
              // Chercher des indices que le modal est ouvert (iframe, overlay, etc.)
              const hasModal = document.querySelector('iframe[src*="campay.net"]') ||
                              document.querySelector('[class*="campay"]') ||
                              document.querySelector('[id*="campay"]') ||
                              document.querySelector('.modal') ||
                              window.frames.length > 0;
              
              if (hasModal) {
                modalObserver.disconnect();
              }
            });
            
            // Observer les changements dans le document
            modalObserver.observe(document.body, {
              childList: true,
              subtree: true
            });
            
            // Nettoyer l'observer après 10 secondes
            setTimeout(() => {
              modalObserver.disconnect();
            }, 10000);
          }
        } catch (error) {
          // Erreur silencieuse lors du clic sur le bouton
        }
        
        // Retirer le bouton après un délai pour permettre à Campay de traiter le clic
        // Ne pas retirer trop tôt car Campay peut en avoir besoin
        setTimeout(() => {
          try {
            const btn = document.getElementById(buttonId);
            if (btn && btn.parentNode) {
              btn.parentNode.removeChild(btn);
            }
          } catch (error) {
            // Ignorer les erreurs de suppression
          }
        }, 2000);
      }, 300);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Ouvre le modal Campay à partir d'un PaymentRequest
   * (Méthode de convenance pour compatibilité avec le code existant)
   */
  static async openPaymentModalFromRequest(
    paymentRequest: PaymentRequest,
    callbacks: {
      onSuccess: (data: CampayPaymentData) => void;
      onFail: (data: CampayPaymentData) => void;
      onModalClose: (data: CampayPaymentData) => void;
    }
  ): Promise<void> {
    return this.openPaymentModal({
      amount: paymentRequest.amount,
      description: paymentRequest.description,
      externalReference: paymentRequest.externalReference,
      currency: paymentRequest.currency,
      ...callbacks,
    });
  }

  /**
   * Ferme le modal Campay si ouvert
   */
  static closeModal(): void {
    if (this.campaySDK && typeof this.campaySDK.close === 'function') {
      try {
        this.campaySDK.close();
      } catch (error) {
        // Erreur silencieuse lors de la fermeture du modal
      }
    }
  }

  /**
   * Vérifie si le SDK Campay est chargé et prêt
   */
  static isReady(): boolean {
    return this.scriptLoaded && this.campaySDK !== null;
  }
}

