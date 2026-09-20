import { useEffect, useRef, type PointerEvent as RPointerEvent } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useFrigg } from '../../store.js';
import { DeleteBtn } from './DeleteBtn.js';

const W = 300;
const H = 200;

/** Nó de Desenho livre (rabisco). Persiste como dataURL em data.image. */
export function DrawNode(props: NodeProps): JSX.Element {
  const nodeId = (props.data as { nodeId: string }).nodeId;
  const node = useFrigg((s) => s.nodes.find((n) => n.id === nodeId));
  const patch = useFrigg((s) => s.patchNodeData);
  const saved = typeof node?.data['image'] === 'string' ? (node.data['image'] as string) : '';
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0d1526';
    ctx.fillRect(0, 0, W, H);
    if (saved) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = saved;
    }
  }, [saved]);

  const pos = (e: RPointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const down = (e: RPointerEvent<HTMLCanvasElement>): void => {
    drawing.current = true;
    const ctx = ref.current!.getContext('2d')!;
    const p = pos(e);
    ctx.strokeStyle = '#14e0c8';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: RPointerEvent<HTMLCanvasElement>): void => {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext('2d')!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const up = (): void => {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      patch(nodeId, { image: ref.current!.toDataURL('image/png') });
    } catch {
      /* ignore */
    }
  };
  const clear = (): void => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.fillStyle = '#0d1526';
    ctx.fillRect(0, 0, W, H);
    patch(nodeId, { image: '' });
  };

  return (
    <div className="node draw">
      <div className="head"><span className="dot" /> ✏️ Desenho<button className="btn mini nodrag" title="Limpar" onClick={clear}>🧹</button><DeleteBtn id={nodeId} /></div>
      <div className="body" style={{ padding: 6 }}>
        <canvas
          ref={ref}
          width={W}
          height={H}
          className="nodrag nowheel"
          style={{ width: W, height: H, borderRadius: 6, cursor: 'crosshair', touchAction: 'none' }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
