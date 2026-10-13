// client/src/components/admin/AdminModal.js
import React, { useCallback, useEffect, useRef } from 'react';
import { Modal } from '../ui';

/**
 * Adapter onto the design system's `Modal`, which traps Tab inside the panel,
 * closes on Escape and restores focus to the opener — none of which the
 * hand-rolled overlay this replaced did.
 *
 * It also hands `Modal` an `onClose` that never changes identity. `Modal`'s
 * focus effect depends on `onClose`, so with the usual inline arrow every
 * keystroke in a form (which re-renders the parent) re-ran the effect: focus
 * jumped to the opener and then to the dialog's close button. Typing a name
 * left one letter in the field, and the next space "pressed" Close and threw
 * the form away.
 *
 * Accepts `open` as well as `isOpen` so plain `Modal` call sites can switch to
 * it without renaming props.
 */
const AdminModal = ({ isOpen, open, onClose, title, description, footer, children, size = 'lg' }) => {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const stableClose = useCallback(() => onCloseRef.current?.(), []);

  return (
    <Modal
      open={Boolean(isOpen ?? open)}
      onClose={stableClose}
      title={title}
      description={description}
      footer={footer}
      size={size}
    >
      {children}
    </Modal>
  );
};

export default AdminModal;
