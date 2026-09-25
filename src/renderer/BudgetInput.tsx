import { useEffect, useState, type JSX } from 'react';
import { parseBudgetInput } from '../core/agent-policy.js';

/**
 * Campo de valor em US$ que aceita "1,50" ou "1.5". Só grava valores válidos;
 * vazio remove o limite. O texto digitado é preservado enquanto o usuário edita.
 */
export function BudgetInput({ id, value, placeholder, onChange }: {
  id: string;
  value: number | undefined;
  placeholder: string;
  onChange: (usd: number | undefined) => void;
}): JSX.Element {
  const [text, setText] = useState(value === undefined ? '' : String(value).replace('.', ','));
  useEffect(() => {
    setText((current) => (parseBudgetInput(current) === value ? current : value === undefined ? '' : String(value).replace('.', ',')));
  }, [value]);
  const invalid = text.trim() !== '' && parseBudgetInput(text) === undefined;
  return (
    <>
      <input
        id={id}
        className="fld"
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseBudgetInput(e.target.value);
          if (e.target.value.trim() === '' || parsed !== undefined) onChange(parsed);
        }}
      />
      {invalid ? <div className="muted" role="alert" style={{ fontSize: 12 }}>Use um valor entre 0,01 e 1000.</div> : null}
    </>
  );
}
