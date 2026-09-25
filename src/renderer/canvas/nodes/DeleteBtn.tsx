import type { JSX } from 'react';
import { useFrigg } from '../../store.js';

/** Botão ✕ para remover o nó (além da tecla Delete e do painel lateral). */
export function DeleteBtn({ id }: { id: string }): JSX.Element {
  const remove = useFrigg((s) => s.removeNode);
  return (
    <button
      className="btn mini nodrag node-x"
      title="Remover nó (ou tecla Delete)"
      aria-label="Remover nó"
      onClick={(e) => { e.stopPropagation(); remove(id); }}
    >
      ✕
    </button>
  );
}
