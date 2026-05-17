import { Image, SimpleGrid, Stack, Text } from "@mantine/core";

export interface GalleryPhoto {
  id: string;
  s3Key: string;
  takenAt: string;
  caption: string | null;
}

export interface PhotoGalleryProps {
  photos: GalleryPhoto[];
  /** shopId is accepted for symmetry with capture but the path already
   *  contains the shop prefix, so it isn't used to build the URL today. */
  shopId?: string;
}

// NOTE: For production the photos bucket must be served by a CloudFront
// distribution with either (a) public read on the bucket prefix or (b)
// signed CloudFront URLs minted by the API. The `VITE_PHOTOS_CDN` host
// below is a placeholder; until that's wired we should switch to a
// per-photo presigned download URL via:
//   GET /repair-orders/:id/photos/:photoId/url
// TODO: signed-url endpoint — build alongside CloudFront in Slice H.
function buildSrc(s3Key: string): string {
  const host = import.meta.env.VITE_PHOTOS_CDN ?? "TODO-photos-cdn";
  return `https://${host}/${s3Key}`;
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  if (photos.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No photos yet.
      </Text>
    );
  }

  return (
    <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing="xs">
      {photos.map((photo) => (
        <Stack key={photo.id} gap={4}>
          <Image
            src={buildSrc(photo.s3Key)}
            alt={photo.caption ?? "Repair order photo"}
            radius="sm"
            fit="cover"
            h={96}
            fallbackSrc="https://placehold.co/96x96?text=…"
          />
          {photo.caption && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {photo.caption}
            </Text>
          )}
        </Stack>
      ))}
    </SimpleGrid>
  );
}
