import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DecodeVinDto, VinDecodeCache } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { ok } from "../../lib/response.js";

interface NhtsaResp {
  Results: Array<{ Variable: string; Value: string | null }>;
}

// NHTSA returns makes in ALL CAPS ("FORD", "MERCEDES-BENZ"). Title-case each
// word, but keep the makes that really are acronyms/stylized.
const MAKE_KEEP_UPPER = new Set(["GMC", "BMW", "RAM", "MINI", "MG", "SRT", "AMC", "KTM", "BYD", "GM"]);
const MAKE_SPECIAL: Record<string, string> = { MCLAREN: "McLaren", DETOMASO: "DeTomaso" };

export function titleCaseMake(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  // Already mixed-case (e.g. from a hand-typed cache row) — leave it alone.
  if (s !== s.toUpperCase()) return s;
  if (MAKE_SPECIAL[s]) return MAKE_SPECIAL[s];
  return s
    .split(/(\s+|-)/) // keep separators so "MERCEDES-BENZ" → "Mercedes-Benz"
    .map((part) => {
      if (!part || /^(\s+|-)$/.test(part)) return part;
      if (MAKE_KEEP_UPPER.has(part)) return part;
      return part.charAt(0) + part.slice(1).toLowerCase();
    })
    .join("");
}

/** Pull the fields we store out of an NHTSA DecodeVin response. */
export function pickDecoded(json: NhtsaResp) {
  const lookup = (key: string) => {
    const v = json.Results?.find((r) => r.Variable === key)?.Value;
    const t = v?.trim();
    return t ? t : undefined;
  };

  // Engine: "3.5L V6" from displacement + cylinders; fall back to EngineModel
  // when NHTSA only gave us a model code. Append the model when both exist and
  // it adds information ("2.0L L4 EcoBoost").
  const displacementL = Number(lookup("Displacement (L)"));
  const cylinders = Number(lookup("Engine Number of Cylinders"));
  const config = lookup("Engine Configuration"); // "V-Shaped", "In-Line", ...
  const engineModel = lookup("Engine Model");
  const engineParts: string[] = [];
  if (displacementL > 0) engineParts.push(`${displacementL.toFixed(1)}L`);
  if (cylinders > 0) {
    const prefix = config?.startsWith("V") ? "V" : config?.startsWith("In") ? "L" : "";
    engineParts.push(`${prefix}${cylinders}`);
  }
  if (engineModel && !engineParts.some((p) => engineModel.toUpperCase().includes(p.toUpperCase()))) {
    engineParts.push(engineModel);
  }
  const engine = engineParts.length ? engineParts.join(" ") : undefined;

  return {
    year: Number(lookup("Model Year")) || undefined,
    make: titleCaseMake(lookup("Make")),
    model: lookup("Model"),
    trim: lookup("Trim") ?? lookup("Series"),
    engine,
  };
}

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event }) => {
  try {
    const { vin } = await parseBody(event, DecodeVinDto);

    const cached = await VinDecodeCache.findOne({ vin }).lean();
    if (cached) {
      // Older cache rows were written before engine/trim/title-casing existed —
      // re-derive from the stored raw payload when we have it.
      const fromRaw = cached.raw?.Results ? pickDecoded(cached.raw as NhtsaResp) : null;
      return ok({
        vin,
        year: cached.year ?? fromRaw?.year,
        make: titleCaseMake(cached.make) ?? fromRaw?.make,
        model: cached.model ?? fromRaw?.model,
        trim: cached.trim ?? fromRaw?.trim,
        engine: fromRaw?.engine ?? cached.engine,
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
    const decoded = pickDecoded(json);

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
