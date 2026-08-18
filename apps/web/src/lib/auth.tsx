import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "./api";

export interface Me {
  user: {
    id: string;
    email: string;
    role: "owner" | "tech";
    shopId: string | null;
    emailVerified: boolean;
  };
  shop: {
    id: string;
    name: string;
    slug?: string | null;
    settings: {
      aiTone: "plain" | "friendly";
      autoReplyEnabled: boolean;
      defaultLaborRate?: number | null;
      serviceRemindersEnabled?: boolean;
      booking?: BookingSettings;
      businessHours?: BookingHour[];
    };
    billing: { plan: string; trialEndsAt?: string };
    sms: { phoneNumber?: string };
  } | null;
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
        return await api.get<Me>("/auth/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
  });

  return <Ctx.Provider value={{ me: data ?? null, loading: isPending }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
