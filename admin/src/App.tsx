import { Admin, CustomRoutes, Resource } from 'react-admin';
import { Route } from 'react-router-dom';
import PeopleIcon from '@mui/icons-material/People';
import HandymanIcon from '@mui/icons-material/Handyman';
import CategoryIcon from '@mui/icons-material/Category';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import MiscellaneousServicesIcon from '@mui/icons-material/MiscellaneousServices';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PaymentIcon from '@mui/icons-material/Payment';
import ReplayIcon from '@mui/icons-material/Replay';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel';
import ArticleIcon from '@mui/icons-material/Article';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import SettingsIcon from '@mui/icons-material/Settings';
import { authProvider } from './authProvider';
import { dataProvider } from './dataProvider';
import { AppLayout } from './Layout';
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';
import { NotificationCenter } from './pages/Notifications';
import { AdminCreate, UserEdit, UserList } from './resources/users';
import { PartnerList, PartnerShow } from './resources/partners';
import {
  BannerCreate, BannerEdit, BannerList, CategoryCreate, CategoryEdit, CategoryList, ContentCreate, ContentEdit, ContentList,
  CouponCreate, CouponEdit, CouponList, MembershipCreate, MembershipEdit, MembershipList, PricingCreate, PricingEdit, PricingList,
  ServiceCreate, ServiceEdit, ServiceList, SettingCreate, SettingEdit, SettingList, SubCategoryCreate, SubCategoryEdit,
  SubCategoryList, TownCreate, TownEdit, TownList,
} from './resources/catalog';
import { BookingList, BookingShow } from './resources/bookings';
import { PaymentList, PayoutList, RefundCreate, RefundList } from './resources/finance';
import { TicketList, TicketShow } from './resources/support';

export const App = () => (
  <Admin
    title="TownServices Admin"
    dataProvider={dataProvider}
    authProvider={authProvider}
    dashboard={Dashboard}
    layout={AppLayout}
    requireAuth
  >
    {(permissions: string) => {
      const isSuper = permissions === 'SUPER_ADMIN';
      return [
        <Resource key="users" name="users" options={{ label: 'Users' }} icon={PeopleIcon} list={UserList} edit={UserEdit} create={isSuper ? AdminCreate : undefined} />,
        <Resource key="partners" name="partners" options={{ label: 'Partners' }} icon={HandymanIcon} list={PartnerList} show={PartnerShow} />,
        <Resource key="categories" name="categories" options={{ label: 'Categories' }} icon={CategoryIcon} list={CategoryList} edit={CategoryEdit} create={CategoryCreate} />,
        <Resource key="sub-categories" name="sub-categories" options={{ label: 'Sub-categories' }} icon={SubdirectoryArrowRightIcon} list={SubCategoryList} edit={SubCategoryEdit} create={SubCategoryCreate} />,
        <Resource key="services" name="services" options={{ label: 'Services' }} icon={MiscellaneousServicesIcon} list={ServiceList} edit={ServiceEdit} create={ServiceCreate} />,
        <Resource key="towns" name="towns" options={{ label: 'Towns' }} icon={LocationCityIcon} list={TownList} edit={TownEdit} create={TownCreate} />,
        <Resource key="pricing-rules" name="pricing-rules" options={{ label: 'Pricing rules' }} icon={TrendingUpIcon} list={PricingList} edit={PricingEdit} create={PricingCreate} />,
        <Resource key="bookings" name="bookings" options={{ label: 'Bookings' }} icon={EventNoteIcon} list={BookingList} show={BookingShow} />,
        <Resource key="payments" name="payments" options={{ label: 'Payments' }} icon={PaymentIcon} list={PaymentList} />,
        <Resource key="refunds" name="refunds" options={{ label: 'Refunds' }} icon={ReplayIcon} list={RefundList} create={RefundCreate} />,
        <Resource key="payouts" name="payouts" options={{ label: 'Payouts' }} icon={AccountBalanceIcon} list={PayoutList} />,
        <Resource key="coupons" name="coupons" options={{ label: 'Coupons' }} icon={LocalOfferIcon} list={CouponList} edit={CouponEdit} create={CouponCreate} />,
        <Resource key="memberships" name="memberships" options={{ label: 'Membership plans' }} icon={CardMembershipIcon} list={MembershipList} edit={MembershipEdit} create={MembershipCreate} />,
        <Resource key="banners" name="banners" options={{ label: 'Banners' }} icon={ViewCarouselIcon} list={BannerList} edit={BannerEdit} create={BannerCreate} />,
        <Resource key="content" name="content" options={{ label: 'Content pages' }} icon={ArticleIcon} list={ContentList} edit={ContentEdit} create={ContentCreate} />,
        <Resource key="support-tickets" name="support-tickets" options={{ label: 'Support & disputes' }} icon={SupportAgentIcon} list={TicketList} show={TicketShow} />,
        <Resource
          key="settings"
          name="settings"
          options={{ label: 'Settings' }}
          icon={SettingsIcon}
          list={SettingList}
          edit={() => <SettingEdit canWrite={isSuper} />}
          create={isSuper ? SettingCreate : undefined}
        />,
        <CustomRoutes key="custom">
          <Route path="/reports" element={<Reports />} />
          <Route path="/notifications" element={<NotificationCenter />} />
        </CustomRoutes>,
      ];
    }}
  </Admin>
);
