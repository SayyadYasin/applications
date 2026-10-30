import {
  BooleanField,
  BooleanInput,
  Create,
  CreateButton,
  DateField,
  Datagrid,
  Edit,
  EditButton,
  List,
  PasswordInput,
  SearchInput,
  SelectInput,
  SimpleForm,
  TextField,
  TextInput,
  TopToolbar,
  required,
  email,
  minLength,
} from 'react-admin';
import { StatusField, useIsSuperAdmin } from '../components/common';

const roles = ['CUSTOMER', 'PARTNER', 'ADMIN', 'SUPER_ADMIN'].map((id) => ({ id, name: id }));

const filters = [
  <SearchInput key="q" source="q" alwaysOn placeholder="Name, email or phone" />,
  <SelectInput key="role" source="role" choices={roles} />,
  <SelectInput key="isActive" source="isActive" label="Active" choices={[{ id: 'true', name: 'Active' }, { id: 'false', name: 'Inactive' }]} />,
];

const Actions = () => {
  const isSuper = useIsSuperAdmin();
  return <TopToolbar>{isSuper && <CreateButton label="Create admin" />}</TopToolbar>;
};

export const UserList = () => (
  <List filters={filters} actions={<Actions />} sort={{ field: 'createdAt', order: 'DESC' }} perPage={20}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="name" sortable={false} />
      <TextField source="email" sortable={false} />
      <TextField source="phone" sortable={false} />
      <StatusField source="role" />
      <BooleanField source="isActive" label="Active" sortable={false} />
      <DateField source="createdAt" showTime sortable={false} />
      <EditButton />
    </Datagrid>
  </List>
);

export const UserEdit = () => {
  const isSuper = useIsSuperAdmin();
  return (
    <Edit mutationMode="pessimistic">
      <SimpleForm>
        <TextInput source="name" disabled />
        <TextInput source="email" disabled />
        <TextInput source="phone" disabled />
        <BooleanInput source="isActive" label="Active (deactivate to block login)" />
        <SelectInput
          source="role"
          choices={roles}
          disabled={!isSuper}
          helperText={isSuper ? 'Changing roles is audited. You cannot change your own role.' : 'Only SUPER_ADMIN can change roles'}
        />
      </SimpleForm>
    </Edit>
  );
};

export const AdminCreate = () => {
  const isSuper = useIsSuperAdmin();
  if (!isSuper) return <p style={{ padding: 16 }}>Only SUPER_ADMIN can create admins.</p>;
  return (
    <Create redirect="list">
      <SimpleForm defaultValues={{ role: 'ADMIN' }}>
        <TextInput source="name" validate={[required(), minLength(2)]} />
        <TextInput source="email" validate={[required(), email()]} />
        <PasswordInput source="password" validate={[required(), minLength(8)]} />
        <SelectInput source="role" choices={[{ id: 'ADMIN', name: 'ADMIN' }, { id: 'SUPER_ADMIN', name: 'SUPER_ADMIN' }]} />
      </SimpleForm>
    </Create>
  );
};
