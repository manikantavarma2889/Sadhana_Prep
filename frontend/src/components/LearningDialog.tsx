import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function LearningDialog({ title, close, children, className = '' }: {
  title: string; close: () => void; children: ReactNode; className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);

  return <dialog ref={dialog} className={'learning-dialog ' + className} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="learning-dialog-body">
      <div className="learning-dialog-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" aria-label="Close dialog" onClick={close}><X size={18} aria-hidden /></button>
      </div>
      {children}
    </div>
  </dialog>;
}
