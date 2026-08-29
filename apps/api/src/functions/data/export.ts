import type { APIGatewayProxyHandlerV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createRequire } from "node:module";
// archiver is CJS-only and its `module.exports = fn` shape doesn't bundle under
// esbuild's strict ESM resolution. createRequire sidesteps the bundler.
const requireCjs = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = requireCjs("archiver") as typeof import("archiver");
import { Customer, Message, Payment, RepairOrder, Vehicle } from "@lift/shared";
import { withOwnerAuth } from "../../lib/middleware.js";
import { badRequest } from "../../lib/response.js";

/**
 * GET /data/export
 *
 * Streams a zip of CSVs containing the owner's shop data (customers,
 * vehicles, repair orders, line items, messages, payments). All collections
 * are scoped by `user.shopId`.
 *
 * NOTE: API Gateway has a 10 MB response cap. For 1–3 bay shops this is
 * comfortable headroom, but each collection is capped at MAX_ROWS to protect
 * against pathological data sets; a `_truncated.txt` is added if any cap is
 * hit.
 */

const MAX_ROWS = 10_000;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  const s = typeof value === "string" ? value : String(value);
  // Always quote — simplest correct behavior. Escape embedded quotes.
  return `"${s.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",") + "\n";
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  let out = headers.join(",") + "\n";
  for (const r of rows) out += csvRow(r);
  return out;
}

export const handler: APIGatewayProxyHandlerV2 = withOwnerAuth(async ({ user }) => {
  if (!user.shopId) return badRequest("User has no shop yet");
  const shopId = user.shopId;

  // Pull each collection (capped). Lean for speed — we only read.
  const [customers, vehicles, ros, messages, payments] = await Promise.all([
    Customer.find({ shopId }).limit(MAX_ROWS + 1).lean(),
    Vehicle.find({ shopId }).limit(MAX_ROWS + 1).lean(),
    RepairOrder.find({ shopId }).limit(MAX_ROWS + 1).lean(),
    Message.find({ shopId }).limit(MAX_ROWS + 1).lean(),
    Payment.find({ shopId }).limit(MAX_ROWS + 1).lean(),
  ]);

  const truncated: string[] = [];
  function cap<T>(rows: T[], name: string): T[] {
    if (rows.length > MAX_ROWS) {
      truncated.push(`${name}: capped at ${MAX_ROWS} rows`);
      return rows.slice(0, MAX_ROWS);
    }
    return rows;
  }

  const customersCsv = buildCsv(
    ["id", "firstName", "lastName", "phone", "email", "smsOptInAt", "createdAt", "notes"],
    cap(customers, "customers").map((c) => [
      c._id,
      c.firstName,
      c.lastName,
      c.phone,
      c.email,
      c.smsOptInAt,
      (c as any).createdAt,
      c.notes,
    ])
  );

  const vehiclesCsv = buildCsv(
    ["id", "customerId", "year", "make", "model", "vin", "mileage", "plate", "color", "createdAt"],
    cap(vehicles, "vehicles").map((v) => [
      v._id,
      v.customerId,
      v.year,
      v.make,
      v.model,
      v.vin,
      v.mileage,
      v.plate,
      v.color,
      (v as any).createdAt,
    ])
  );

  const roSlice = cap(ros, "repair_orders");
  const repairOrdersCsv = buildCsv(
    [
      "id",
      "number",
      "status",
      "customerId",
      "vehicleId",
      "concern",
      "laborTotal",
      "partsTotal",
      "total",
      "completedAt",
      "createdAt",
    ],
    roSlice.map((r) => [
      r._id,
      r.number,
      r.status,
      r.customerId,
      r.vehicleId,
      r.concern,
      r.laborTotal,
      r.partsTotal,
      r.total,
      r.completedAt,
      (r as any).createdAt,
    ])
  );

  // Line items are denormalised from the RO doc (no truncation cap — they
  // ride along with the already-capped RO list).
  const lineItemRows: unknown[][] = [];
  for (const r of roSlice) {
    for (const li of r.lineItems ?? []) {
      lineItemRows.push([
        r._id,
        li.kind,
        li.description,
        li.hours,
        li.rate,
        li.qty,
        li.unitPrice,
        li.total,
      ]);
    }
  }
  const lineItemsCsv = buildCsv(
    ["roId", "kind", "description", "hours", "rate", "qty", "unitPrice", "total"],
    lineItemRows
  );

  const messagesCsv = buildCsv(
    ["id", "customerId", "repairOrderId", "direction", "body", "sentAt", "aiDrafted", "autoReplied"],
    cap(messages, "messages").map((m) => [
      m._id,
      m.customerId,
      m.repairOrderId,
      m.direction,
      m.body,
      m.sentAt,
      m.aiDrafted,
      m.autoReplied,
    ])
  );

  const paymentsCsv = buildCsv(
    ["id", "repairOrderId", "stripePaymentIntentId", "amountCents", "status", "last4", "completedAt"],
    cap(payments, "payments").map((p) => [
      p._id,
      p.repairOrderId,
      p.stripePaymentIntentId,
      p.amountCents,
      p.status,
      p.last4,
      p.completedAt,
    ])
  );

  // Build the zip into a Buffer in memory. archiver is stream-based but
  // Lambda needs a single response body, so we collect chunks.
  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on("data", (chunk) => chunks.push(chunk as Buffer));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("warning", (err) => {
      if (err.code !== "ENOENT") reject(err);
    });
    archive.on("error", reject);

    archive.append(customersCsv, { name: "customers.csv" });
    archive.append(vehiclesCsv, { name: "vehicles.csv" });
    archive.append(repairOrdersCsv, { name: "repair_orders.csv" });
    archive.append(lineItemsCsv, { name: "line_items.csv" });
    archive.append(messagesCsv, { name: "messages.csv" });
    archive.append(paymentsCsv, { name: "payments.csv" });
    if (truncated.length > 0) {
      archive.append(
        `Some collections exceeded the ${MAX_ROWS}-row export cap and were truncated:\n\n${truncated.join("\n")}\n`,
        { name: "_truncated.txt" }
      );
    }

    archive.finalize();
  });

  const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `lift-export-${user.shopId}-${yyyymmdd}.zip`;

  const result: APIGatewayProxyStructuredResultV2 = {
    statusCode: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
    isBase64Encoded: true,
    body: zipBuffer.toString("base64"),
  };
  return result;
});
