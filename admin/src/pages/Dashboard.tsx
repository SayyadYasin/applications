import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  MenuItem,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Title } from 'react-admin';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api';
import { inr, t } from '../components/common';

const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#db2777', '#7c3aed', '#0891b2', '#ea580c', '#64748b'];

function useApi<T>(path: string, query: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(query);
  useEffect(() => {
    let live = true;
    setError(null);
    api<T>(path, { query: JSON.parse(key) })
      .then((d) => live && setData(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [path, key]);
  return { data, error, loading: !data && !error };
}

interface Window {
  bookings: number;
  gmv: number;
  revenue: number;
  newUsers: number;
  activePartners: number;
  refunds: { count: number; amount: number };
}
interface Kpis {
  today: Window;
  last7d: Window;
  last30d: Window;
  pendingKyc: number;
  openTickets: number;
  onlinePartners: number;
}

const Kpi = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" fontWeight={600}>{value}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </CardContent>
  </Card>
);

const Panel = ({ title, children, error, loading }: { title: string; children: React.ReactNode; error?: string | null; loading?: boolean }) => (
  <Card variant="outlined" sx={{ height: '100%' }}>
    <CardContent>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>{title}</Typography>
      {loading ? <CircularProgress size={24} /> : error ? <Alert severity="error">{error}</Alert> : children}
    </CardContent>
  </Card>
);

const fmtBucket = (b: string, g: string) => {
  const d = new Date(b);
  return g === 'month' ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

export const Dashboard = () => {
  const [win, setWin] = useState<'today' | 'last7d' | 'last30d'>('last7d');
  const [days, setDays] = useState(30);
  const [gran, setGran] = useState<'day' | 'week' | 'month'>('day');
  const range = (() => {
    const to = new Date();
    return { from: new Date(to.getTime() - days * 86_400_000).toISOString(), to: to.toISOString() };
  })();
  // stabilise the range so effects do not refire on every render
  const [stable, setStable] = useState(range);
  useEffect(() => setStable(range), [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useApi<Kpis>('admin/dashboard', {});
  const revenue = useApi<{ bucket: string; bookings: number; gmv: number; revenue: number }[]>('admin/analytics/revenue', { ...stable, granularity: gran });
  const byStatus = useApi<{ status: string; count: number }[]>('admin/analytics/bookings-by-status', stable);
  const services = useApi<{ serviceId: string; name: any; bookings: number; gmv: number }[]>('admin/analytics/top-services', { ...stable, limit: 8 });
  const partners = useApi<{ partnerId: string; name: string | null; rating: number | null; jobs: number; gmv: number }[]>('admin/analytics/top-partners', { ...stable, limit: 8 });
  const cats = useApi<{ categoryId: string; name: any; bookings: number; gmv: number }[]>('admin/analytics/category-mix', stable);
  const towns = useApi<{ townId: string; town: string; bookings: number; completed: number; cancelled: number; gmv: number }[]>('admin/analytics/towns', stable);
  const cancel = useApi<{ total: number; cancelled: number; rate: number }>('admin/analytics/cancellation-rate', stable);
  const repeat = useApi<{ customers: number; repeatCustomers: number; rate: number }>('admin/analytics/repeat-customers', stable);

  const w = kpi.data?.[win];

  return (
    <Box p={2}>
      <Title title="Dashboard" />
      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={1}>
        <Typography variant="h5">Overview</Typography>
        <Tabs value={win} onChange={(_, v) => setWin(v)}>
          <Tab value="today" label="Today" />
          <Tab value="last7d" label="7 days" />
          <Tab value="last30d" label="30 days" />
        </Tabs>
      </Box>
      {kpi.error && <Alert severity="error">{kpi.error}</Alert>}
      {kpi.loading && <CircularProgress />}
      {w && kpi.data && (
        <Grid container spacing={2} mb={3}>
          <Grid size={{ xs: 6, md: 3 }}><Kpi label="Bookings" value={String(w.bookings)} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Kpi label="GMV" value={inr(w.gmv)} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Kpi label="Revenue (commission)" value={inr(w.revenue)} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Kpi label="New users" value={String(w.newUsers)} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Kpi label="Active partners" value={String(w.activePartners)} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Kpi label="Refunds" value={inr(w.refunds.amount)} sub={`${w.refunds.count} refunds`} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Kpi label="Pending KYC" value={String(kpi.data.pendingKyc)} sub={`${kpi.data.onlinePartners} partners online`} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Kpi label="Open tickets" value={String(kpi.data.openTickets)} /></Grid>
        </Grid>
      )}

      <Box display="flex" alignItems="center" gap={2} mb={2} flexWrap="wrap">
        <Typography variant="h6">Analytics</Typography>
        <TextField select size="small" label="Range" value={days} onChange={(e) => setDays(Number(e.target.value))} sx={{ width: 140 }}>
          {[7, 30, 90, 180, 365].map((d) => <MenuItem key={d} value={d}>Last {d} days</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Granularity" value={gran} onChange={(e) => setGran(e.target.value as typeof gran)} sx={{ width: 140 }}>
          {['day', 'week', 'month'].map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
        </TextField>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Kpi label="Cancellation rate" value={cancel.data ? `${(cancel.data.rate * 100).toFixed(1)}%` : '-'} sub={cancel.data ? `${cancel.data.cancelled} of ${cancel.data.total}` : cancel.error ?? ''} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Kpi label="Repeat customers" value={repeat.data ? `${(repeat.data.rate * 100).toFixed(1)}%` : '-'} sub={repeat.data ? `${repeat.data.repeatCustomers} of ${repeat.data.customers}` : repeat.error ?? ''} />
        </Grid>

        <Grid size={12}>
          <Panel title="Revenue" error={revenue.error} loading={revenue.loading}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenue.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bucket" tickFormatter={(b) => fmtBucket(b, gran)} />
                <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip labelFormatter={(b) => fmtBucket(String(b), gran)} formatter={(v) => inr(Number(v))} />
                <Legend />
                <Area type="monotone" dataKey="gmv" name="GMV" stroke={PALETTE[0]} fill={PALETTE[0]} fillOpacity={0.15} />
                <Area type="monotone" dataKey="revenue" name="Commission" stroke={PALETTE[1]} fill={PALETTE[1]} fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Top services (completed bookings)" error={services.error} loading={services.loading}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(services.data ?? []).map((s) => ({ ...s, label: t(s.name) || s.serviceId }))} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={130} />
                <Tooltip />
                <Bar dataKey="bookings" name="Bookings" fill={PALETTE[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Top partners (jobs)" error={partners.error} loading={partners.loading}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(partners.data ?? []).map((p) => ({ ...p, label: p.name ?? p.partnerId }))} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={130} />
                <Tooltip />
                <Bar dataKey="jobs" name="Jobs" fill={PALETTE[4]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Category mix" error={cats.error} loading={cats.loading}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={(cats.data ?? []).map((c) => ({ ...c, label: t(c.name) }))} dataKey="bookings" nameKey="label" outerRadius={100} innerRadius={55} paddingAngle={2}>
                  {(cats.data ?? []).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Panel>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Panel title="Bookings by status" error={byStatus.error} loading={byStatus.loading}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={(byStatus.data ?? []).map((s) => ({ ...s, label: s.status.replace(/_/g, ' ') }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Bookings" fill={PALETTE[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </Grid>

        <Grid size={12}>
          <Panel title="Town performance" error={towns.error} loading={towns.loading}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Town</TableCell>
                  <TableCell align="right">Bookings</TableCell>
                  <TableCell align="right">Completed</TableCell>
                  <TableCell align="right">Cancelled</TableCell>
                  <TableCell align="right">GMV</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(towns.data ?? []).map((r) => (
                  <TableRow key={r.townId}>
                    <TableCell>{r.town}</TableCell>
                    <TableCell align="right">{r.bookings}</TableCell>
                    <TableCell align="right">{r.completed}</TableCell>
                    <TableCell align="right">{r.cancelled}</TableCell>
                    <TableCell align="right">{inr(r.gmv)}</TableCell>
                  </TableRow>
                ))}
                {(towns.data ?? []).length === 0 && <TableRow><TableCell colSpan={5}>No data</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
};
