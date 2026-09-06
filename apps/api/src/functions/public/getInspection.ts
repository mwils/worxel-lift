import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Customer, RepairOrder, Shop, Vehicle } from "@lift/shared";
import { withErrorBoundary } from "../../lib/middleware.js";
import { notFound, ok } from "../../lib/response.js";
import { presignDownload } from "../../lib/s3.js";
import { approvedSnapshotView, ensureApprovalSnapshot } from "../repairOrders/_estimate.js";

const SEVERITY_RANK: Record<string, number> = { red: 0, yellow: 1, green: 2 };
const PHOTO_URL_TTL_SEC = 24 * 60 * 60;

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const ro = await RepairOrder.findOne({ "inspection.publicToken": token });
  if (!ro) return notFound();

  const inspection: any = (ro as any).inspection;
  if (!inspection) return notFound();

  if (!inspection.viewedAt) {
    inspection.viewedAt = new Date();
    await ro.save();
  }

  // The embedded estimate follows the same rule as the estimate page: once
  // approved, show the approved snapshot, not whatever the lines are now.
  await ensureApprovalSnapshot(ro as any);
  const approvedEstimate = approvedSnapshotView(ro as any);
  const estimateLines: Array<{ kind: string; description: string; total: number }> =
    approvedEstimate?.lineItems ??
    (ro.lineItems ?? []).map((li: any) => ({
      kind: li.kind,
      description: li.description,
      total: li.total,
    }));

  const [customer, vehicle, shop] = await Promise.all([
    Customer.findById(ro.customerId).lean(),
    Vehicle.findById(ro.vehicleId).lean(),
    Shop.findById(ro.shopId).lean(),
  ]);

  const photoMap = new Map<string, { s3Key: string; takenAt: Date | null; caption: string | null }>();
  for (const p of (ro.photos ?? []) as any[]) {
    photoMap.set(String(p._id), {
      s3Key: p.s3Key,
      takenAt: p.takenAt ?? null,
      caption: p.caption ?? null,
    });
  }

  const items = await Promise.all(
    (inspection.items ?? []).map(async (item: any) => {
      const photoIds = (item.photoIds ?? []).map((id: any) => String(id));
      const photos = await Promise.all(
        photoIds.map(async (pid: string) => {
          const photo = photoMap.get(pid);
          if (!photo) return null;
          const url = await presignDownload(photo.s3Key, PHOTO_URL_TTL_SEC);
          return { url, takenAt: photo.takenAt, caption: photo.caption };
        })
      );
      return {
        id: String(item._id),
        title: item.title,
        severity: item.severity,
        note: item.note ?? null,
        order: item.order ?? 0,
        photos: photos.filter(Boolean),
      };
    })
  );

  items.sort((a, b) => {
    const sa = SEVERITY_RANK[a.severity] ?? 99;
    const sb = SEVERITY_RANK[b.severity] ?? 99;
    if (sa !== sb) return sa - sb;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  return ok({
    shop: shop ? { name: shop.name, phone: shop.sms?.phoneNumber ?? null } : null,
    vehicle: vehicle
      ? { year: vehicle.year ?? null, make: vehicle.make ?? null, model: vehicle.model ?? null }
      : null,
    customer: customer ? { firstName: customer.firstName } : null,
    items,
    estimate: {
      lineItems: estimateLines.map((li) => ({
        description: li.description,
        kind: li.kind,
        total: li.total,
      })),
      taxTotal: approvedEstimate?.taxTotal ?? ro.taxTotal ?? 0,
      taxRateBps: customer?.taxExempt ? 0 : ro.taxRateBps ?? 0,
      taxAppliesTo: ro.taxAppliesTo ?? "parts",
      total: approvedEstimate?.total ?? ro.total ?? 0,
      approvedAt: ro.estimate?.approvedAt ?? null,
      status: ro.estimate?.approvedAt
        ? "approved"
        : ro.estimate?.declinedAt
        ? "declined"
        : ro.estimate?.sentAt
        ? "sent"
        : "draft",
      publicToken: ro.estimate?.publicToken ?? null,
    },
    sentAt: inspection.sentAt ?? null,
    viewedAt: inspection.viewedAt ?? null,
  });
});
