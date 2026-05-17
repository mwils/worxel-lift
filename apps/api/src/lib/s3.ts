import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";

let _client: S3Client | null = null;

function client() {
  if (!_client) {
    _client = new S3Client({ region: process.env.AWS_REGION ?? "us-east-1" });
  }
  return _client;
}

export function bucket(): string {
  const b = process.env.S3_PHOTOS_BUCKET;
  if (!b) throw new Error("S3_PHOTOS_BUCKET not set");
  return b;
}

export async function presignUpload(args: {
  shopId: string;
  repairOrderId: string;
  contentType: string;
}): Promise<{ url: string; s3Key: string }> {
  const extension = (args.contentType.split("/")[1] ?? "jpg").replace(/[^a-z0-9]/gi, "");
  const s3Key = `shops/${args.shopId}/ros/${args.repairOrderId}/${Date.now()}-${randomBytes(8).toString("hex")}.${extension}`;
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: s3Key,
      ContentType: args.contentType,
    }),
    { expiresIn: 60 * 5 }
  );
  return { url, s3Key };
}

export async function presignDownload(s3Key: string, ttlSec = 3600): Promise<string> {
  return getSignedUrl(
    client(),
    new GetObjectCommand({ Bucket: bucket(), Key: s3Key }),
    { expiresIn: ttlSec }
  );
}
