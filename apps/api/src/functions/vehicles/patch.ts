import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { UpdateVehicleDto, Vehicle } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing vehicle id");

    const dto = await parseBody(event, UpdateVehicleDto);
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      // customerId reassignment isn't expected via this endpoint; allow it but
      // still scope by shopId so we can't yank a vehicle into another tenant.
      if (v !== undefined) update[k] = v;
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: id, shopId: user.shopId },
      { $set: update },
      { new: true }
    ).lean();
    if (!vehicle) return notFound("Vehicle not found");

    return ok({
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
