// client/src/components/admin/TabNavigation.js
import React, { useMemo } from 'react';
import { Tabs } from '../ui';

/**
 * Adapter from the admin dashboard's `{ id, label, icon, badge }` tab shape onto
 * the design system's `Tabs`, which owns the real `role="tab"` semantics and
 * arrow-key roving focus.
 */
const TabNavigation = ({ tabs, activeTab, onTabChange, className = '' }) => {
  const mapped = useMemo(
    () =>
      tabs.map((tab) => ({
        value: tab.id,
        label: tab.label,
        icon: tab.icon,
        count: tab.badge
      })),
    [tabs]
  );

  return <Tabs className={`mb-6 ${className}`} tabs={mapped} value={activeTab} onChange={onTabChange} />;
};

export default TabNavigation;
