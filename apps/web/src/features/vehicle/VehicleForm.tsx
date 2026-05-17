import { useState } from "react";
import { Button, Group, NumberInput, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { notifications } from "@mantine/notifications";
import { CreateVehicleDto } from "@lift/shared/dto";
import type { z } from "zod";
import { api } from "../../lib/api";

type VehicleInput = z.infer<typeof CreateVehicleDto>;

export interface VehicleFormProps {
  customerId: string;
  initialValues?: Partial<VehicleInput>;
  submitLabel?: string;
  onSubmit: (values: VehicleInput) => Promise<void> | void;
  onCancel?: () => void;
  loading?: boolean;
}

interface VinDecodeResponse {
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  engine?: string;
  source: "cache" | "nhtsa";
}

function emptyValues(customerId: string): VehicleInput {
  return {
    customerId,
    vin: undefined,
    year: undefined,
    make: undefined,
    model: undefined,
    trim: undefined,
    engine: undefined,
    mileage: undefined,
    plate: undefined,
    color: undefined,
    notes: undefined,
  };
}

export function VehicleForm({
  customerId,
  initialValues,
  submitLabel = "Save vehicle",
  onSubmit,
  onCancel,
  loading,
}: VehicleFormProps) {
  const [decoding, setDecoding] = useState(false);
  const form = useForm<VehicleInput>({
    initialValues: { ...emptyValues(customerId), ...initialValues },
    validate: zodResolver(CreateVehicleDto),
  });

  async function decodeVin() {
    const vin = (form.values.vin ?? "").trim();
    if (vin.length !== 17) {
      notifications.show({ color: "yellow", message: "VIN must be 17 characters" });
      return;
    }
    setDecoding(true);
    try {
      const res = await api.post<VinDecodeResponse>("/vehicles/decode-vin", { vin });
      form.setValues((prev) => ({
        ...prev,
        year: res.year ?? prev.year,
        make: res.make ?? prev.make,
        model: res.model ?? prev.model,
        trim: res.trim ?? prev.trim,
        engine: res.engine ?? prev.engine,
      }));
    } catch (err) {
      notifications.show({ color: "red", message: (err as Error).message });
    } finally {
      setDecoding(false);
    }
  }

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        const payload: VehicleInput = {
          ...values,
          vin: values.vin ? values.vin : undefined,
          make: values.make ? values.make : undefined,
          model: values.model ? values.model : undefined,
          trim: values.trim ? values.trim : undefined,
          engine: values.engine ? values.engine : undefined,
          plate: values.plate ? values.plate : undefined,
          color: values.color ? values.color : undefined,
          notes: values.notes ? values.notes : undefined,
        };
        await onSubmit(payload);
      })}
    >
      <Stack>
        <Group align="flex-end">
          <TextInput
            label="VIN"
            placeholder="17 chars"
            maxLength={17}
            style={{ flex: 1 }}
            {...form.getInputProps("vin")}
          />
          <Button variant="default" onClick={decodeVin} loading={decoding} type="button">
            Decode VIN
          </Button>
        </Group>
        <Group grow>
          <NumberInput
            label="Year"
            min={1900}
            max={2100}
            {...form.getInputProps("year")}
          />
          <TextInput label="Make" {...form.getInputProps("make")} />
          <TextInput label="Model" {...form.getInputProps("model")} />
        </Group>
        <Group grow>
          <TextInput label="Trim" {...form.getInputProps("trim")} />
          <TextInput label="Engine" {...form.getInputProps("engine")} />
        </Group>
        <Group grow>
          <NumberInput
            label="Mileage"
            min={0}
            thousandSeparator=","
            {...form.getInputProps("mileage")}
          />
          <TextInput label="Plate" {...form.getInputProps("plate")} />
          <TextInput label="Color" {...form.getInputProps("color")} />
        </Group>
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
