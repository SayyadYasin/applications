import { useState } from 'react';
import {
  Box,
  Button as MuiButton,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField as MuiTextField,
  Typography,
} from '@mui/material';
import {
  Datagrid,
  DateField,
  DateInput,
  FunctionField,
  List,
  ReferenceInput,
  SelectInput,
  Show,
  TextInput,
  AutocompleteInput,
  useGetList,
  useRecordContext,
} from 'react-admin';
import { api } from '../api';
import { PromptButton, useAction } from '../components/actions';
import { StatusChip, StatusField, fmtDate, inr, t } from '../components/common';

export const bookingStatuses = [
  'PENDING_PAYMENT', 'CONFIRMED', 'ASSIGNED', 'PARTNER_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED',
].map((id) => ({ id, name: id.replace(/_/g, ' ') }));

const filters = [
  <SelectInput key="status" source="status" choices={bookingStatuses} alwaysOn />,
  <ReferenceInput key="town" source="townId" reference="towns" alwaysOn>
    <AutocompleteInput optionText="name" label="Town" />
  </ReferenceInput>,
  <DateInput key="from" source="from" label="Scheduled from" alwaysOn />,
  <DateInput key="to" source="to" label="Scheduled to" alwaysOn />,
  <TextInput key="partner" source="partnerId" label="Partner ID" />,
  <TextInput key="customer" source="customerId" label="Customer ID" />,
];

export const BookingList = () => (
  <List filters={filters} perPage={20} sort={{ field: 'createdAt', order: 'DESC' }}>
    <Datagrid rowClick="show" bulkActionButtons={false}>
      <FunctionField label="Code" render={(r: any) => r.code} />
      <StatusField source="status" />
      <FunctionField label="Service" render={(r: any) => t(r.service?.name)} />
      <FunctionField label="Customer" render={(r: any) => r.customer?.user?.name} />
      <FunctionField label="Partner" render={(r: any) => r.partner?.user?.name ?? '-'} />
      <DateField source="scheduledAt" showTime sortable={false} />
      <FunctionField label="Total" render={(r: any) => inr(r.total)} />
      <FunctionField label="Payment" render={(r: any) => r.paymentMethod} />
    </Datagrid>
  </List>
);

function ForceAssign({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const { run, busy } = useAction();
  const { data } = useGetList('partners', { pagination: { page: 1, perPage: 100 }, filter: { kycStatus: 'APPROVED' } }, { enabled: open });
  return (
    <>
      <MuiButton variant="outlined" onClick={() => setOpen(true)}>Force assign</MuiButton>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Assign partner (KYC-approved only)</DialogTitle>
        <DialogContent>
          <MuiTextField select fullWidth margin="dense" label="Partner" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            {(data ?? []).map((p: any) => (
              <MenuItem key={p.id} value={p.id}>{p.user?.name} ({p.user?.phone ?? p.id})</MenuItem>
            ))}
          </MuiTextField>
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setOpen(false)}>Cancel</MuiButton>
          <MuiButton
            variant="contained"
            disabled={!partnerId || busy}
            onClick={async () => {
              await run(() => api(`admin/bookings/${id}/assign`, { method: 'POST', body: { partnerId } }), 'Partner assigned');
              setOpen(false);
            }}
          >
            Assign
          </MuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

function BookingBody() {
  const b = useRecordContext<Record<string, any>>();
  const { run, busy } = useAction();
  if (!b) return null;
  const terminal = ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status);
  const assignable = b.status === 'CONFIRMED' || b.status === 'ASSIGNED';
  const log: { status: string; at: string }[] = b.statusLog ?? [];
  const row = (k: string, v: unknown) => (
    <Stack direction="row" spacing={2} py={0.25} key={k}>
      <Typography sx={{ width: 140 }} color="text.secondary">{k}</Typography>
      <Typography>{(v as string) ?? '-'}</Typography>
    </Stack>
  );
  const addr = b.address
    ? Object.entries(b.address)
        .filter(([k, v]) => ['line1', 'line2', 'landmark', 'city', 'state', 'pincode', 'label'].includes(k) && v)
        .map(([, v]) => String(v))
        .join(', ')
    : '-';
  return (
    <Box p={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="h5">Booking {b.code}</Typography>
          <StatusChip value={b.status} />
        </Stack>
        <Stack direction="row" spacing={1}>
          <MuiButton
            variant="outlined"
            disabled={busy || !assignable}
            onClick={() => run(async () => {
              const r = await api<{ assigned: boolean; partnerId: string | null }>(`admin/bookings/${b.id}/auto-assign`, { method: 'POST', body: {} });
              if (!r.assigned) throw new Error('No eligible partner found');
              return r;
            }, 'Auto-assigned')}
          >
            Auto-assign
          </MuiButton>
          {assignable && <ForceAssign id={b.id} />}
          <PromptButton
            label="Cancel booking"
            title="Cancel booking"
            fieldLabel="Reason (optional)"
            color="error"
            required={false}
            disabled={terminal}
            onSubmit={(reason) => run(() => api(`admin/bookings/${b.id}/cancel`, { method: 'POST', body: reason ? { reason } : {} }), 'Booking cancelled')}
          />
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Status timeline</Typography>
          <Stepper orientation="vertical" activeStep={log.length} >
            {log.map((l, i) => (
              <Step key={i} completed>
                <StepLabel optional={<Typography variant="caption">{fmtDate(l.at)}</Typography>}>{l.status.replace(/_/g, ' ')}</StepLabel>
              </Step>
            ))}
          </Stepper>
          {log.length === 0 && <Typography color="text.secondary">No status history.</Typography>}
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>Booking</Typography>
            {row('Service', t(b.service?.name))}
            {row('Scheduled', fmtDate(b.scheduledAt))}
            {row('Total', inr(b.total))}
            {row('Payment method', b.paymentMethod)}
            {row('Coupon', b.coupon?.code)}
            {row('Address', addr)}
            {row('Cancel reason', b.cancelReason)}
            {row('Invoice', b.invoice?.number)}
          </CardContent></Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>People</Typography>
            {row('Customer', b.customer?.user?.name)}
            {row('Customer phone', b.customer?.user?.phone)}
            {row('Partner', b.partner?.user?.name)}
            {row('Partner phone', b.partner?.user?.phone)}
            {row('Earning (net)', b.earning ? inr(b.earning.net) : '-')}
            {row('Review', b.review ? `${b.review.rating}/5` : '-')}
          </CardContent></Card>
        </Grid>
        <Grid size={12}>
          <Card><CardContent>
            <Typography variant="h6" gutterBottom>Payments</Typography>
            {(b.payments ?? []).length === 0 && <Typography color="text.secondary">None</Typography>}
            {(b.payments ?? []).map((p: any) => (
              <Stack key={p.id} direction="row" spacing={2} alignItems="center" py={0.5}>
                <StatusChip value={p.status} />
                <Typography>{p.method}</Typography>
                <Typography>{inr(p.amount)}</Typography>
                <Typography color="text.secondary">refunded {inr(p.refundedAmount)}</Typography>
                <Typography variant="caption" color="text.secondary">{fmtDate(p.createdAt)}</Typography>
              </Stack>
            ))}
          </CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export const BookingShow = () => (
  <Show actions={false}>
    <BookingBody />
  </Show>
);
