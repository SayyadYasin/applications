import {
  ArrayField,
  BooleanField,
  BooleanInput,
  ChipField,
  Create,
  Datagrid,
  Edit,
  List,
  NumberField,
  NumberInput,
  ReferenceField,
  ReferenceInput,
  AutocompleteInput,
  SelectArrayInput,
  SelectInput,
  SimpleForm,
  SingleFieldList,
  TextField,
  TextInput,
  FunctionField,
  required,
  minValue,
  maxValue,
  DateField,
  DateTimeInput,
  Toolbar,
  SaveButton,
} from 'react-admin';
import { I18nField, I18nInput, JsonInput, Money, StatusField, t } from '../components/common';

const nameOpt = (r: Record<string, any>) => t(r.name) || r.id;

// ---------------- categories ----------------
export const CategoryList = () => (
  <List perPage={50} pagination={false} exporter={false}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="slug" />
      <I18nField source="name" />
      <NumberField source="sortOrder" />
      <BooleanField source="active" />
      <ArrayField source="subCategories" label="Sub-categories" sortable={false}>
        <SingleFieldList linkType={false}>
          <FunctionField render={(r: any) => <span style={{ marginRight: 6 }}>{t(r.name)}</span>} />
        </SingleFieldList>
      </ArrayField>
    </Datagrid>
  </List>
);

const CategoryForm = () => (
  <SimpleForm defaultValues={{ active: true, sortOrder: 0 }}>
    <TextInput source="slug" validate={required()} />
    <I18nInput source="name" />
    <TextInput source="iconUrl" fullWidth />
    <NumberInput source="sortOrder" step={1} />
    <BooleanInput source="active" />
  </SimpleForm>
);
export const CategoryEdit = () => <Edit mutationMode="pessimistic"><CategoryForm /></Edit>;
export const CategoryCreate = () => <Create redirect="list"><CategoryForm /></Create>;

// ---------------- sub-categories ----------------
const subFilters = [
  <ReferenceInput key="c" source="categoryId" reference="categories" alwaysOn>
    <SelectInput optionText={nameOpt} label="Category" />
  </ReferenceInput>,
];
export const SubCategoryList = () => (
  <List filters={subFilters} perPage={50} pagination={false} exporter={false}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="slug" />
      <I18nField source="name" />
      <ReferenceField source="categoryId" reference="categories" link={false}>
        <FunctionField render={(r: any) => t(r.name)} />
      </ReferenceField>
    </Datagrid>
  </List>
);
const SubCategoryForm = () => (
  <SimpleForm>
    <ReferenceInput source="categoryId" reference="categories">
      <SelectInput optionText={nameOpt} validate={required()} label="Category" />
    </ReferenceInput>
    <TextInput source="slug" validate={required()} />
    <I18nInput source="name" />
  </SimpleForm>
);
export const SubCategoryEdit = () => <Edit mutationMode="pessimistic"><SubCategoryForm /></Edit>;
export const SubCategoryCreate = () => <Create redirect="list"><SubCategoryForm /></Create>;

// ---------------- services ----------------
const serviceFilters = [
  <ReferenceInput key="s" source="subCategoryId" reference="sub-categories" alwaysOn>
    <SelectInput optionText={nameOpt} label="Sub-category" />
  </ReferenceInput>,
  <TextInput key="q" source="q" label="Search" alwaysOn />,
];
export const ServiceList = () => (
  <List filters={serviceFilters} perPage={25}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <I18nField source="name" />
      <ReferenceField source="subCategoryId" reference="sub-categories" link={false} label="Sub-category" sortable={false}>
        <FunctionField render={(r: any) => t(r.name)} />
      </ReferenceField>
      <Money source="basePrice" />
      <NumberField source="durationMin" label="Duration (min)" />
      <NumberField source="gstPct" label="GST %" />
      <BooleanField source="active" />
    </Datagrid>
  </List>
);
const ServiceForm = () => (
  <SimpleForm defaultValues={{ active: true, durationMin: 60, gstPct: 18, hsnCode: '9954' }}>
    <ReferenceInput source="subCategoryId" reference="sub-categories">
      <SelectInput optionText={nameOpt} validate={required()} label="Sub-category" />
    </ReferenceInput>
    <ReferenceInput source="townId" reference="towns">
      <AutocompleteInput optionText="name" label="Town (optional)" />
    </ReferenceInput>
    <I18nInput source="name" />
    <I18nInput source="description" multiline requiredEn={false} />
    <NumberInput source="basePrice" validate={[required(), minValue(0)]} />
    <NumberInput source="durationMin" step={5} validate={minValue(15)} />
    <NumberInput source="gstPct" label="GST %" validate={[minValue(0), maxValue(100)]} />
    <TextInput source="hsnCode" />
    <BooleanInput source="active" />
  </SimpleForm>
);
export const ServiceEdit = () => <Edit mutationMode="pessimistic"><ServiceForm /></Edit>;
export const ServiceCreate = () => <Create redirect="list"><ServiceForm /></Create>;

// ---------------- towns ----------------
export const TownList = () => (
  <List perPage={50} pagination={false} exporter={false}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="name" />
      <TextField source="state" />
      <NumberField source="lat" />
      <NumberField source="lng" />
      <BooleanField source="active" />
    </Datagrid>
  </List>
);
const TownForm = () => (
  <SimpleForm defaultValues={{ active: true }}>
    <TextInput source="name" validate={required()} />
    <TextInput source="state" validate={required()} />
    <NumberInput source="lat" validate={required()} />
    <NumberInput source="lng" validate={required()} />
    <BooleanInput source="active" />
  </SimpleForm>
);
export const TownEdit = () => <Edit mutationMode="pessimistic"><TownForm /></Edit>;
export const TownCreate = () => <Create redirect="list"><TownForm /></Create>;

// ---------------- pricing rules ----------------
const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, id) => ({ id, name }));
export const PricingList = () => (
  <List perPage={50} pagination={false} exporter={false}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="name" />
      <NumberField source="startHour" />
      <NumberField source="endHour" />
      <FunctionField label="Weekdays" render={(r: any) => (r.weekdays?.length ? r.weekdays.map((d: number) => days[d]?.name).join(', ') : 'Every day')} />
      <NumberField source="multiplier" options={{ maximumFractionDigits: 2 }} />
      <BooleanField source="active" />
    </Datagrid>
  </List>
);
const PricingForm = () => (
  <SimpleForm defaultValues={{ active: true, multiplier: 1, weekdays: [] }}>
    <TextInput source="name" validate={required()} />
    <NumberInput source="startHour" step={1} validate={[minValue(0), maxValue(23)]} helperText="0-23" />
    <NumberInput source="endHour" step={1} validate={[minValue(1), maxValue(24)]} helperText="1-24" />
    <SelectArrayInput source="weekdays" choices={days} helperText="Empty = every day" />
    <NumberInput source="multiplier" step={0.05} validate={[required(), minValue(0.5), maxValue(5)]} />
    <BooleanInput source="active" />
  </SimpleForm>
);
export const PricingEdit = () => <Edit mutationMode="pessimistic"><PricingForm /></Edit>;
export const PricingCreate = () => <Create redirect="list"><PricingForm /></Create>;

// ---------------- banners ----------------
export const BannerList = () => (
  <List perPage={50} pagination={false} exporter={false}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="title" />
      <FunctionField label="Image" render={(r: any) => <img src={r.imageUrl} alt="" style={{ height: 36 }} />} />
      <TextField source="link" />
      <ReferenceField source="townId" reference="towns" link={false} emptyText="All towns" sortable={false}>
        <TextField source="name" />
      </ReferenceField>
      <NumberField source="sortOrder" />
      <BooleanField source="active" />
    </Datagrid>
  </List>
);
const BannerForm = () => (
  <SimpleForm defaultValues={{ active: true, sortOrder: 0 }}>
    <TextInput source="title" validate={required()} fullWidth />
    <TextInput source="imageUrl" validate={required()} fullWidth />
    <TextInput source="link" fullWidth />
    <ReferenceInput source="townId" reference="towns">
      <AutocompleteInput optionText="name" label="Town (empty = all)" />
    </ReferenceInput>
    <NumberInput source="sortOrder" step={1} />
    <BooleanInput source="active" />
  </SimpleForm>
);
export const BannerEdit = () => <Edit mutationMode="pessimistic"><BannerForm /></Edit>;
export const BannerCreate = () => <Create redirect="list"><BannerForm /></Create>;

// ---------------- content pages ----------------
export const ContentList = () => (
  <List perPage={50} pagination={false} exporter={false}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="slug" />
      <I18nField source="title" />
    </Datagrid>
  </List>
);
const ContentForm = () => (
  <SimpleForm>
    <TextInput source="slug" validate={required()} />
    <I18nInput source="title" />
    <I18nInput source="body" multiline />
  </SimpleForm>
);
export const ContentEdit = () => <Edit mutationMode="pessimistic"><ContentForm /></Edit>;
export const ContentCreate = () => <Create redirect="list"><ContentForm /></Create>;

// ---------------- membership plans ----------------
export const MembershipList = () => (
  <List perPage={50} pagination={false} exporter={false}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="name" />
      <Money source="price" />
      <NumberField source="durationDays" label="Duration (days)" />
      <NumberField source="discountPct" label="Discount %" />
      <BooleanField source="freeSurge" />
    </Datagrid>
  </List>
);
const MembershipForm = () => (
  <SimpleForm defaultValues={{ discountPct: 0, freeSurge: false }}>
    <TextInput source="name" validate={required()} />
    <NumberInput source="price" validate={[required(), minValue(1)]} />
    <NumberInput source="durationDays" step={1} validate={[required(), minValue(1), maxValue(3650)]} />
    <NumberInput source="discountPct" validate={[minValue(0), maxValue(100)]} />
    <BooleanInput source="freeSurge" />
  </SimpleForm>
);
export const MembershipEdit = () => <Edit mutationMode="pessimistic"><MembershipForm /></Edit>;
export const MembershipCreate = () => <Create redirect="list"><MembershipForm /></Create>;

// ---------------- coupons ----------------
export const CouponList = () => (
  <List perPage={25} exporter={false}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="code" sortable={false} />
      <StatusField source="type" />
      <NumberField source="value" sortable={false} />
      <NumberField source="usedCount" label="Used" sortable={false} />
      <NumberField source="usageLimit" sortable={false} />
      <DateField source="validFrom" showTime sortable={false} />
      <DateField source="validTo" showTime sortable={false} />
      <BooleanField source="active" sortable={false} />
    </Datagrid>
  </List>
);
const toLocalInput = (v: string | Date) => v;
const CouponFields = ({ creating }: { creating: boolean }) => (
  <>
    <TextInput source="code" validate={required()} disabled={!creating} helperText="3-32 chars: A-Z 0-9 _ -" />
    <SelectInput source="type" choices={['PERCENT', 'FLAT'].map((id) => ({ id, name: id }))} validate={required()} />
    <NumberInput source="value" validate={[required(), minValue(0.01)]} />
    <NumberInput source="maxDiscount" validate={minValue(0)} />
    <NumberInput source="minOrder" validate={minValue(0)} />
    <NumberInput source="usageLimit" step={1} validate={minValue(1)} />
    <NumberInput source="perUserLimit" step={1} validate={[minValue(1), maxValue(1000)]} />
    <DateTimeInput source="validFrom" validate={required()} parse={toLocalInput} />
    <DateTimeInput source="validTo" validate={required()} parse={toLocalInput} />
    <BooleanInput source="active" />
  </>
);
export const CouponEdit = () => (
  <Edit mutationMode="pessimistic">
    <SimpleForm><CouponFields creating={false} /></SimpleForm>
  </Edit>
);
export const CouponCreate = () => (
  <Create redirect="list">
    <SimpleForm defaultValues={{ active: true, perUserLimit: 1, type: 'PERCENT' }}><CouponFields creating /></SimpleForm>
  </Create>
);

// ---------------- settings ----------------
export const SettingList = () => (
  <List perPage={100} pagination={false} exporter={false}>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <TextField source="key" />
      <FunctionField label="Value" render={(r: any) => <code>{JSON.stringify(r.value)}</code>} />
    </Datagrid>
  </List>
);
export const SettingEdit = ({ canWrite }: { canWrite: boolean }) => (
  <Edit mutationMode="pessimistic" actions={false}>
    <SimpleForm toolbar={canWrite ? <Toolbar><SaveButton /></Toolbar> : <></>}>
      <TextInput source="key" disabled />
      {canWrite ? <JsonInput source="value" /> : <FunctionField render={(r: any) => <pre>{JSON.stringify(r.value, null, 2)}</pre>} />}
    </SimpleForm>
  </Edit>
);
export const SettingCreate = () => (
  <Create redirect="list">
    <SimpleForm>
      <TextInput source="key" validate={required()} />
      <JsonInput source="value" />
    </SimpleForm>
  </Create>
);

void ChipField;
