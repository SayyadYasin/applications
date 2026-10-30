import { useState } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import {
  FunctionField,
  NumberField,
  TextInput,
  required,
  useRecordContext,
  usePermissions,
  type FunctionFieldProps,
} from 'react-admin';

export type Localized = Record<string, string> | string | null | undefined;

/** Picks en (fallback hi / first value) from an i18n JSON value. */
export const t = (v: Localized): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v.en ?? v.hi ?? Object.values(v)[0] ?? '';
};

export const useIsSuperAdmin = () => {
  const { permissions } = usePermissions();
  return permissions === 'SUPER_ADMIN';
};

/** Shows the English text of an i18n JSON column. */
export const I18nField = ({ source, label }: { source: string; label?: string }) => (
  <FunctionField
    label={label ?? source}
    source={source}
    sortable={false}
    render={(r: Record<string, any>) => {
      const v = r[source] as Localized;
      return (
        <span>
          {t(v)}
          {v && typeof v === 'object' && v.hi ? <Typography component="span" variant="caption" color="text.secondary"> / {v.hi}</Typography> : null}
        </span>
      );
    }}
  />
);

/** en + hi text inputs bound to `source.en` / `source.hi`. */
export const I18nInput = ({ source, label, multiline, requiredEn = true }: { source: string; label?: string; multiline?: boolean; requiredEn?: boolean }) => (
  <Box display="flex" gap={2} width="100%" flexWrap="wrap">
    <TextInput source={`${source}.en`} label={`${label ?? source} (en)`} multiline={multiline} minRows={multiline ? 4 : undefined} validate={requiredEn ? required() : undefined} sx={{ flex: 1, minWidth: 260 }} />
    <TextInput source={`${source}.hi`} label={`${label ?? source} (hi)`} multiline={multiline} minRows={multiline ? 4 : undefined} sx={{ flex: 1, minWidth: 260 }} />
  </Box>
);

/** Raw JSON editor for arbitrary JSON values (settings). */
export const JsonInput = ({ source, label }: { source: string; label?: string }) => {
  const [err, setErr] = useState<string | undefined>();
  return (
    <TextInput
      source={source}
      label={label}
      multiline
      minRows={4}
      fullWidth
      helperText={err}
      format={(v: unknown) => (typeof v === 'string' && err ? v : JSON.stringify(v ?? null, null, 2))}
      parse={(v: string) => {
        try {
          const parsed = JSON.parse(v);
          setErr(undefined);
          return parsed;
        } catch {
          setErr('Invalid JSON');
          return v;
        }
      }}
      validate={(v: unknown) => (typeof v === 'string' ? 'Invalid JSON' : undefined)}
      sx={{ '& textarea': { fontFamily: 'monospace' } }}
    />
  );
};

export const Money = ({ source, label }: { source: string; label?: string }) => (
  <NumberField source={source} label={label} options={{ style: 'currency', currency: 'INR', maximumFractionDigits: 2 }} />
);

const colors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  APPROVED: 'success', PAID: 'success', COMPLETED: 'success', RESOLVED: 'success', PROCESSED: 'success', CONFIRMED: 'info',
  SUBMITTED: 'warning', REQUESTED: 'warning', PENDING: 'warning', PENDING_PAYMENT: 'warning', OPEN: 'warning', IN_PROGRESS: 'info',
  ASSIGNED: 'info', PARTNER_EN_ROUTE: 'info',
  REJECTED: 'error', CANCELLED: 'error', FAILED: 'error', CLOSED: 'default',
  REFUNDED: 'info', PARTIALLY_REFUNDED: 'info',
};

export const StatusChip = ({ value }: { value?: string | null }) =>
  value ? <Chip size="small" label={value.replace(/_/g, ' ')} color={colors[value] ?? 'default'} variant="outlined" /> : null;

export const StatusField = ({ source, label }: { source: string; label?: string }) => (
  <FunctionField label={label ?? source} source={source} render={(r: Record<string, any>) => <StatusChip value={r[source]} />} />
);

export const useRec = <T extends Record<string, any> = Record<string, any>>() => useRecordContext<T>();

export const fmtDate = (v?: string | Date | null) => (v ? new Date(v).toLocaleString() : '-');
export type { FunctionFieldProps };
export const inr = (n: number | string | null | undefined) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n ?? 0));
