// client/src/components/forms/RaiseOfferModal.js
//
// Raise an offer against an application, from the applications list or from
// one application's page. The CTC is read the way the job form reads pay
// ("8 LPA", "8,00,000", "800000"), and the signed letter can go up in the same
// step instead of being a second trip to the Offers page.
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import { Button, Checkbox, Input, Modal } from '../ui';
import { describeRupees, parseRupees } from './salary';

const MAX_LETTER_BYTES = 10 * 1024 * 1024;

/**
 * @param application the application the offer is for (needs id, student, job), or null when closed
 * @param onClose     called on cancel and after a successful raise
 * @param onRaised    called with the new offer after it is saved
 */
const RaiseOfferModal = ({ application, onClose, onRaised }) => {
  const [ctc, setCtc] = useState('');
  const [isPPO, setIsPPO] = useState(false);
  const [letter, setLetter] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  // A fresh form for every application the dialog opens for.
  useEffect(() => {
    if (application) {
      setCtc('');
      setIsPPO(false);
      setLetter(null);
      setError(null);
    }
  }, [application]);

  const pickLetter = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Attach the offer letter as a PDF.');
      return;
    }
    if (file.size > MAX_LETTER_BYTES) {
      toast.error('That PDF is over 10 MB. Export a smaller file and try again.');
      return;
    }
    setLetter(file);
  };

  const submit = async () => {
    const parsed = parseRupees(ctc, { annual: true });
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/offers', {
        applicationId: application.id,
        ctc: parsed.value,
        isPPO
      });
      const offer = res.offer;
      if (letter && offer?.id) {
        const body = new FormData();
        body.append('document', letter);
        try {
          await api.post(`/offers/${offer.id}/letter`, body, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          toast.success('Offer raised and letter attached');
        } catch {
          // The offer stands; the interceptor has toasted why the upload failed.
          toast('Offer raised. Attach the letter again from the Offers page.', { duration: 6000 });
        }
      } else {
        toast.success('Offer raised. You can attach the letter from the Offers page.');
      }
      onRaised?.(offer);
      onClose();
    } catch {
      // The API client has already shown the server's reason.
    } finally {
      setBusy(false);
    }
  };

  const name = application
    ? [application.student?.firstName, application.student?.lastName].filter(Boolean).join(' ')
    : '';

  return (
    <Modal
      open={Boolean(application)}
      onClose={onClose}
      size="sm"
      title="Raise an offer"
      description={application ? `For ${name || 'this student'}, against ${application.job?.title || 'this job'}.` : ''}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="saffron" loading={busy} onClick={submit}>
            Raise offer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Annual CTC"
          inputMode="decimal"
          autoComplete="off"
          value={ctc}
          error={error}
          onChange={(e) => {
            setCtc(e.target.value);
            setError(null);
          }}
          placeholder="e.g. 8 LPA or 8,00,000"
          help={
            describeRupees(ctc, { annual: true }) ||
            'Optional. Some offers arrive before the number does; without it the offer is recorded but stays out of salary statistics.'
          }
        />
        <Checkbox label="Pre-placement offer (PPO)" checked={isPPO} onChange={(e) => setIsPPO(e.target.checked)} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-800">Offer letter (PDF)</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Offer letter PDF"
            onChange={(e) => {
              pickLetter(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" icon={DocumentArrowUpIcon} onClick={() => fileRef.current?.click()}>
              {letter ? 'Choose another PDF' : 'Attach letter'}
            </Button>
            {letter && (
              <>
                <span className="min-w-0 truncate text-sm text-ink-700">{letter.name}</span>
                <Button size="sm" variant="ghost" onClick={() => setLetter(null)}>
                  Remove
                </Button>
              </>
            )}
          </div>
          <p className="mt-1.5 text-xs text-ink-500">
            Optional. The placement cell checks the letter before it counts in their records.
          </p>
        </div>
        <p className="text-sm text-ink-600">
          The student is notified immediately and the application is marked selected.
        </p>
      </div>
    </Modal>
  );
};

export default RaiseOfferModal;
