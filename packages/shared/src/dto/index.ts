import { z } from "zod";
import {
  AI_TONES,
  INSPECTION_SEVERITIES,
  LINE_ITEM_KINDS,
  MESSAGE_CLASSIFICATIONS,
  PAYMENT_STATUSES,
  RO_STATUSES,
  SERVICE_CATEGORIES,
  SHOP_SLUG_REGEX,
  USER_ROLES,
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

// ── auth ────────────────────────────────────────────────────────
export const RequestMagicLinkDto = z.object({ email: z.string().email() });
export const RequestSmsCodeDto = z.object({ phone: e164 });
export const VerifyAuthDto = z.object({
  token: z.string().optional(),
  email: z.string().email().optional(),
  phone: e164.optional(),
  code: z.string().length(6).optional(),
});

// ── onboarding ──────────────────────────────────────────────────
export const OnboardShopDto = z.object({
  name: z.string().min(2),
  address: z
    .object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().length(2).optional(),
      zip: z.string().optional(),
    })
    .optional(),
  timezone: z.string().default("America/Chicago"),
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

export const ShopSlugDto = z
  .string()
  .min(2)
  .max(42)
  .regex(SHOP_SLUG_REGEX, "slug must be lowercase letters, digits, or hyphens");

export const UpdateShopDto = z.object({
  name: z.string().min(2).optional(),
  slug: ShopSlugDto.optional(),
  address: OnboardShopDto.shape.address,
  timezone: z.string().optional(),
  settings: z
    .object({
      aiTone: z.enum(AI_TONES).optional(),
      autoReplyEnabled: z.boolean().optional(),
      defaultLaborRate: money.optional(),
      serviceRemindersEnabled: z.boolean().optional(),
      booking: BookingSettingsDto.optional(),
    })
    .optional(),
});

export type BookingHoursInput = z.infer<typeof BookingHoursDto>;
export type BookingSettingsInput = z.infer<typeof BookingSettingsDto>;

// ── customers ───────────────────────────────────────────────────
export const CreateCustomerDto = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phone: e164,
  email: z.string().email().optional(),
  notes: z.string().optional(),
});
// PATCH semantics: undefined leaves a field alone, null clears it.
export const UpdateCustomerDto = CreateCustomerDto.partial().extend({
  lastName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ── vehicles ────────────────────────────────────────────────────
export const CreateVehicleDto = z.object({
  customerId: objectId,
  vin: z.string().length(17).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  trim: z.string().optional(),
  engine: z.string().optional(),
  mileage: z.number().int().nonnegative().optional(),
  plate: z.string().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});
export const UpdateVehicleDto = CreateVehicleDto.partial();
export const DecodeVinDto = z.object({ vin: z.string().length(17) });

// ── repair orders ───────────────────────────────────────────────
export const LineItemDto = z.object({
  kind: z.enum(LINE_ITEM_KINDS),
  description: z.string().min(1),
  hours: z.number().nonnegative().optional(),
  rate: money.optional(),
  qty: z.number().nonnegative().optional(),
  unitPrice: money.optional(),
  total: money,
});
export const UpdateLineItemDto = LineItemDto.partial();

export const CreateRepairOrderDto = z.object({
  customerId: objectId,
  vehicleId: objectId,
  concern: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
});

export const UpdateRepairOrderDto = z.object({
  status: z.enum(RO_STATUSES).optional(),
  concern: z.string().optional(),
  diagnosis: z.string().optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
});

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
  notes: z.string().optional(),
  lineItems: z.array(JobTemplateLineItemDto).default([]),
});

export const UpdateJobTemplateDto = z.object({
  name: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
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
export const DeclineEstimateDto = z.object({
  token: z.string().min(8),
  reason: z.string().optional(),
});

// ── public booking ──────────────────────────────────────────────
export const CreateBookingDto = z.object({
  start: z.string().datetime(),
  customer: z.object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().max(80).optional(),
    phone: e164,
    email: z.string().email().optional(),
  }),
  vehicle: z.object({
    year: z.number().int().min(1900).max(2100),
    make: z.string().min(1).max(40),
    model: z.string().min(1).max(40),
  }),
  concern: z.string().min(3).max(500),
});

export const RescheduleBookingDto = z.object({
  start: z.string().datetime(),
});

export const BookSlotsQueryDto = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
});

export type CreateBookingInput = z.infer<typeof CreateBookingDto>;
export type RescheduleBookingInput = z.infer<typeof RescheduleBookingDto>;
export type BookSlotsQueryInput = z.infer<typeof BookSlotsQueryDto>;

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
