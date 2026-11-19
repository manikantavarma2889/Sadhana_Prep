import { useId, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react';

const strengths = ['Weak', 'Fair', 'Good', 'Strong'] as const;

function passwordStrength(value: string) {
  if (!value) return 0;
  if (value.length < 12) return 1;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter(pattern => pattern.test(value)).length;
  if (value.length >= 20 || (value.length >= 16 && variety >= 3)) return 4;
  return value.length >= 16 || variety >= 3 ? 3 : 2;
}

type PasswordInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'type' | 'onInput'> & {
  label?: string;
  showStrength?: boolean;
};

export function PasswordInput({ label = 'Password', showStrength = false, disabled, ...props }: PasswordInputProps) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<{ start: number; end: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const [strength, setStrength] = useState(0);

  useLayoutEffect(() => {
    const element = input.current;
    if (element && document.activeElement === element && caret.current) {
      element.setSelectionRange(caret.current.start, caret.current.end);
    }
    caret.current = null;
  }, [visible]);

  function toggleVisibility() {
    const element = input.current;
    if (element && element.selectionStart !== null && element.selectionEnd !== null) {
      caret.current = { start: element.selectionStart, end: element.selectionEnd };
    }
    setVisible(current => !current);
  }

  return <div className="password-input" data-visible={visible}>
    <label htmlFor={id}>{label}</label>
    <div className="password-field">
      <input {...props} ref={input} id={id} type={visible ? 'text' : 'password'} disabled={disabled}
        autoCapitalize="none" autoCorrect="off" spellCheck={false} data-slot="password-input-control"
        onInput={showStrength ? event => setStrength(passwordStrength(event.currentTarget.value)) : undefined} />
      <button type="button" className="password-toggle" aria-controls={id} aria-label={(visible ? 'Hide ' : 'Show ') + label.toLowerCase()}
        disabled={disabled}
        onPointerDown={event => { if (document.activeElement === input.current) event.preventDefault(); }}
        onClick={toggleVisibility}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <g className="password-eye-open">
            <path d="M2 12C4 8 7.5 5.5 12 5.5S20 8 22 12c-2 4-5.5 6.5-10 6.5S4 16 2 12Z" />
            <circle cx="12" cy="12" r="2.8" />
          </g>
          <g className="password-eye-closed">
            <path d="M2 12c3 3.3 6.3 5 10 5s7-1.7 10-5M5 14.6l-2 2M9 16.6l-.5 2.4m6-2.4.5 2.4m4-4.4 2 2" />
          </g>
        </svg>
      </button>
    </div>
    {showStrength && <div className="password-strength" data-level={strength} data-active={strength > 0} aria-hidden={!strength}>
      <div className="password-strength-content">
        <div className="password-strength-bars" aria-hidden="true">
          {strengths.map((label, index) => <span key={label} data-filled={index < strength} />)}
        </div>
        <div className="password-strength-caption">
          <span>Password strength</span><span role="status">{strengths[strength - 1] ?? ''}</span>
        </div>
      </div>
    </div>}
  </div>;
}

