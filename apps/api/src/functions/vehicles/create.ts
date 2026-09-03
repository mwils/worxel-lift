import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { CreateVehicleDto, Customer, Vehicle, normalizePlate } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, created, notFound } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, CreateVehicleDto);

    // Customer must exist in this shop — never trust a body-supplied customerId blindly.
    const customer = await Customer.findOne({ _id: dto.customerId, shopId: user.shopId }).lean();
    if (!customer) return notFound("Customer not found");

    // VIN decoding is the frontend's job: it hits POST /vehicles/decode-vin first
    // and pre-fills year/make/model in the form before posting here. We persist
    // exactly what was sent.
    const vehicle = await Vehicle.create({
      shopId: user.shopId,
      customerId: customer._id,
      vin: dto.vin,
      year: dto.year,
      make: dto.make,
      model: dto.model,
      trim: dto.trim,
      engine: dto.engine,
      mileage: dto.mileage,
      plate: dto.plate,
      plateNormalized: dto.plate ? normalizePlate(dto.plate) || undefined : undefined,
      color: dto.color,
      notes: dto.notes,
    });

    return created({
      vehicle: {
        id: String(vehicle._id),
        customerId: String(vehicle.customerId),
        vin: vehicle.vin ?? null,
        year: vehicle.year ?? null,
        make: vehicle.make ?? null,
        model: vehicle.model ?? null,
        trim: vehicle.trim ?? null,
        engine: vehicle.engine ?? null,
        mileage: vehicle.mileage ?? null,
        plate: vehicle.plate ?? null,
        color: vehicle.color ?? null,
        notes: vehicle.notes ?? null,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
