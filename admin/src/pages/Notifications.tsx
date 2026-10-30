import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Checkbox, FormControlLabel, FormGroup, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { Title, useNotify } from 'react-admin';
import { api } from '../api';
import { useAction } from '../components/actions';

const CHANNELS = ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'];
const ROLES = ['CUSTOMER', 'PARTNER', 'ADMIN', 'SUPER_ADMIN'];

export const NotificationCenter = () => {
  const notify = useNotify();
  const { run, busy } = useAction();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'ALL' | 'ROLE' | 'TOWN'>('ALL');
  const [role, setRole] = useState('CUSTOMER');
  const [townId, setTownId] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [result, setResult] = useState<unknown>(null);

  const [towns, setTowns] = useState<{ id: string; name: string }[]>([]);
  const loadTowns = async () => {
    if (towns.length) return;
    try {
      setTowns(await api('admin/towns'));
    } catch (e) {
      notify((e as Error).message, { type: 'error' });
    }
  };

  const valid = title.trim() && body.trim() && (target !== 'TOWN' || townId);

  const send = async () => {
    if (!window.confirm(`Send this notification to ${target === 'ALL' ? 'ALL users' : target === 'ROLE' ? `all ${role}s` : 'the selected town'}?`)) return;
    const payload: Record<string, unknown> = { title, body, target };
    if (target === 'ROLE') payload.role = role;
    if (target === 'TOWN') payload.townId = townId;
    if (channels.length) payload.channels = channels;
    const r = await run(() => api('admin/notifications/broadcast', { method: 'POST', body: payload }), 'Broadcast sent');
    if (r !== undefined) setResult(r);
  };

  return (
    <Box p={2}>
      <Title title="Notification center" />
      <Typography variant="h5" gutterBottom>Broadcast notification</Typography>
      <Card sx={{ maxWidth: 720 }}>
        <CardContent>
          <Stack spacing={2}>
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} inputProps={{ maxLength: 120 }} helperText={`${title.length}/120`} />
            <TextField label="Message" multiline minRows={3} value={body} onChange={(e) => setBody(e.target.value)} inputProps={{ maxLength: 1000 }} helperText={`${body.length}/1000`} />
            <TextField select label="Target" value={target} onChange={(e) => setTarget(e.target.value as typeof target)}>
              <MenuItem value="ALL">All users</MenuItem>
              <MenuItem value="ROLE">By role</MenuItem>
              <MenuItem value="TOWN">By town</MenuItem>
            </TextField>
            {target === 'ROLE' && (
              <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            )}
            {target === 'TOWN' && (
              <TextField select label="Town" value={townId} onChange={(e) => setTownId(e.target.value)} SelectProps={{ onOpen: loadTowns }}>
                {towns.map((tw) => <MenuItem key={tw.id} value={tw.id}>{tw.name}</MenuItem>)}
                {towns.length === 0 && <MenuItem disabled value="">Loading...</MenuItem>}
              </TextField>
            )}
            <Box>
              <Typography variant="subtitle2">Channels (empty = server default)</Typography>
              <FormGroup row>
                {CHANNELS.map((c) => (
                  <FormControlLabel
                    key={c}
                    label={c}
                    control={<Checkbox checked={channels.includes(c)} onChange={(e) => setChannels((cur) => (e.target.checked ? [...cur, c] : cur.filter((x) => x !== c)))} />}
                  />
                ))}
              </FormGroup>
            </Box>
            <Box><Button variant="contained" disabled={!valid || busy} onClick={send}>Send broadcast</Button></Box>
            {result !== null && <Alert severity="success"><pre style={{ margin: 0 }}>{JSON.stringify(result, null, 2)}</pre></Alert>}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};
