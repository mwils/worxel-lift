import { z } from "zod";
import {
  AI_TONES,
  INSPECTION_SEVERITIES,
  LINE_ITEM_KINDS,
  MANUAL_PAYMENT_METHODS,
  MAX_TAX_RATE_BPS,
  MESSAGE_CLASSIFICATIONS,
  PAYMENT_STATUSES,
  RO_STATUSES,
  SERVICE_CATEGORIES,
  SHOP_SLUG_REGEX,
  TAX_APPLIES_TO,
  USER_ROLES,
  US_STATE_CODES,
  isValidTimezone,
  slugifyShopName,
} from "../constants.js";

// ── shared primitives ───────────────────────────────────────────
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "invalid id");
// US-only phone input. Accepts any common format and normalizes to E.164.
// Inputs that all produce "+15554443333":
//   "+15554443333" / "15554443333" / "5554443333"
//   "(555) 444-3333" / "555-444-3333" / "555.444.3333"
// Anything else (wrong digit count, non-US international) is rejected with a
// Mike-language message — no "E.164" jargon.
export const e164 = z
  .string()
  .trim()
  .transform((s, ctx) => {
    let digits = s.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
    if (digits.length !== 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a 10-digit US phone number",
      });
      return z.NEVER;
    }
    return `+1${digits}`;
  });
export const money = z.number().int().nonnegative(); // cents
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
// Two-letter US state code. Uppercased, then checked against the code list —
// "sc" → "SC"; "south carolina" is rejected with a plain message.
export const usState = z.preprocess(
  blankToUndefined,
  z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.enum(US_STATE_CODES, { errorMap: () => ({ message: "Pick a two-letter state" }) }))
    .optional()
);
// An IANA zone the runtime knows ("America/New_York").
export const ianaTimezone = z.string().trim().refine(isValidTimezone, "Unknown timezone");

// Free-text name/label fields: trim and collapse runs of whitespace so
// "  Mike   Jones " never lands in the DB (and never breaks name search).
const collapseWs = (s: string) => s.trim().replace(/\s+/g, " ");
export const cleanText = z.string().transform(collapseWs);
/** Required single-line text (non-empty after cleanup). */
export const requiredText = cleanText.pipe(z.string().min(1, "Required"));
/** Optional single-line text — blank after cleanup is treated as "not provided". */
export const optionalText = cleanText.transform((s) => (s.length ? s : undefined)).optional();
/** 17-char VIN, stored uppercase (I/O/Q aren't valid VIN characters but we
 *  don't enforce that — NHTSA handles bad VINs with an error). */
export const vin17 = z
  .string()
  .trim()
  .toUpperCase()
  .length(17, "VIN must be 17 characters");
/** Plate as stored for search: uppercase, letters and digits only. */
export function normalizePlate(s: string | null | undefined): string {
  return (s ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
}

// ── auth ────────────────────────────────────────────────────────
export const RequestMagicLinkDto = z.object({ email: z.string().email() });
export const RequestSmsCodeDto = z.object({ phone: e164 });
export const VerifyAuthDto = z.object({
  token: z.string().optional(),
  email: z.string().email().optional(),
  phone: e164.optional(),
  code: z.string().length(6).optional(),
});

// ── team ────────────────────────────────────────────────────────
export const InviteMemberDto = z.object({
  email: z.string().email(),
  phone: e164.optional(),
});

// ── onboarding ──────────────────────────────────────────────────
export const ShopNameDto = cleanText.pipe(z.string().min(2, "Shop name needs at least 2 characters"));
export const ShopAddressDto = z
  .object({
    line1: optionalText,
    line2: optionalText,
    city: optionalText,
    state: usState,
    zip: optionalText,
  })
  .optional();

export const OnboardShopDto = z.object({
  name: ShopNameDto,
  address: ShopAddressDto,
  // The browser's zone (Intl.DateTimeFormat().resolvedOptions().timeZone). The
  // server derives the shop zone from `address.state` and uses this only as a
  // tiebreaker for split states or a fallback when no state was given — see
  // resolveShopTimezone. Not validated here: a bad hint is ignored, not fatal.
  timezone: z.string().optional(),
  // Cents per hour. Seeds settings.defaultLaborRate so the first line item and
  // the starter templates agree.
  defaultLaborRate: money.optional(),
  // Cold-email tracking id forwarded from lift.worxel.com via the marketing CTA.
  // Optional — only present when the user came in through a cold-outreach email.
  pid: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
});

// ── shop ────────────────────────────────────────────────────────
export const BookingHoursDto = z.object({
  day: z.number().int().min(0).max(6),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
  closed: z.boolean().default(false),
});

export const BookingSettingsDto = z.object({
  enabled: z.boolean().optional(),
  slotMinutes: z.number().int().min(15).max(240).optional(),
  maxPerSlot: z.number().int().min(1).max(10).optional(),
  leadTimeHours: z.number().int().min(0).max(168).optional(),
  horizonDays: z.number().int().min(1).max(60).optional(),
  hours: z.array(BookingHoursDto).max(7).optional(),
  confirmationMessage: z.string().max(320).optional(),
});

// Normalizes first ("Agent Test Garage" → "agent-test-garage"), then validates
// what's left so a genuinely unusable result still gets the plain message.
export const ShopSlugDto = z
  .string()
  .transform(slugifyShopName)
  .pipe(
    z
      .string()
      .min(2)
      .max(42)
      .regex(SHOP_SLUG_REGEX, "slug must be lowercase letters, digits, or hyphens")
  );

export const UpdateShopDto = z.object({
  name: ShopNameDto.optional(),
  slug: ShopSlugDto.optional(),
  address: ShopAddressDto,
  // Front-desk number shown to customers. null clears it.
  phone: e164.nullable().optional(),
  timezone: ianaTimezone.optional(),
  // Only read when `timezone` actually changes and the shop has upcoming
  // scheduled ROs. keep_clock (default) re-anchors each visit so 9:00 AM stays
  // 9:00 AM in the new zone; keep_instant leaves the stored instants alone and
  // the labels move instead (QA round-2 M1).
  appointmentMode: z.enum(["keep_clock", "keep_instant"]).optional(),
  settings: z
    .object({
      aiTone: z.enum(AI_TONES).optional(),
      autoReplyEnabled: z.boolean().optional(),
      defaultLaborRate: money.optional(),
      serviceRemindersEnabled: z.boolean().optional(),
      // Basis points (825 = 8.25%) + what it applies to. See Shop model comment.
      taxRateBps: z.number().int().min(0).max(MAX_TAX_RATE_BPS).optional(),
      taxAppliesTo: z.enum(TAX_APPLIES_TO).optional(),
      booking: BookingSettingsDto.optional(),
    })
    .optional(),
});

// POST /shop/appointment-notices — after a keep_instant timezone change, text
// the affected customers their corrected visit time. `previousTimezone` lets
// the copy say "(not 9:00 AM)" so the customer knows which text to trust.
export const AppointmentNoticesDto = z.object({
  roIds: z.array(objectId).min(1).max(200),
  previousTimezone: ianaTimezone,
});

export type BookingHoursInput = z.infer<typeof BookingHoursDto>;
export type BookingSettingsInput = z.infer<typeof BookingSettingsDto>;

// ── customers ───────────────────────────────────────────────────
export const CreateCustomerDto = z.object({
  firstName: requiredText,
  lastName: optionalText,
  phone: e164,
  email: z.string().email().optional(),
  notes: z.string().trim().optional(),
  taxExempt: z.boolean().optional(),
});
// PATCH semantics: undefined leaves a field alone, null clears it.
export const UpdateCustomerDto = CreateCustomerDto.partial().extend({
  // Blank after cleanup clears the field, same as an explicit null.
  lastName: cleanText.transform((s) => (s.length ? s : null)).nullable().optional(),
  email: z.string().email().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── vehicles ────────────────────────────────────────────────────
export const CreateVehicleDto = z.object({
  customerId: objectId,
  vin: vin17.optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  make: optionalText,
  model: optionalText,
  trim: optionalText,
  engine: optionalText,
  mileage: z.number().int().nonnegative().optional(),
  plate: optionalText,
  color: optionalText,
  notes: z.string().trim().optional(),
});
export const UpdateVehicleDto = CreateVehicleDto.partial();
export const DecodeVinDto = z.object({ vin: vin17 });

// ── repair orders ───────────────────────────────────────────────
// Quantities must be > 0 when supplied — a 0h labor line or 0-qty part is a
// $0.00 row that only ever comes from a typo. Prices (`money`) may be $0.
export const LineItemDto = z.object({
  kind: z.enum(LINE_ITEM_KINDS),
  description: z.string().min(1),
  hours: z.number().positive().optional(),
  rate: money.optional(),
  qty: z.number().positive().optional(),
  unitPrice: money.optional(),
  total: money,
});
export const UpdateLineItemDto = LineItemDto.partial();

// Odometer reading. Seven digits covers anything short of a moon shot.
export const odometer = z.number().int().nonnegative().max(9_999_999);

export const CreateRepairOrderDto = z.object({
  customerId: objectId,
  vehicleId: objectId,
  concern: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  mileageIn: odometer.optional(),
});

export const UpdateRepairOrderDto = z.object({
  status: z.enum(RO_STATUSES).optional(),
  concern: z.string().optional(),
  diagnosis: z.string().optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
  // null clears a mistyped reading.
  mileageIn: odometer.nullable().optional(),
  mileageOut: odometer.nullable().optional(),
});

// Owner records a non-Stripe payment. Each call appends a Payment row; the
// RO's paid / partial state is derived from the rows, so a short amount leaves
// the RO PARTIAL with the difference still due. `writeOffRemainder` adds a
// negative "Discount" fee line for exactly that difference so total and
// collected agree — never inferred from a short amount alone.
export const MarkPaidDto = z.object({
  method: z.enum(MANUAL_PAYMENT_METHODS),
  amountCents: money.optional(), // defaults to the open balance server-side
  note: z.string().max(200).optional(),
  paidAt: z.string().datetime().optional(), // defaults to now
  writeOffRemainder: z.boolean().default(false),
});
export type MarkPaidInput = z.infer<typeof MarkPaidDto>;

// Undo a mis-entered manual payment (`kind: "void"`, never counted again) or
// record that money went back to the customer (`kind: "refund"`). Neither
// touches Stripe — a Stripe refund is issued from the Stripe dashboard and
// recorded here for the books.
export const VoidPaymentDto = z.object({
  kind: z.enum(["void", "refund"]).default("void"),
  note: z.string().max(200).optional(),
});
export type VoidPaymentInput = z.infer<typeof VoidPaymentDto>;

export const PresignPhotoDto = z.object({
  contentType: z.string().regex(/^image\//),
});

export const ConfirmPhotoDto = z.object({
  s3Key: z.string().min(1),
  caption: z.string().max(500).optional(),
  // Optional: auto-attach the photo to a DVI inspection item on this RO.
  inspectionItemId: objectId.optional(),
});

export const SendEstimateDto = z.object({
  draftOverride: z.string().optional(), // owner-edited SMS body
  // When true and no override is provided, the server drafts via Bedrock
  // instead of the deterministic template. Default behavior is template.
  useAi: z.boolean().optional(),
  // When true and the RO has inspection items, the SMS links to the inspection
  // public URL (which embeds the estimate) instead of the bare estimate URL.
  combineWithInspection: z.boolean().optional(),
});

export const ConfirmPhotoQueryDto = z.object({
  inspectionItemId: objectId.optional(),
});

// ── inspection (DVI) ────────────────────────────────────────────
export const InspectionItemDto = z.object({
  title: z.string().min(1).max(120),
  severity: z.enum(INSPECTION_SEVERITIES),
  note: z.string().max(500).optional(),
  photoIds: z.array(objectId).default([]),
  order: z.number().int().nonnegative().optional(),
});

export const UpdateInspectionItemDto = InspectionItemDto.partial();

export const SendInspectionDto = z.object({
  includeEstimate: z.boolean().default(true),
  draftOverride: z.string().optional(),
});

export type InspectionItemInput = z.infer<typeof InspectionItemDto>;
export type UpdateInspectionItemInput = z.infer<typeof UpdateInspectionItemDto>;
export type SendInspectionInput = z.infer<typeof SendInspectionDto>;

// ── job templates ───────────────────────────────────────────────
export const JobTemplateLineItemDto = z.object({
  kind: z.enum(LINE_ITEM_KINDS),
  description: z.string().min(1),
  hours: z.number().nonnegative().optional(),
  rate: money.optional(),
  qty: z.number().nonnegative().optional(),
  unitPrice: money.optional(),
});

export const CreateJobTemplateDto = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  reminderCategory: z.enum(SERVICE_CATEGORIES).optional(),
  notes: z.string().optional(),
  lineItems: z.array(JobTemplateLineItemDto).default([]),
});

export const UpdateJobTemplateDto = z.object({
  name: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  reminderCategory: z.enum(SERVICE_CATEGORIES).nullable().optional(),
  notes: z.string().nullable().optional(),
  lineItems: z.array(JobTemplateLineItemDto).optional(),
});

export const ApplyJobTemplateDto = z.object({
  repairOrderId: objectId,
  overrides: z
    .record(z.string().regex(/^\d+$/), JobTemplateLineItemDto.partial())
    .optional(),
});

export const ImportStarterTemplatesDto = z.object({
  starterKeys: z.array(z.string().min(1)).min(1),
});

export type JobTemplateLineItemInput = z.infer<typeof JobTemplateLineItemDto>;
export type CreateJobTemplateInput = z.infer<typeof CreateJobTemplateDto>;
export type UpdateJobTemplateInput = z.infer<typeof UpdateJobTemplateDto>;
export type ApplyJobTemplateInput = z.infer<typeof ApplyJobTemplateDto>;
export type ImportStarterTemplatesInput = z.infer<typeof ImportStarterTemplatesDto>;

// ── service reminders ───────────────────────────────────────────
export const UpdateServiceReminderDto = z.object({
  // Owner-driven transitions only:
  //   - dismissed: Mike says "don't bug this customer about this service"
  //   - pending: Mike un-dismisses (snooze flow flips back to pending + new dueAt)
  status: z.enum(["dismissed", "pending"]).optional(),
  dueAt: z.string().datetime().optional(),
});

export const DisableServiceForVehicleDto = z.object({
  vehicleId: objectId,
  // When omitted, every pending reminder for that vehicle is dismissed.
  category: z.enum(SERVICE_CATEGORIES).optional(),
});

export type UpdateServiceReminderInput = z.infer<typeof UpdateServiceReminderDto>;
export type DisableServiceForVehicleInput = z.infer<typeof DisableServiceForVehicleDto>;

// ── messages ────────────────────────────────────────────────────
export const DraftMessageDto = z.object({
  customerId: objectId,
  repairOrderId: objectId.optional(),
  kind: z.enum(["estimate", "status_update", "ready_for_pickup", "freeform", "pay_link"]),
  context: z.string().optional(),
  // Default false — caller gets a deterministic template. Set true to
  // invoke Bedrock for the AI-polished version. The freeform kind requires
  // useAi=true (no template makes sense for free-form text).
  useAi: z.boolean().optional(),
});

export const SendMessageDto = z.object({
  customerId: objectId,
  repairOrderId: objectId.optional(),
  body: z.string().min(1).max(1600),
  aiDrafted: z.boolean().default(false),
  mediaKeys: z.array(z.string()).optional(),
});

// ── voice (shop-scoped, not RO-scoped) ──────────────────────────
export const VoicePresignDto = z.object({
  contentType: z.string().regex(/^audio\//, "contentType must be an audio/* MIME type"),
});

export const VoiceTranscribeDto = z.object({
  s3Key: z.string().min(1),
  kind: z.enum(["customer", "vehicle", "concern"]),
  // Optional: scopes vehicle-match search to this customer when kind === "vehicle".
  customerId: objectId.optional(),
  // Optional explicit transcript — bypasses AWS Transcribe when supplied.
  // Used by tests and as a degraded-mode escape hatch.
  transcript: z.string().min(1).optional(),
});

export type VoiceTranscribeInput = z.infer<typeof VoiceTranscribeDto>;

// ── payments ────────────────────────────────────────────────────
export const CreatePayLinkDto = z.object({
  repairOrderId: objectId,
  // When set, the server sends the SMS using this owner-edited body and
  // records a Message. When omitted, the server returns the pay URL without
  // sending anything (legacy "just give me the link" behavior).
  draftOverride: z.string().optional(),
  // Marks provenance on the Message record when the owner sent an
  // AI-polished version. Has no effect when draftOverride is omitted.
  useAi: z.boolean().optional(),
});
export const SaveCardDto = z.object({ customerId: objectId });

// ── public (token-scoped) ───────────────────────────────────────
export const ApproveEstimateDto = z.object({ token: z.string().min(8) });
// Body of POST /public/estimate/{token}/decline — the token is a path param.
// Body is optional on the wire; the customer's reason is optional too.
export const DeclineEstimateDto = z.object({
  reason: z.string().trim().max(200).optional(),
});

// ── public booking ──────────────────────────────────────────────
export const CreateBookingDto = z.object({
  start: z.string().datetime(),
  customer: z.object({
    firstName: cleanText.pipe(z.string().min(1).max(80)),
    lastName: cleanText.pipe(z.string().max(80)).optional(),
    phone: e164,
    email: z.string().email().optional(),
  }),
  vehicle: z.object({
    year: z.number().int().min(1900).max(2100),
    make: cleanText.pipe(z.string().min(1).max(40)),
    model: cleanText.pipe(z.string().min(1).max(40)),
  }),
  concern: z.string().min(3).max(500),
});

export const RescheduleBookingDto = z.object({
  start: z.string().datetime(),
});

export const BookSlotsQueryDto = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
  /** Manage token of a booking being rescheduled — its RO is left out of slot capacity. */
  exclude: z.string().min(1).max(128).optional(),
});

export type CreateBookingInput = z.infer<typeof CreateBookingDto>;
export type RescheduleBookingInput = z.infer<typeof RescheduleBookingDto>;
export type BookSlotsQueryInput = z.infer<typeof BookSlotsQueryDto>;

// ── marketing blog (company-admin only) ─────────────────────────
export const BLOG_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

export const BlogPostPatchDto = z
  .object({
    title: z.string().min(3).max(160).optional(),
    metaDescription: z.string().min(10).max(155).optional(),
    slug: z.string().regex(BLOG_SLUG_REGEX, "lowercase letters, numbers, hyphens").optional(),
    bodyMarkdown: z.string().min(50).max(50_000).optional(),
    scheduledFor: z.string().datetime().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export const BlogPostRejectDto = z.object({
  reason: z.string().max(500).optional(),
});

export const BlogAdminListQueryDto = z.object({
  status: z.enum(["queue", "published", "rejected"]).default("queue"),
});

export type BlogPostPatchInput = z.infer<typeof BlogPostPatchDto>;
export type BlogPostRejectInput = z.infer<typeof BlogPostRejectDto>;
export type BlogAdminListQueryInput = z.infer<typeof BlogAdminListQueryDto>;

// ── re-exports for type inference at call sites ─────────────────
export type CreateRepairOrderInput = z.infer<typeof CreateRepairOrderDto>;
export type UpdateRepairOrderInput = z.infer<typeof UpdateRepairOrderDto>;
export type CreateCustomerInput = z.infer<typeof CreateCustomerDto>;
export type LineItemInput = z.infer<typeof LineItemDto>;
export type DraftMessageInput = z.infer<typeof DraftMessageDto>;

export const RoStatusEnum = z.enum(RO_STATUSES);
export const PaymentStatusEnum = z.enum(PAYMENT_STATUSES);
export const MessageClassificationEnum = z.enum(MESSAGE_CLASSIFICATIONS);
export const UserRoleEnum = z.enum(USER_ROLES);
