import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import {
  CreateBookingDto,
  Customer,
  Message,
  RepairOrder,
  Shop,
  User,
  Vehicle,
} from "@lift/shared";
import { handleKnownErrors, parseBody, withErrorBoundary } from "../../lib/middleware.js";
import { badRequest, conflict, created, notFound } from "../../lib/response.js";
import { sendSms } from "../../lib/sms.js";
import { validateSlot } from "./_slots.js";

function shortCode() {
  // 6-char human-friendly confirmation code. Uppercased base32-ish set.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[(bytes[i] ?? 0) % alphabet.length];
  return out;
}

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  try {
    const slug = event.pathParameters?.slug;
    if (!slug) return notFound();

    const dto = await parseBody(event, CreateBookingDto);

    const shop = await Shop.findOne({ slug }).lean();
    if (!shop) return notFound();
    if (!shop.settings?.booking?.enabled) {
      return badRequest("Online booking is disabled for this shop");
    }

    const validation = await validateSlot(shop, dto.start, new Date());
    if (!validation.ok) {
      if (validation.reason === "full") {
        return conflict("That time was just taken. Please pick another slot.");
      }
      if (validation.reason === "too_soon") {
        return badRequest("Please pick a time further out.");
      }
      return badRequest("That time isn't available.", { reason: validation.reason });
    }

    // Find-or-create customer by (shopId, phone). Matches the customers/create
    // idempotency pattern — public bookers shouldn't fail just because they
    // booked twice from the same phone.
    let customer = await Customer.findOne({ shopId: shop._id, phone: dto.customer.phone });
    if (!customer) {
      customer = await Customer.create({
        shopId: shop._id,
        firstName: dto.customer.firstName,
        lastName: dto.customer.lastName,
        phone: dto.customer.phone,
        email: dto.customer.email,
        // The customer just submitted a form that includes the shop's opt-in
        // language; record consent at the booking timestamp.
        smsOptInAt: new Date(),
      });
    }

    // Soft match for vehicle on (year, make, model). Existing model allows
    // duplicates; the public booking flow won't reach a VIN/plate, so an exact
    // year+make+model match is the best we can do without dragging in fuzzy
    // search.
    const makeRe = new RegExp(`^${escapeRegex(dto.vehicle.make)}$`, "i");
    const modelRe = new RegExp(`^${escapeRegex(dto.vehicle.model)}$`, "i");
    let vehicle = await Vehicle.findOne({
      shopId: shop._id,
      customerId: customer._id,
      year: dto.vehicle.year,
      make: makeRe,
      model: modelRe,
    });
    if (!vehicle) {
      vehicle = await Vehicle.create({
        shopId: shop._id,
        customerId: customer._id,
        year: dto.vehicle.year,
        make: dto.vehicle.make,
        model: dto.vehicle.model,
      });
    }

    // Per-shop atomic incrementing RO number — same pattern as repairOrders/create.
    const counterShop = await Shop.findOneAndUpdate(
      { _id: shop._id },
      { $inc: { "counters.ro": 1 } },
      { new: true }
    ).lean();
    if (!counterShop) return notFound("Shop not found");
    const number = counterShop.counters?.ro ?? 1;

    const publicToken = randomBytes(24).toString("base64url");
    const bookingToken = randomBytes(24).toString("base64url");
    const confirmationCode = shortCode();

    const ro = await RepairOrder.create({
      shopId: shop._id,
      customerId: customer._id,
      vehicleId: vehicle._id,
      number,
      status: "scheduled",
      source: "booking",
      concern: dto.concern,
      scheduledFor: validation.slotDate,
      lineItems: [],
      laborTotal: 0,
      partsTotal: 0,
      taxTotal: 0,
      total: 0,
      publicToken,
      bookingToken,
    });

    const owner = shop.ownerUserId ? await User.findById(shop.ownerUserId).lean() : null;
    const mockEmailRecipient = customer.email ?? owner?.email ?? undefined;

    const tz = shop.timezone || "America/Chicago";
    const whenHuman = DateTime.fromJSDate(validation.slotDate)
      .setZone(tz)
      .toFormat("ccc LLL d 'at' h:mm a");

    const manageUrl = `${process.env.MARKETING_URL ?? ""}/booking/${bookingToken}`;
    const confirmBody = `Hi ${customer.firstName} — booked for ${whenHuman} at ${shop.name}. Confirmation ${confirmationCode}. Need to change it? ${manageUrl}`;

    if (customer.smsOptOutAt) {
      // Customer has explicitly opted out of SMS. Don't text them; still notify
      // the owner so they know a booking landed.
      console.log("[book] customer opted out — skipping customer SMS", {
        customerId: String(customer._id),
      });
    } else {
      const sendResult = await sendSms({
        to: customer.phone,
        from: shop.sms?.phoneNumber ?? undefined,
        body: confirmBody,
        mockEmailRecipient,
      });
      await Message.create({
        shopId: shop._id,
        customerId: customer._id,
        repairOrderId: ro._id,
        direction: "out",
        body: confirmBody,
        awsMessageId: sendResult.messageId,
        autoReplied: true,
      });
    }

    // Notify Mike on the OWNER's phone — NOT the shop inbound SMS number,
    // which is what customers text. Skip with a warning if owner has no phone.
    if (owner?.phone) {
      const ownerBody = `New booking: ${customer.firstName}${customer.lastName ? " " + customer.lastName : ""} (${customer.phone}) — ${dto.vehicle.year} ${dto.vehicle.make} ${dto.vehicle.model}. ${whenHuman}. "${truncate(dto.concern, 120)}"`;
      const ownerSend = await sendSms({
        to: owner.phone,
        from: shop.sms?.phoneNumber ?? undefined,
        body: ownerBody,
        mockEmailRecipient: owner.email,
      });
      await Message.create({
        shopId: shop._id,
        customerId: customer._id,
        repairOrderId: ro._id,
        direction: "out",
        body: ownerBody,
        awsMessageId: ownerSend.messageId,
        autoReplied: true,
      });
    } else {
      console.warn("[book] owner has no phone — skipping owner notification SMS", {
        shopId: String(shop._id),
      });
    }

    return created({
      confirmationCode,
      scheduledFor: validation.slotDate.toISOString(),
      ro: { number: ro.number },
      manageToken: bookingToken,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
