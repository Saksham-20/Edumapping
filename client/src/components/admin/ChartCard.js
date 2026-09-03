// client/src/components/admin/ChartCard.js
import React from 'react';
import { Card, CardHeader, Divider } from '../ui';

/** A titled panel for a chart or a small list. Thin wrapper over the kit Card. */
const ChartCard = ({ title, description, children, actions, className = '' }) => (
  <Card className={className}>
    <CardHeader title={title} description={description} actions={actions} />
    <Divider className="my-4" />
    {children}
  </Card>
);

export default ChartCard;
