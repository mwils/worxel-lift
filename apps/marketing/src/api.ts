const API_URL = import.meta.env.VITE_API_URL ?? "https://api-lift.worxel.com";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message =
      (body && typeof body === "object" && "error" in body && (body as any).error?.message) ||
      `Request failed: ${res.status}`;
    throw new ApiError(message, res.status, body);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
};

export type BookingShop = {
  shop: {
    name: string;
    slug: string;
    address: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      zip?: string;
    } | null;
    timezone: string;
  };
  enabled: boolean;
  booking: {
    slotMinutes: number;
    leadTimeHours: number;
    horizonDays: number;
    confirmationMessage: string | null;
  };
};

export type Slot = { start: string; available: boolean };
export type SlotDay = { date: string; slots: Slot[] };
export type SlotResponse = {
  timezone: string;
  slotMinutes: number;
  days: SlotDay[];
};

export type CreateBookingResponse = {
  confirmationCode: string;
  scheduledFor: string;
  ro: { number: number };
  manageToken: string;
};

export type ManageBooking = {
  shop: { name: string; slug: string | null; timezone: string | null } | null;
  customer: { firstName: string; lastName: string | null } | null;
  vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
  } | null;
  booking: {
    scheduledFor: string | null;
    status: string;
    concern: string | null;
    cancellable: boolean;
    rescheduleable: boolean;
    /** Shop's booking window in days (inclusive of today); null on older API responses. */
    horizonDays: number | null;
  };
};
