import { toast as sonnerToast } from "sonner";
import type { ReactNode } from "react";

/**
 * Central toast notification system
 * Provides consistent styling and behavior across the app
 */

export const toast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, {
      description,
      duration: 3000,
    });
  },

  error: (message: string, description?: string) => {
    sonnerToast.error(message, {
      description,
      duration: 5000,
    });
  },

  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, {
      description,
      duration: 4000,
    });
  },

  info: (message: string, description?: string) => {
    sonnerToast.info(message, {
      description,
      duration: 3000,
    });
  },

  loading: (message: string, description?: string) => {
    return sonnerToast.loading(message, {
      description,
    });
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return sonnerToast.promise(promise, messages);
  },

  custom: (content: ReactNode, options?: { duration?: number; position?: string }) => {
    const toastId = sonnerToast.custom(
      () => content as any,
      {
        duration: options?.duration ?? 0,
      }
    );
    return {
      dismiss: () => sonnerToast.dismiss(toastId),
    };
  },

  dismiss: (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  },
};
