import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSparkles } from "@tabler/icons-react";
import { micromark } from "micromark";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { notifyError } from "../../../lib/notify";

interface AdminBlogPost {
  id: string;
  slug: string;
  title: string;
  metaDescription: string;
  topicKey: string;
  bucket: string;
  bodyMarkdown: string;
  status: "scheduled" | "published" | "rejected";
  scheduledFor: string | null;
  publishedAt: string | null;
  model: string | null;
  editedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
}

type Tab = "queue" | "published" | "rejected";

const STATUS_COLOR: Record<AdminBlogPost["status"], string> = {
  scheduled: "blue",
  published: "green",
  rejected: "red",
};

function fmtCentral(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** ISO → value for <input type="datetime-local"> in the browser's local zone. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AdminBlogRoute() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("queue");
  const [editing, setEditing] = useState<AdminBlogPost | null>(null);

  const postsQ = useQuery({
    queryKey: ["adminBlog", tab],
    queryFn: () => api.get<{ posts: AdminBlogPost[] }>(`/admin/blog/posts?status=${tab}`),
    enabled: me?.user.isCompanyAdmin === true,
  });

  const generate = useMutation({
    mutationFn: () =>
      api.post<{ result: { generated: number; failed: number; queueBefore: number } }>(
        "/admin/blog/generate"
      ),
    onSuccess: (res) => {
      const r = res.result;
      notifications.show({
        color: r.generated > 0 ? "green" : "yellow",
        message:
          r.generated > 0
            ? `Drafted ${r.generated} post${r.generated === 1 ? "" : "s"} (queue was ${r.queueBefore}).`
            : r.failed > 0
              ? "Draft failed — check logs and try again."
              : "Queue is already full.",
      });
      qc.invalidateQueries({ queryKey: ["adminBlog"] });
    },
    onError: (err) => notifyError(err, { title: "Couldn't generate" }),
  });

  if (me && me.user.isCompanyAdmin !== true) return <Navigate to="/" replace />;

  const posts = postsQ.data?.posts ?? [];

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Stack gap={2}>
          <Title order={2}>Blog admin</Title>
          <Text size="sm" c="dimmed">
            Queued posts publish automatically at their scheduled time unless you reject them.
          </Text>
        </Stack>
        <Button
          leftSection={<IconSparkles size={16} />}
          onClick={() => generate.mutate()}
          loading={generate.isPending}
        >
          Generate draft
        </Button>
      </Group>

      <SegmentedControl
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        data={[
          { value: "queue", label: "Queue" },
          { value: "published", label: "Published" },
          { value: "rejected", label: "Rejected" },
        ]}
        w="fit-content"
      />

      {postsQ.isPending ? (
        <Text c="dimmed">Loading…</Text>
      ) : posts.length === 0 ? (
        <Text c="dimmed">
          {tab === "queue"
            ? "Queue is empty — hit Generate draft to start filling it."
            : "Nothing here yet."}
        </Text>
      ) : (
        <Stack gap="xs">
          {posts.map((p) => (
            <Card
              key={p.id}
              withBorder
              style={{ cursor: "pointer" }}
              onClick={() => setEditing(p)}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text fw={600} lineClamp={1}>
                    {p.title}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {p.metaDescription}
                  </Text>
                  <Group gap={8}>
                    <Text size="xs" c="dimmed">
                      {fmtCentral(p.scheduledFor)} Central
                    </Text>
                    <Badge size="xs" variant="light">
                      {p.bucket.replace(/_/g, " ")}
                    </Badge>
                    {p.editedAt && (
                      <Badge size="xs" variant="light" color="grape">
                        edited
                      </Badge>
                    )}
                  </Group>
                </Stack>
                <Badge color={STATUS_COLOR[p.status]} variant="light">
                  {p.status}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <EditDrawer
        post={editing}
        onClose={() => setEditing(null)}
        onChanged={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["adminBlog"] });
        }}
      />
    </Stack>
  );
}

function EditDrawer({
  post,
  onClose,
  onChanged,
}: {
  post: AdminBlogPost | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);

  // Sync form state when a different post opens.
  if (post && post.id !== loadedId) {
    setLoadedId(post.id);
    setTitle(post.title);
    setMetaDescription(post.metaDescription);
    setSlug(post.slug);
    setBody(post.bodyMarkdown);
    setScheduledLocal(isoToLocalInput(post.scheduledFor));
    setShowPreview(false);
    setRejectReason("");
  }

  // micromark escapes raw HTML by default — same renderer as production.
  const previewHtml = useMemo(() => (showPreview ? micromark(body) : ""), [showPreview, body]);

  const save = useMutation({
    mutationFn: () => {
      const patch: Record<string, unknown> = { title, metaDescription, slug, bodyMarkdown: body };
      if (scheduledLocal) patch.scheduledFor = new Date(scheduledLocal).toISOString();
      return api.patch(`/admin/blog/posts/${post!.id}`, patch);
    },
    onSuccess: () => {
      notifications.show({ color: "green", message: "Saved." });
      onChanged();
    },
    onError: (err) => notifyError(err, { title: "Couldn't save" }),
  });

  const reject = useMutation({
    mutationFn: () =>
      api.post(`/admin/blog/posts/${post!.id}/reject`, {
        reason: rejectReason.trim() || undefined,
      }),
    onSuccess: () => {
      notifications.show({
        color: "green",
        message: "Rejected — the next generation run drafts a replacement on a new topic.",
      });
      setRejectOpen(false);
      onChanged();
    },
    onError: (err) => notifyError(err, { title: "Couldn't reject" }),
  });

  const readOnly = post?.status === "rejected";

  return (
    <Drawer opened={!!post} onClose={onClose} position="right" size="xl" title={post?.slug ?? ""}>
      {post && (
        <Stack>
          <TextInput
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            disabled={readOnly}
          />
          <TextInput
            label={`Meta description (${metaDescription.length}/155)`}
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.currentTarget.value)}
            maxLength={155}
            disabled={readOnly}
          />
          <TextInput
            label="Slug"
            description={
              post.status !== "scheduled"
                ? "Careful: changing a live slug breaks the old URL."
                : undefined
            }
            value={slug}
            onChange={(e) => setSlug(e.currentTarget.value)}
            disabled={readOnly}
          />
          <TextInput
            type="datetime-local"
            label="Scheduled (your local time)"
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.currentTarget.value)}
            disabled={readOnly}
          />

          <Group justify="space-between">
            <Text size="sm" fw={600}>
              Body (markdown)
            </Text>
            <Button size="compact-xs" variant="subtle" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? "Edit" : "Preview"}
            </Button>
          </Group>
          {showPreview ? (
            <Card withBorder>
              <Box dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </Card>
          ) : (
            <Textarea
              autosize
              minRows={16}
              value={body}
              onChange={(e) => setBody(e.currentTarget.value)}
              disabled={readOnly}
              styles={{ input: { fontFamily: "monospace", fontSize: 13 } }}
            />
          )}

          {post.rejectionReason && (
            <Text size="sm" c="red">
              Rejected: {post.rejectionReason}
            </Text>
          )}

          {!readOnly && (
            <Group justify="space-between">
              <Button color="red" variant="light" onClick={() => setRejectOpen(true)}>
                {post.status === "scheduled" ? "Reject" : "Retract"}
              </Button>
              <Group>
                <Button variant="default" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={() => save.mutate()} loading={save.isPending}>
                  Save
                </Button>
              </Group>
            </Group>
          )}
        </Stack>
      )}

      <Modal
        opened={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title={post?.status === "scheduled" ? "Reject this draft?" : "Retract this post?"}
        centered
      >
        <Stack>
          <Text size="sm">
            {post?.status === "scheduled"
              ? "It won't publish, and the next generation run drafts a replacement on a new topic."
              : "It disappears from the public blog within about 5 minutes (CDN cache)."}
          </Text>
          <Textarea
            label="Reason (optional, for your own notes)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.currentTarget.value)}
            autosize
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={() => reject.mutate()} loading={reject.isPending}>
              {post?.status === "scheduled" ? "Reject" : "Retract"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Drawer>
  );
}
