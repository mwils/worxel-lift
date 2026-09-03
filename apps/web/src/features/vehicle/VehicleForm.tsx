import { useState } from "react";
import { Button, Group, NumberInput, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMediaQuery } from "@mantine/hooks";
import { zodResolver } from "mantine-form-zod-resolver";
import { notifications } from "@mantine/notifications";
import { IconBarcode } from "@tabler/icons-react";
import { CreateVehicleDto } from "@lift/shared/dto";
import type { z } from "zod";
import { api } from "../../lib/api";
import { VinScanner, isVinScannerSupported } from "./VinScanner";
import { VoiceCaptureButton } from "../voice/VoiceCaptureButton";
import type { VehicleMatch } from "../../lib/useVoiceTranscribe";

// VIN-barcode scanner is hidden while we debug the iPad Chrome UX.
// Flip to `true` to re-enable — the component + handlers are kept in place
// so re-enabling is a one-line change.
const SCAN_ENABLED = false;

type VehicleInput = z.infer<typeof CreateVehicleDto>;

export interface VehicleFormProps {
  customerId: string;
  initialValues?: Partial<VehicleInput>;
  submitLabel?: string;
  onSubmit: (values: VehicleInput) => Promise<void> | void;
  onCancel?: () => void;
  loading?: boolean;
  /** Surfaces voice-extracted matches to the parent so it can render a banner. */
  onMatchesFound?: (matches: VehicleMatch[]) => void;
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
  onMatchesFound,
}: VehicleFormProps) {
  const [decoding, setDecoding] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanSupported = SCAN_ENABLED && isVinScannerSupported();
  const isSmall = useMediaQuery("(max-width: 48em)");
  const form = useForm<VehicleInput>({
    initialValues: { ...emptyValues(customerId), ...initialValues },
    validate: zodResolver(CreateVehicleDto),
  });

  async function runDecode(vin: string) {
    const cleaned = vin.trim().toUpperCase();
    if (cleaned.length !== 17) {
      notifications.show({ color: "yellow", message: "VIN must be 17 characters" });
      return;
    }
    setDecoding(true);
    try {
      const res = await api.post<VinDecodeResponse>("/vehicles/decode-vin", { vin: cleaned });
      form.setValues((prev) => ({
        ...prev,
        year: res.year ?? prev.year,
        make: res.make ?? prev.make,
        model: res.model ?? prev.model,
        trim: res.trim ?? prev.trim,
        engine: res.engine ?? prev.engine,
      }));
    } catch (err) {
      const raw = (err as Error)?.message?.trim();
      notifications.show({
        color: "red",
        title: "Couldn't decode that VIN",
        message: raw || "Check the VIN and try again.",
      });
    } finally {
      setDecoding(false);
    }
  }

  function decodeVin() {
    void runDecode(form.values.vin ?? "");
  }

  function handleScan(vin: string) {
    form.setFieldValue("vin", vin);
    void runDecode(vin);
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
        <VoiceCaptureButton
          kind="vehicle"
          customerId={customerId}
          idleLabel="Tap to dictate the vehicle details."
          onResult={(r) => {
            if (r.kind !== "vehicle") return;
            const e = r.extracted;
            form.setValues((prev) => ({
              ...prev,
              vin: e.vin ?? prev.vin,
              year: e.year ?? prev.year,
              make: e.make ?? prev.make,
              model: e.model ?? prev.model,
              trim: e.trim ?? prev.trim,
              mileage: e.mileage ?? prev.mileage,
              plate: e.plate ?? prev.plate,
              color: e.color ?? prev.color,
              notes: e.notes ?? prev.notes,
            }));
            onMatchesFound?.(r.matches);
          }}
        />
        {isSmall ? (
          <Stack gap="xs">
            <TextInput
              label="VIN"
              placeholder="17 chars"
              maxLength={17}
              {...form.getInputProps("vin")}
              onChange={(e) => form.setFieldValue("vin", e.currentTarget.value.toUpperCase())}
            />
            <Group justify="flex-end">
              {scanSupported && (
                <Button
                  variant="default"
                  leftSection={<IconBarcode size={16} />}
                  onClick={() => setScannerOpen(true)}
                  type="button"
                >
                  Scan
                </Button>
              )}
              <Button
                variant="default"
                onClick={decodeVin}
                loading={decoding}
                type="button"
                aria-label={decoding ? "Decoding VIN" : "Decode VIN"}
              >
                Decode VIN
              </Button>
            </Group>
          </Stack>
        ) : (
          <Group align="flex-end">
            <TextInput
              label="VIN"
              placeholder="17 chars"
              maxLength={17}
              style={{ flex: 1 }}
              {...form.getInputProps("vin")}
              onChange={(e) => form.setFieldValue("vin", e.currentTarget.value.toUpperCase())}
            />
            {scanSupported && (
              <Button
                variant="default"
                leftSection={<IconBarcode size={16} />}
                onClick={() => setScannerOpen(true)}
                type="button"
              >
                Scan
              </Button>
            )}
            <Button variant="default" onClick={decodeVin} loading={decoding} type="button" aria-label={decoding ? "Decoding VIN" : "Decode VIN"}>
              Decode VIN
            </Button>
          </Group>
        )}

        {scanSupported && (
          <VinScanner
            opened={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onScan={handleScan}
          />
        )}
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
