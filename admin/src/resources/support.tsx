import { useEffect, useState } from 'react';
import { Box, Button as MuiButton, Card, CardContent, MenuItem, Stack, TextField as MuiTextField, Typography } from '@mui/material';
import { BooleanField, Datagrid, DateField, FunctionField, List, SelectInput, Show, TextField, TextInput, useRecordContext } from 'react-admin';
import { api } from '../api';
import { useAction } from '../components/actions';
import { StatusChip, StatusField, fmtDate } from '../components/common';

const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const filters = [
  <SelectInput key="s" source="status" alwaysOn choices={statuses.map((id) => ({ id, name: id }))} />,
  <SelectInput key="d" source="isDispute" label="Type" alwaysOn choices={[{ id: 'true', name: 'Disputes' }, { id: 'false', name: 'Tickets' }]} />,
  <TextInput key="u" source="userId" label="User ID" />,
  <TextInput key="b" source="bookingId" label="Booking ID" />,
];

export const TicketList = () => (
  <List filters={filters} perPage={25} sort={{ field: 'createdAt', order: 'DESC' }}>
    <Datagrid rowClick="show" bulkActionButtons={false}>
      <TextField source="subject" sortable={false} />
      <StatusField source="status" />
      <BooleanField source="isDispute" label="Dispute" sortable={false} />
      <FunctionField label="User" render={(r: any) => `${r.user?.name ?? ''} (${r.user?.role ?? ''})`} />
      <DateField source="createdAt" showTime sortable={false} />
    </Datagrid>
  </List>
);

function TicketBody() {
  const t = useRecordContext<Record<string, any>>();
  const { run, busy } = useAction();
  const [status, setStatus] = useState('OPEN');
  const [resolution, setResolution] = useState('');
  useEffect(() => {
    if (t) {
      setStatus(t.status);
      setResolution(t.resolution ?? '');
    }
  }, [t?.id, t?.status, t?.resolution]);
  if (!t) return null;

  const update = () =>
    run(() => api(`admin/support/tickets/${t.id}`, { method: 'PATCH', body: { status, resolution } }), 'Ticket updated');
  const resolveDispute = (final: 'RESOLVED' | 'CLOSED') =>
    run(() => api(`admin/support/tickets/${t.id}/resolve-dispute`, { method: 'POST', body: { resolution, status: final } }), 'Dispute resolved');

  return (
    <Box p={2}>
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <Typography variant="h5">{t.subject}</Typography>
        <StatusChip value={t.status} />
        {t.isDispute && <StatusChip value="DISPUTE" />}
      </Stack>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography color="text.secondary" variant="caption">
            {t.user?.name} ({t.user?.role}) {t.user?.phone} {t.user?.email} - {fmtDate(t.createdAt)}
          </Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>{t.body}</Typography>
          {t.booking && <Typography mt={1} variant="body2">Booking: {t.booking.code} ({t.booking.status})</Typography>}
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Resolution</Typography>
          <Stack spacing={2} maxWidth={640}>
            <MuiTextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statuses.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </MuiTextField>
            <MuiTextField multiline minRows={3} label="Resolution notes" value={resolution} onChange={(e) => setResolution(e.target.value)} />
            <Stack direction="row" spacing={1}>
              <MuiButton variant="contained" disabled={busy} onClick={update}>Save</MuiButton>
              {t.isDispute && (
                <>
                  <MuiButton color="success" variant="outlined" disabled={busy || !resolution.trim()} onClick={() => resolveDispute('RESOLVED')}>Resolve dispute</MuiButton>
                  <MuiButton color="inherit" variant="outlined" disabled={busy || !resolution.trim()} onClick={() => resolveDispute('CLOSED')}>Close dispute</MuiButton>
                </>
              )}
            </Stack>
            {t.isDispute && <Typography variant="caption" color="text.secondary">Resolving a dispute requires resolution notes and notifies the user.</Typography>}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export const TicketShow = () => (
  <Show actions={false}>
    <TicketBody />
  </Show>
);
