import { Button as MuiButton, Stack } from '@mui/material';
import {
  Create,
  Datagrid,
  DateField,
  DateInput,
  FunctionField,
  List,
  NumberInput,
  SelectInput,
  SimpleForm,
  TextField,
  TextInput,
  required,
  minValue,
  minLength,
  useRecordContext,
} from 'react-admin';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { PromptButton, useAction } from '../components/actions';
import { StatusField, inr } from '../components/common';

// ---------------- payments ----------------
const payFilters = [
  <SelectInput key="s" source="status" alwaysOn choices={['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'].map((id) => ({ id, name: id }))} />,
  <SelectInput key="m" source="method" alwaysOn choices={['ONLINE', 'UPI', 'CASH', 'WALLET'].map((id) => ({ id, name: id }))} />,
  <TextInput key="b" source="bookingId" label="Booking ID" />,
  <DateInput key="f" source="from" label="From" />,
  <DateInput key="t" source="to" label="To" />,
];

export const PaymentList = () => (
  <List filters={payFilters} perPage={20} sort={{ field: 'createdAt', order: 'DESC' }}>
    <Datagrid bulkActionButtons={false}>
      <FunctionField label="Booking" render={(r: any) => r.booking?.code} />
      <StatusField source="status" />
      <TextField source="method" sortable={false} />
      <FunctionField label="Amount" render={(r: any) => inr(r.amount)} />
      <FunctionField label="Refunded" render={(r: any) => inr(r.refundedAmount)} />
      <TextField source="razorpayPaymentId" label="Razorpay ID" sortable={false} />
      <DateField source="createdAt" showTime sortable={false} />
    </Datagrid>
  </List>
);

// ---------------- refunds ----------------
export const RefundList = () => (
  <List perPage={20} sort={{ field: 'createdAt', order: 'DESC' }}>
    <Datagrid bulkActionButtons={false}>
      <TextField source="paymentId" sortable={false} />
      <FunctionField label="Amount" render={(r: any) => inr(r.amount)} />
      <TextField source="reason" sortable={false} />
      <StatusField source="status" />
      <TextField source="razorpayRefundId" sortable={false} />
      <DateField source="createdAt" showTime sortable={false} />
    </Datagrid>
  </List>
);

export const RefundCreate = () => {
  const [sp] = useSearchParams();
  return (
    <Create redirect="list" title="Manual refund">
      <SimpleForm defaultValues={{ bookingId: sp.get('bookingId') ?? '' }}>
        <TextInput source="bookingId" label="Booking ID" validate={required()} fullWidth />
        <NumberInput source="amount" label="Amount (INR)" validate={[required(), minValue(1)]} />
        <TextInput source="reason" validate={[required(), minLength(3)]} fullWidth />
      </SimpleForm>
    </Create>
  );
};

// ---------------- payouts ----------------
function PayoutActions() {
  const p = useRecordContext<Record<string, any>>();
  const { run, busy } = useAction();
  if (!p) return null;
  return (
    <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
      <MuiButton
        size="small"
        color="success"
        disabled={busy || p.status !== 'REQUESTED'}
        onClick={() => run(() => api(`admin/payouts/${p.id}/approve`, { method: 'POST' }), 'Payout approved')}
      >
        Approve
      </MuiButton>
      <PromptButton
        label="Mark paid"
        title="Mark payout as paid"
        fieldLabel="Bank/UPI transaction reference"
        disabled={busy || p.status !== 'APPROVED'}
        onSubmit={(reference) => run(() => api(`admin/payouts/${p.id}/mark-paid`, { method: 'POST', body: { reference } }), 'Marked as paid')}
      />
      <PromptButton
        label="Reject"
        title="Reject payout"
        fieldLabel="Reason (optional)"
        color="error"
        required={false}
        disabled={busy || !(p.status === 'REQUESTED' || p.status === 'APPROVED')}
        onSubmit={(reason) => run(() => api(`admin/payouts/${p.id}/reject`, { method: 'POST', body: reason ? { reason } : {} }), 'Payout rejected')}
      />
    </Stack>
  );
}

const payoutFilters = [
  <SelectInput key="s" source="status" alwaysOn choices={['REQUESTED', 'APPROVED', 'PAID', 'REJECTED'].map((id) => ({ id, name: id }))} />,
];

export const PayoutList = () => (
  <List filters={payoutFilters} perPage={20} sort={{ field: 'createdAt', order: 'DESC' }}>
    <Datagrid bulkActionButtons={false}>
      <FunctionField label="Partner" render={(r: any) => r.partner?.user?.name} />
      <FunctionField label="Amount" render={(r: any) => inr(r.amount)} />
      <StatusField source="status" />
      <TextField source="upiId" sortable={false} />
      <TextField source="bankAccount" sortable={false} />
      <TextField source="reference" sortable={false} />
      <DateField source="createdAt" showTime sortable={false} />
      <DateField source="processedAt" showTime sortable={false} />
      <PayoutActions />
    </Datagrid>
  </List>
);
