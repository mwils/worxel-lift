import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TaxAppliesTo } from "@lift/shared/constants";
import { api, ApiError } from "./api";
import { clearSessionHint, hasSessionHint, markSessionHint } from "./session";

export interface Me {
  user: {
    id: string;
    email: string;
    role: "owner" | "tech";
    shopId: string | null;
    emailVerified: boolean;
    /** Lift-the-company back office (blog admin) — email allowlist, not a tenant role. */
    isCompanyAdmin?: boolean;
  };
  shop: {
    id: string;
    name: string;
    slug?: string | null;
    address?: ShopAddress | null;
    /** Front-desk number (E.164), distinct from the Lift texting number in `sms`. */
    phone?: string | null;
    timezone?: string | null;
    settings: {
      aiTone: "plain" | "friendly";
      autoReplyEnabled: boolean;
      defaultLaborRate?: number | null;
      serviceRemindersEnabled?: boolean;
      /** Sales tax in basis points (825 = 8.25%); the API always resolves the legacy shape to this. */
      taxRateBps?: number | null;
      taxAppliesTo?: TaxAppliesTo | null;
      booking?: BookingSettings;
      businessHours?: BookingHour[];
    };
    billing: { plan: string; trialEndsAt?: string };
    sms: { phoneNumber?: string };
    payments: { hasAccount: boolean; chargesEnabled: boolean; detailsSubmitted: boolean };
  } | null;
}

export interface ShopAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface BookingHour {
  day: number;
  open?: string;
  close?: string;
  closed?: boolean;
}

export interface BookingSettings {
  enabled?: boolean;
  slotMinutes?: number;
  maxPerSlot?: number;
  leadTimeHours?: number;
  horizonDays?: number;
  hours?: BookingHour[];
  confirmationMessage?: string;
}

const Ctx = createContext<{ me: Me | null; loading: boolean }>({ me: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const me = await api.get<Me>("/auth/me");
        markSessionHint();
        return me;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearSessionHint();
          return null;
        }
        throw err;
      }
    },
  });

  // Only block the first paint on /auth/me when this browser has signed in
  // before. A cold visitor with no session hint gets the login form at once
  // instead of a bare spinner for the whole round-trip; if a cookie turns out
  // to be valid anyway, /login redirects to the board as soon as `me` lands.
  const loading = isPending && hasSessionHint();

  return <Ctx.Provider value={{ me: data ?? null, loading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
