import { z } from "zod";
import {
  AI_TONES,
  LINE_ITEM_KINDS,
  MESSAGE_CLASSIFICATIONS,
  PAYMENT_STATUSES,
  RO_STATUSES,
  USER_ROLES,
} from "../constants.js";

// ── shared primitives ───────────────────────────────────────────
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "invalid id");
export const e164 = z.string().regex(/^\+[1-9]\d{6,14}$/, "must be E.164 (e.g. +15551234567)");
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
});

// ── shop ────────────────────────────────────────────────────────
export const UpdateShopDto = z.object({
  name: z.string().min(2).optional(),
  address: OnboardShopDto.shape.address,
  timezone: z.string().optional(),
  settings: z
    .object({
      aiTone: z.enum(AI_TONES).optional(),
      autoReplyEnabled: z.boolean().optional(),
    })
    .optional(),
});

// ── customers ───────────────────────────────────────────────────
export const CreateCustomerDto = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phone: e164,
  email: z.string().email().optional(),
  notes: z.string().optional(),
});
export const UpdateCustomerDto = CreateCustomerDto.partial();

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
});

export const SendEstimateDto = z.object({
  draftOverride: z.string().optional(), // owner-edited SMS body
  // When true and no override is provided, the server drafts via Bedrock
  // instead of the deterministic template. Default behavior is template.
  useAi: z.boolean().optional(),
});

// ── messages ────────────────────────────────────────────────────
export const DraftMessageDto = z.object({
  customerId: objectId,
  repairOrderId: objectId.optional(),
  kind: z.enum(["estimate", "status_update", "ready_for_pickup", "freeform"]),
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

// ── payments ────────────────────────────────────────────────────
export const CreatePayLinkDto = z.object({ repairOrderId: objectId });
export const SaveCardDto = z.object({ customerId: objectId });

// ── public (token-scoped) ───────────────────────────────────────
export const ApproveEstimateDto = z.object({ token: z.string().min(8) });
export const DeclineEstimateDto = z.object({
  token: z.string().min(8),
  reason: z.string().optional(),
});

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
