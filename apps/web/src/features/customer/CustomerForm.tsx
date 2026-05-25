import { Button, Group, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { CreateCustomerDto, type CreateCustomerInput } from "@lift/shared/dto";

export interface CustomerFormProps {
  initialValues?: Partial<CreateCustomerInput>;
  submitLabel?: string;
  onSubmit: (values: CreateCustomerInput) => Promise<void> | void;
  onCancel?: () => void;
  loading?: boolean;
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
          description="Include the area code. Adding a customer opts them in to SMS."
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
