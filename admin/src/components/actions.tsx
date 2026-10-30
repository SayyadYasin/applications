import { useState, type ReactNode } from 'react';
import {
  Button as MuiButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { Button, useNotify, useRefresh } from 'react-admin';
import { api } from '../api';

/** Runs an API call, notifies on success/failure and refreshes the current view. */
export function useAction() {
  const notify = useNotify();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const run = async <T,>(fn: () => Promise<T>, okMsg = 'Done'): Promise<T | undefined> => {
    setBusy(true);
    try {
      const r = await fn();
      notify(okMsg, { type: 'success' });
      refresh();
      return r;
    } catch (e) {
      notify((e as Error).message || 'Request failed', { type: 'error' });
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

/** Button that opens a dialog with a single text field, then calls onSubmit(value). */
export function PromptButton(props: {
  label: string;
  title: string;
  fieldLabel: string;
  icon?: ReactNode;
  color?: 'primary' | 'error' | 'success' | 'warning' | 'inherit';
  required?: boolean;
  multiline?: boolean;
  type?: string;
  disabled?: boolean;
  onSubmit: (value: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await props.onSubmit(value);
      setOpen(false);
      setValue('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button label={props.label} color={props.color ?? 'primary'} disabled={props.disabled} onClick={() => setOpen(true)}>
        {props.icon as any}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{props.title}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={props.fieldLabel}
            type={props.type}
            multiline={props.multiline}
            minRows={props.multiline ? 3 : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <MuiButton onClick={() => setOpen(false)}>Cancel</MuiButton>
          <MuiButton variant="contained" color={props.color === 'inherit' ? 'primary' : props.color} disabled={busy || (props.required !== false && !value.trim())} onClick={submit}>
            Confirm
          </MuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

export { api };
