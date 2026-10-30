import type { DataProvider } from 'react-admin';
import { api } from './api';

/**
 * Adapter between react-admin and the TownServices REST API.
 *
 * List response shapes in the backend:
 *   paged      -> { items, total, page, limit }   (page/limit query)
 *   takeskip   -> { items, total }                (take/skip query)  [support tickets]
 *   nototal    -> [ ... ]                         (page/limit query, bare array, no total) [coupons] -> pageInfo
 *   array      -> [ ... ] everything, no pagination -> filtered/sorted/paginated client-side
 */
type ListKind = 'paged' | 'takeskip' | 'nototal' | 'array';

interface Cfg {
  path: string;
  list: ListKind;
  /** direct: GET path/:id ; list: find inside the (array) list response ; none: no detail */
  one: 'direct' | 'list' | 'none';
  /** filter keys forwarded to the server for array lists; other filters are applied client-side */
  serverFilters?: string[];
  idField?: string;
  createPath?: string;
  createFields?: string[];
  updateFields?: string[];
  updateMethod?: 'PATCH' | 'PUT';
  numeric?: string[];
  dates?: string[];
  noDelete?: boolean;
}

const CFG: Record<string, Cfg> = {
  users: { path: 'admin/users', list: 'paged', one: 'direct', createPath: 'admin/users/admins', createFields: ['name', 'email', 'password', 'role'] },
  partners: { path: 'admin/partners', list: 'paged', one: 'direct' },
  bookings: { path: 'admin/bookings', list: 'paged', one: 'direct' },
  payments: { path: 'admin/payments', list: 'paged', one: 'none' },
  refunds: { path: 'admin/refunds', list: 'paged', one: 'none', createFields: ['bookingId', 'amount', 'reason'], numeric: ['amount'] },
  payouts: { path: 'admin/payouts', list: 'paged', one: 'none', numeric: ['amount'] },
  coupons: {
    path: 'admin/coupons', list: 'nototal', one: 'direct',
    createFields: ['code', 'type', 'value', 'maxDiscount', 'minOrder', 'usageLimit', 'perUserLimit', 'validFrom', 'validTo', 'active'],
    updateFields: ['type', 'value', 'maxDiscount', 'minOrder', 'usageLimit', 'perUserLimit', 'validFrom', 'validTo', 'active'],
    numeric: ['value', 'maxDiscount', 'minOrder'], dates: ['validFrom', 'validTo'],
  },
  'support-tickets': { path: 'admin/support/tickets', list: 'takeskip', one: 'direct', updateFields: ['status', 'resolution'], noDelete: true },
  categories: {
    path: 'admin/catalog/categories', list: 'array', one: 'list',
    createFields: ['slug', 'name', 'iconUrl', 'sortOrder', 'active'], updateFields: ['slug', 'name', 'iconUrl', 'sortOrder', 'active'],
  },
  'sub-categories': {
    path: 'admin/catalog/sub-categories', list: 'array', one: 'list', serverFilters: ['categoryId'],
    createFields: ['categoryId', 'slug', 'name'], updateFields: ['categoryId', 'slug', 'name'],
  },
  services: {
    path: 'admin/catalog/services', list: 'array', one: 'list', serverFilters: ['subCategoryId'],
    createFields: ['subCategoryId', 'townId', 'name', 'description', 'basePrice', 'durationMin', 'gstPct', 'hsnCode', 'active'],
    updateFields: ['subCategoryId', 'townId', 'name', 'description', 'basePrice', 'durationMin', 'gstPct', 'hsnCode', 'active'],
    numeric: ['basePrice'],
  },
  towns: {
    path: 'admin/towns', list: 'array', one: 'list',
    createFields: ['name', 'state', 'lat', 'lng', 'active'], updateFields: ['name', 'state', 'lat', 'lng', 'active'],
  },
  'pricing-rules': {
    path: 'admin/pricing-rules', list: 'array', one: 'list',
    createFields: ['name', 'startHour', 'endHour', 'weekdays', 'multiplier', 'active'],
    updateFields: ['name', 'startHour', 'endHour', 'weekdays', 'multiplier', 'active'],
  },
  banners: {
    path: 'admin/banners', list: 'array', one: 'list',
    createFields: ['title', 'imageUrl', 'link', 'townId', 'active', 'sortOrder'], updateFields: ['title', 'imageUrl', 'link', 'townId', 'active', 'sortOrder'],
  },
  content: {
    path: 'admin/content', list: 'array', one: 'list',
    createFields: ['slug', 'title', 'body'], updateFields: ['slug', 'title', 'body'],
  },
  memberships: {
    path: 'admin/memberships/plans', list: 'array', one: 'list',
    createFields: ['name', 'price', 'durationDays', 'discountPct', 'freeSurge'], updateFields: ['name', 'price', 'durationDays', 'discountPct', 'freeSurge'],
    numeric: ['price'],
  },
  settings: { path: 'admin/settings', list: 'array', one: 'direct', idField: 'key', updateMethod: 'PUT', noDelete: true },
};

const cfgOf = (resource: string): Cfg => {
  const c = CFG[resource];
  if (!c) throw new Error(`Unknown resource "${resource}"`);
  return c;
};

/** Normalises a backend record: id mapping + Prisma Decimal strings to numbers. */
function norm(c: Cfg, r: any): any {
  if (!r || typeof r !== 'object') return r;
  const out = { ...r };
  if (c.idField) out.id = r[c.idField];
  for (const k of c.numeric ?? []) if (out[k] !== null && out[k] !== undefined) out[k] = Number(out[k]);
  return out;
}

/** Picks whitelisted fields (backend uses forbidNonWhitelisted) and coerces types. */
function pick(c: Cfg, fields: string[] | undefined, data: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const k of fields ?? Object.keys(data)) {
    let v = data[k];
    if (v === undefined) continue;
    if (v === '') v = null;
    if (v !== null && c.numeric?.includes(k)) v = Number(v);
    if (v !== null && c.dates?.includes(k)) v = new Date(v).toISOString();
    out[k] = v;
  }
  return out;
}

function sortRows(rows: any[], field: string, order: string) {
  if (!field || field === 'id') return rows;
  const dir = order === 'DESC' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[field];
    const y = b[field];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (x > y ? 1 : -1) * dir;
  });
}

function matches(row: any, filter: Record<string, any>) {
  return Object.entries(filter).every(([k, v]) => {
    if (v === undefined || v === null || v === '') return true;
    if (k === 'q') return JSON.stringify(row).toLowerCase().includes(String(v).toLowerCase());
    if (k === 'id') return Array.isArray(v) ? v.includes(row.id) : row.id === v;
    const rv = row[k];
    if (Array.isArray(v)) return v.includes(rv);
    return String(rv) === String(v);
  });
}

async function listAll(resource: string, serverQuery: Record<string, any> = {}): Promise<any[]> {
  const c = cfgOf(resource);
  const q: Record<string, any> = {};
  for (const k of c.serverFilters ?? []) if (serverQuery[k]) q[k] = serverQuery[k];
  const rows = await api<any[]>(c.path, { query: q });
  return rows.map((r) => norm(c, r));
}

async function getOne(resource: string, id: string): Promise<any> {
  const c = cfgOf(resource);
  if (c.one === 'direct') return norm(c, await api(`${c.path}/${encodeURIComponent(id)}`));
  if (c.one === 'list') {
    const row = (await listAll(resource)).find((r) => String(r.id) === String(id));
    if (!row) throw new Error(`${resource} ${id} not found`);
    return row;
  }
  throw new Error(`${resource} has no detail endpoint`);
}

export const dataProvider: DataProvider = {
  async getList(resource, params) {
    const c = cfgOf(resource);
    const { page, perPage } = params.pagination ?? { page: 1, perPage: 1000 };
    const { field, order } = params.sort ?? { field: 'id', order: 'ASC' };
    const filter = (params.filter ?? {}) as Record<string, any>;

    if (c.list === 'array') {
      const all = await listAll(resource, filter);
      const rows = sortRows(all.filter((r) => matches(r, filter)), field, order);
      return { data: rows.slice((page - 1) * perPage, page * perPage), total: rows.length } as any;
    }

    const query: Record<string, any> = { ...filter };
    if (c.list === 'takeskip') {
      query.take = perPage;
      query.skip = (page - 1) * perPage;
    } else {
      query.page = page;
      query.limit = perPage;
    }
    const res = await api<any>(c.path, { query });

    if (c.list === 'nototal') {
      // Endpoint returns a bare array with no total: expose pageInfo instead of total.
      const items = (res as any[]).map((r) => norm(c, r));
      return { data: items, pageInfo: { hasNextPage: items.length === perPage, hasPreviousPage: page > 1 } } as any;
    }
    return { data: (res.items as any[]).map((r) => norm(c, r)), total: res.total ?? res.items.length };
  },

  async getOne(resource, params) {
    return { data: await getOne(resource, String(params.id)) };
  },

  async getMany(resource, params) {
    const c = cfgOf(resource);
    const ids = params.ids.map(String);
    if (c.one === 'direct') {
      const data = await Promise.all(ids.map((id) => getOne(resource, id).catch(() => null)));
      return { data: data.filter(Boolean) as any[] };
    }
    if (c.list === 'array') {
      const all = await listAll(resource);
      return { data: all.filter((r) => ids.includes(String(r.id))) };
    }
    const res = await api<any>(c.path, { query: { page: 1, limit: 100 } });
    const items = ((res.items ?? res) as any[]).map((r) => norm(c, r));
    return { data: items.filter((r) => ids.includes(String(r.id))) };
  },

  async getManyReference(resource, params) {
    return dataProvider.getList(resource, { ...params, filter: { ...params.filter, [params.target]: params.id } });
  },

  async create(resource, params) {
    const c = cfgOf(resource);
    if (resource === 'settings') {
      // Settings are upserted by key: PUT admin/settings/:key
      const key = String(params.data.key ?? '').trim();
      if (!key) throw new Error('Key is required');
      const r = await api<any>(`${c.path}/${encodeURIComponent(key)}`, { method: 'PUT', body: { value: params.data.value } });
      return { data: norm(c, r) };
    }
    const created = await api<any>(c.createPath ?? c.path, {
      method: 'POST',
      body: pick(c, c.createFields, params.data),
    });
    return { data: norm(c, { ...params.data, ...created, id: created?.id ?? params.data.id }) };
  },

  async update(resource, params) {
    const c = cfgOf(resource);
    const id = encodeURIComponent(String(params.id));
    const data = params.data as Record<string, any>;
    const prev = (params.previousData ?? {}) as Record<string, any>;

    if (resource === 'users') {
      // Two dedicated endpoints; call only the ones whose value changed.
      if (data.isActive !== prev.isActive) await api(`${c.path}/${id}/active`, { method: 'PATCH', body: { isActive: !!data.isActive } });
      if (data.role !== prev.role) await api(`${c.path}/${id}/role`, { method: 'PATCH', body: { role: data.role } });
      return { data: await getOne(resource, String(params.id)) };
    }
    if (resource === 'partners') {
      const pct = data.commissionPct === '' || data.commissionPct === undefined ? null : Number(data.commissionPct);
      await api(`${c.path}/${id}/commission`, { method: 'PATCH', body: { commissionPct: pct } });
      return { data: await getOne(resource, String(params.id)) };
    }
    if (resource === 'settings') {
      const r = await api<any>(`${c.path}/${id}`, { method: 'PUT', body: { value: data.value } });
      return { data: norm(c, r) };
    }
    const r = await api<any>(`${c.path}/${id}`, { method: c.updateMethod ?? 'PATCH', body: pick(c, c.updateFields, data) });
    return { data: norm(c, { ...prev, ...r }) };
  },

  async updateMany(resource, params) {
    await Promise.all(params.ids.map((id) => dataProvider.update(resource, { id, data: params.data, previousData: { id } })));
    return { data: params.ids };
  },

  async delete(resource, params) {
    const c = cfgOf(resource);
    if (c.noDelete) throw new Error(`${resource} cannot be deleted`);
    await api(`${c.path}/${encodeURIComponent(String(params.id))}`, { method: 'DELETE' });
    return { data: (params.previousData ?? { id: params.id }) as any };
  },

  async deleteMany(resource, params) {
    await Promise.all(params.ids.map((id) => dataProvider.delete(resource, { id })));
    return { data: params.ids };
  },
};
