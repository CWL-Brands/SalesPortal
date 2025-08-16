import React from 'react';
import { connect } from 'react-redux';

import { withPhone } from '@ringcentral-integration/widgets/lib/phoneContext';

import TabNavigationView from '@ringcentral-integration/widgets/components/TabNavigationView';

import DialpadIcon from '@ringcentral-integration/widgets/assets/images/Dialpad.svg';
import CallsIcon from '@ringcentral-integration/widgets/assets/images/Calls.svg';
import CallsHoverIcon from '@ringcentral-integration/widgets/assets/images/CallsHover.svg';
import SettingsIcon from '@ringcentral-integration/widgets/assets/images/Settings.svg';
import SettingsHoverIcon from '@ringcentral-integration/widgets/assets/images/SettingsHover.svg';

const TABS = [
  {
    icon: DialpadIcon,
    activeIcon: DialpadIcon,
    label: 'Dialer',
    path: '/dialer',
    isActive: (currentPath) => currentPath === '/dialer',
  },
  {
    icon: CallsIcon,
    activeIcon: CallsHoverIcon,
    label: 'Calls',
    path: '/calls',
    isActive: (currentPath) => currentPath === '/calls',
  },
  {
    icon: SettingsIcon,
    activeIcon: SettingsHoverIcon,
    label: 'Settings',
    path: '/settings',
    isActive: (currentPath) => currentPath.substr(0, 9) === '/settings',
  },
];

function mapToProps(_, { phone: { routerInteraction } }) {
  return {
    tabs: TABS,
    currentPath: routerInteraction.currentPath,
  };
}
function mapToFunctions(_, { phone: { routerInteraction } }) {
  return {
    goTo: (path) => {
      if (path) {
        routerInteraction.push(path);
      }
    },
  };
}

const MainView = withPhone(
  connect(mapToProps, mapToFunctions)(TabNavigationView),
);

export default MainView;
