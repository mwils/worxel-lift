import { Button, Group, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { CreateCustomerDto, type CreateCustomerInput } from "@lift/shared/dto";
import { VoiceCaptureButton } from "../voice/VoiceCaptureButton";
import type { CustomerMatch } from "../../lib/useVoiceTranscribe";

export interface CustomerFormProps {
  initialValues?: Partial<CreateCustomerInput>;
  submitLabel?: string;
  onSubmit: (values: CreateCustomerInput) => Promise<void> | void;
  onCancel?: () => void;
  loading?: boolean;
  /** "edit" hides voice capture and the opt-in copy — both are create-flow only. */
  mode?: "create" | "edit";
  /** Surfaces voice-extracted matches to the parent so it can render a banner. */
  onMatchesFound?: (matches: CustomerMatch[]) => void;
}

const EMPTY: CreateCustomerInput = {
  firstName: "",
  lastName: "",
  phone: "",
  email: undefined,
  notes: undefined,
};

export function CustomerForm({
  initialValues,
  submitLabel = "Add customer",
  onSubmit,
  onCancel,
  loading,
  mode = "create",
  onMatchesFound,
}: CustomerFormProps) {
  const form = useForm<CreateCustomerInput>({
    initialValues: { ...EMPTY, ...initialValues },
    validate: zodResolver(CreateCustomerDto),
  });

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        // strip optional empty strings so Zod's email/url checks don't trip
        const payload: CreateCustomerInput = {
          ...values,
          email: values.email ? values.email : undefined,
          lastName: values.lastName ? values.lastName : undefined,
          notes: values.notes ? values.notes : undefined,
        };
        await onSubmit(payload);
      })}
    >
      <Stack>
        {mode === "create" && (
          <VoiceCaptureButton
            kind="customer"
            idleLabel="Tap to dictate the customer details."
            onResult={(r) => {
              if (r.kind !== "customer") return;
              const e = r.extracted;
              form.setValues((prev) => ({
                ...prev,
                firstName: e.firstName ?? prev.firstName,
                lastName: e.lastName ?? prev.lastName,
                phone: e.phone ?? prev.phone,
                email: e.email ?? prev.email,
                notes: e.notes ?? prev.notes,
              }));
              onMatchesFound?.(r.matches);
            }}
          />
        )}
        <Group grow>
          <TextInput
            label="First name"
            required
            {...form.getInputProps("firstName")}
          />
          <TextInput label="Last name" {...form.getInputProps("lastName")} />
        </Group>
        <TextInput
          label="Phone"
          placeholder="+15551234567"
          required
          description={
            mode === "edit"
              ? "Include the area code. Texts from their old number won't match this customer anymore."
              : "Include the area code. By adding this number you confirm the customer agreed to receive service texts about their vehicle. Msg frequency varies, msg & data rates may apply. They can reply STOP to opt out, HELP for help."
          }
          {...form.getInputProps("phone")}
        />
        <TextInput label="Email" type="email" {...form.getInputProps("email")} />
        <Textarea label="Notes" minRows={2} {...form.getInputProps("notes")} />

        <Group justify="flex-end">
          {onCancel && (
            <Button variant="subtle" onClick={onCancel} type="button">
              Cancel
            </Button>
          )}
          <Button type="submit" loading={loading}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
