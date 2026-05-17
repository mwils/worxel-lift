import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DecodeVinDto, VinDecodeCache } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { ok } from "../../lib/response.js";

interface NhtsaResp {
  Results: Array<{ Variable: string; Value: string | null }>;
}

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event }) => {
  try {
    const { vin } = await parseBody(event, DecodeVinDto);

    const cached = await VinDecodeCache.findOne({ vin }).lean();
    if (cached) {
      return ok({
        vin,
        year: cached.year,
        make: cached.make,
        model: cached.model,
        trim: cached.trim,
        engine: cached.engine,
        source: "cache",
      });
    }

    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(vin)}?format=json`
    );
    if (!res.ok) {
      return ok({ vin, source: "nhtsa", error: `NHTSA ${res.status}` });
    }
    const json = (await res.json()) as NhtsaResp;
    const lookup = (key: string) => json.Results.find((r) => r.Variable === key)?.Value ?? undefined;

    const decoded = {
      year: Number(lookup("Model Year")) || undefined,
      make: lookup("Make") ?? undefined,
      model: lookup("Model") ?? undefined,
      trim: lookup("Trim") ?? undefined,
      engine: lookup("Engine Model") ?? undefined,
    };

    await VinDecodeCache.updateOne(
      { vin },
      { $set: { ...decoded, raw: json, decodedAt: new Date() } },
      { upsert: true }
    );

    return ok({ vin, ...decoded, source: "nhtsa" });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
