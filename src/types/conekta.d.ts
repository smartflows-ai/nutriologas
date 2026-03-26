// src/types/conekta.d.ts
// TypeScript global declarations for the Conekta.js browser SDK
// (loaded via <script src="https://pay.conekta.com/v1.0/js/ck-checkout-v3.min.js">)

declare global {
  interface Window {
    ConektaCheckoutComponents: {
      Integration: (config: ConektaIntegrationConfig) => void;
    };
  }
}

export interface ConektaIntegrationConfig {
  config: {
    locale: "es" | "en";
    publicKey: string;
    targetIFrame: string; // CSS selector, e.g. '#conekta-checkout'
    checkoutRequestId: string;
  };
  callbacks: ConektaCallbacks;
  options?: ConektaOptions;
}

export interface ConektaCallbacks {
  onGetInfoSuccess?: (loadingTime: unknown) => void;
  onFinalizePayment: (order: ConektaOrderResult) => void | Promise<void>;
  onErrorPayment?: (error: unknown) => void;
  onExit?: () => void;
}

export interface ConektaOptions {
  backgroundMode?: "lightMode" | "darkMode";
  colorPrimary?: string;
  colorText?: string;
  colorLabel?: string;
  inputType?: "flatMode" | "roundedMode";
}

export interface ConektaOrderResult {
  id: string;
  status: string;
  amount: number;
  currency: string;
  charges?: {
    data: Array<{
      id: string;
      status: string;
      payment_method?: {
        type: string;
        last4?: string;
        brand?: string;
        barcode?: string;
      };
    }>;
  };
}
