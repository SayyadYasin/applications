import { Layout, Menu, type LayoutProps } from 'react-admin';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CampaignIcon from '@mui/icons-material/Campaign';

const AppMenu = () => (
  <Menu>
    <Menu.DashboardItem />
    <Menu.ResourceItems />
    <Menu.Item to="/notifications" primaryText="Notification center" leftIcon={<CampaignIcon />} />
    <Menu.Item to="/reports" primaryText="Reports" leftIcon={<AssessmentIcon />} />
  </Menu>
);

export const AppLayout = (props: LayoutProps) => <Layout {...props} menu={AppMenu} />;
