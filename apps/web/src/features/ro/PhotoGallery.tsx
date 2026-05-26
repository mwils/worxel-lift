import { Image, SimpleGrid, Stack, Text } from "@mantine/core";

export interface GalleryPhoto {
  id: string;
  s3Key: string;
  url: string;
  takenAt: string;
  caption: string | null;
}

export interface PhotoGalleryProps {
  photos: GalleryPhoto[];
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
            src={photo.url}
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
