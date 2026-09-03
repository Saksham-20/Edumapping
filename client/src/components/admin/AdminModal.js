// client/src/components/admin/AdminModal.js
import React from 'react';
import { Modal } from '../ui';

/**
 * Adapter onto the design system's `Modal`, which traps Tab inside the panel,
 * closes on Escape and restores focus to the opener — none of which the
 * hand-rolled overlay this replaced did.
 *
 * Kept as its own component only so the dashboard's `isOpen`/`title` call sites
 * do not all have to change at once.
 */
const AdminModal = ({ isOpen, onClose, title, description, footer, children, size = 'lg' }) => (
  <Modal open={isOpen} onClose={onClose} title={title} description={description} footer={footer} size={size}>
    {children}
  </Modal>
);

export default AdminModal;
