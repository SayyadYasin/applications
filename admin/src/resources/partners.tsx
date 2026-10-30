import { useState } from 'react';
import {
  Alert,
  Box,
  Button as MuiButton,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField as MuiTextField,
  Typography,
} from '@mui/material';
import {
  BooleanField,
  Datagrid,
  FunctionField,
  List,
  NumberField,
  SearchInput,
  SelectInput,
  Show,
  TextField,
  useNotify,
  useRecordContext,
  useRefresh,
} from 'react-admin';
import { api, DOCS_BASE_URL } from '../api';
import { PromptButton, useAction } from '../components/actions';
import { StatusChip, StatusField, fmtDate, inr, t } from '../components/common';

const kycStatuses = ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((id) => ({ id, name: id }));

const filters = [
  <SearchInput key="q" source="q" alwaysOn placeholder="Name, email or phone" />,
  <SelectInput key="kyc" source="kycStatus" label="KYC status" choices={kycStatuses} alwaysOn />,
];

export const PartnerList = () => (
  <List filters={filters} perPage={20} sort={{ field: 'ratingAvg', order: 'DESC' }}>
    <Datagrid rowClick="show" bulkActionButtons={false}>
      <FunctionField label="Name" render={(r: any) => r.user?.name} />
      <FunctionField label="Phone" render={(r: any) => r.user?.phone} />
      <StatusField source="kycStatus" label="KYC" />
      <BooleanField source="isOnline" label="Online" sortable={false} />
      <NumberField source="ratingAvg" label="Rating" sortable={false} options={{ maximumFractionDigits: 2 }} />
      <NumberField source="completedJobs" label="Jobs" sortable={false} />
      <FunctionField label="Commission %" render={(r: any) => (r.commissionPct ?? 'default')} />
    </Datagrid>
  </List>
);

interface Doc {
  id: string;
  type: string;
  s3Key: string;
  verified: boolean;
  createdAt: string;
}

function DocViewer({ doc }: { doc: Doc }) {
  const notify = useNotify();
  const [info, setInfo] = useState<Record<string, any> | null>(null);

  const view = async () => {
    try {
      // GET admin/partners/documents/:docId -> { id, type, key, verified } (and a url if the API ever adds one)
      const r = await api<Record<string, any>>(`admin/partners/documents/${doc.id}`);
      const url: string | undefined = r.url ?? r.viewUrl ?? r.downloadUrl ?? (DOCS_BASE_URL && r.key ? `${DOCS_BASE_URL.replace(/\/$/, '')}/${r.key}` : undefined);
      if (url) window.open(url, '_blank', 'noopener');
      else setInfo(r);
    } catch (e) {
      notify((e as Error).message, { type: 'error' });
    }
  };

  return (
    <>
      <MuiButton size="small" onClick={view}>View</MuiButton>
      <Dialog open={!!info} onClose={() => setInfo(null)}>
        <DialogTitle>{doc.type} document</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            The API returned only the storage key (no presigned view URL). Set VITE_DOCS_BASE_URL to open files directly.
          </Alert>
          <Typography variant="body2" sx={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{info?.key}</Typography>
        </DialogContent>
        <DialogActions><MuiButton onClick={() => setInfo(null)}>Close</MuiButton></DialogActions>
      </Dialog>
    </>
  );
}

function KycReview({ docs, partnerId, kycStatus }: { docs: Doc[]; partnerId: string; kycStatus: string }) {
  const { run, busy } = useAction();
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6">KYC review</Typography>
          <StatusChip value={kycStatus} />
        </Stack>
        {docs.length === 0 && <Typography color="text.secondary">No documents uploaded.</Typography>}
        {docs.map((d) => (
          <Stack key={d.id} direction="row" alignItems="center" spacing={1} py={0.75} borderBottom="1px solid" borderColor="divider">
            <Typography sx={{ width: 110, fontWeight: 600 }}>{d.type}</Typography>
            <Chip size="small" label={d.verified ? 'Verified' : 'Unverified'} color={d.verified ? 'success' : 'default'} />
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>{fmtDate(d.createdAt)}</Typography>
            <DocViewer doc={d} />
            <MuiButton size="small" color="success" disabled={busy || d.verified} onClick={() => run(() => api(`admin/partners/documents/${d.id}/approve`, { method: 'POST' }), 'Document approved')}>
              Approve
            </MuiButton>
            <PromptButton
              label="Reject"
              title="Reject document (the partner must re-upload it)"
              fieldLabel="Reason"
              color="error"
              multiline
              onSubmit={(reason) => run(() => api(`admin/partners/documents/${d.id}/reject`, { method: 'POST', body: { reason } }), 'Document rejected')}
            />
          </Stack>
        ))}
        <Stack direction="row" spacing={1} mt={2}>
          <MuiButton
            variant="contained"
            color="success"
            disabled={busy || kycStatus === 'APPROVED'}
            onClick={() => run(() => api(`admin/partners/${partnerId}/kyc/approve`, { method: 'POST' }), 'KYC approved')}
          >
            Approve KYC
          </MuiButton>
          <PromptButton
            label="Reject KYC"
            title="Reject KYC"
            fieldLabel="Reason (max 500 chars)"
            color="error"
            multiline
            disabled={kycStatus === 'REJECTED'}
            onSubmit={(reason) => run(() => api(`admin/partners/${partnerId}/kyc/reject`, { method: 'POST', body: { reason: reason.slice(0, 500) } }), 'KYC rejected')}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}

function Commission({ id, value }: { id: string; value: number | null }) {
  const [v, setV] = useState(value === null || value === undefined ? '' : String(value));
  const { run, busy } = useAction();
  const save = (pct: number | null) => run(() => api(`admin/partners/${id}/commission`, { method: 'PATCH', body: { commissionPct: pct } }), 'Commission updated');
  const num = Number(v);
  const invalid = v !== '' && (Number.isNaN(num) || num < 0 || num > 100);
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Commission override</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <MuiTextField size="small" label="Commission % (0-100)" value={v} onChange={(e) => setV(e.target.value)} error={invalid} sx={{ width: 220 }} />
          <MuiButton variant="contained" disabled={busy || invalid || v === ''} onClick={() => save(num)}>Save</MuiButton>
          <MuiButton disabled={busy} onClick={() => { setV(''); save(null); }}>Clear override</MuiButton>
        </Stack>
        <Typography variant="caption" color="text.secondary">Empty = platform default commission.</Typography>
      </CardContent>
    </Card>
  );
}

function PartnerBody() {
  const r = useRecordContext<Record<string, any>>();
  if (!r) return null;
  const e = r.earningsSummary ?? {};
  const stat = (label: string, val: string) => (
    <Grid size={{ xs: 6, md: 3 }} key={label}>
      <Card variant="outlined"><CardContent><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h6">{val}</Typography></CardContent></Card>
    </Grid>
  );
  return (
    <Box p={2}>
      <Typography variant="h5">{r.user?.name}</Typography>
      <Typography color="text.secondary" mb={2}>{r.user?.email} {r.user?.phone}</Typography>
      <Grid container spacing={2} mb={2}>
        {stat('Gross earnings', inr(e.gross))}
        {stat('Commission', inr(e.commission))}
        {stat('Net earnings', inr(e.net))}
        {stat('Pending payouts', inr(e.pendingPayouts))}
      </Grid>
      <Grid container spacing={2} mb={2}>
        {stat('Rating', `${(r.ratingAvg ?? 0).toFixed(2)} (${r.ratingCount ?? 0})`)}
        {stat('Completed jobs', String(r.completedJobs ?? 0))}
        {stat('Acceptance rate', `${Math.round((r.acceptanceRate ?? 0) * 100)}%`)}
        {stat('Status', r.isOnline ? 'Online' : 'Offline')}
      </Grid>
      <KycReview docs={r.documents ?? []} partnerId={r.id} kycStatus={r.kycStatus} />
      <Commission id={r.id} value={r.commissionPct ?? null} />
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Services</Typography>
          {(r.services ?? []).length === 0 && <Typography color="text.secondary">None</Typography>}
          <Stack direction="row" gap={1} flexWrap="wrap">
            {(r.services ?? []).map((s: any) => <Chip key={s.serviceId} label={t(s.service?.name)} size="small" />)}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export const PartnerShow = () => (
  <Show actions={false}>
    <PartnerBody />
  </Show>
);

// keep hooks referenced for tree-shaking friendliness
void useRefresh;
void TextField;
