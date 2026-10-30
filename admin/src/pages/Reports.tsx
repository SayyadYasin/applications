import { useState } from 'react';
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { Title, useNotify } from 'react-admin';
import { downloadFile } from '../api';

const REPORTS = [
  { file: 'bookings.csv', label: 'Bookings' },
  { file: 'payments.csv', label: 'Payments' },
  { file: 'earnings.csv', label: 'Partner earnings' },
  { file: 'payouts.csv', label: 'Payouts' },
  { file: 'gst-summary.csv', label: 'GST summary' },
];

const toIso = (d: string, end = false) => (d ? new Date(`${d}T${end ? '23:59:59.999' : '00:00:00'}`).toISOString() : undefined);

export const Reports = () => {
  const notify = useNotify();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const download = async (file: string) => {
    setBusy(file);
    try {
      await downloadFile(`admin/reports/${file}`, { from: toIso(from), to: toIso(to, true) }, `${file.replace('.csv', '')}-${from || 'all'}_${to || 'now'}.csv`);
    } catch (e) {
      notify((e as Error).message || 'Download failed', { type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box p={2}>
      <Title title="Reports" />
      <Typography variant="h5" gutterBottom>CSV reports</Typography>
      <Card sx={{ maxWidth: 720 }}>
        <CardContent>
          <Stack direction="row" spacing={2} mb={3}>
            <TextField type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Stack>
          <Stack direction="row" gap={1} flexWrap="wrap">
            {REPORTS.map((r) => (
              <Button key={r.file} variant="outlined" disabled={busy !== null} onClick={() => download(r.file)}>
                {busy === r.file ? 'Downloading...' : r.label}
              </Button>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" mt={2}>
            Leave dates empty to use the server defaults.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};
