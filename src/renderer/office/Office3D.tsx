import { useEffect, useMemo, type JSX } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * Rótulo como sprite com textura desenhada em <canvas> 2D (fontes do sistema,
 * emoji incluído). Substitui o <Text> do drei: o troika usa workers com
 * importScripts(blob:) e baixa fontes de um CDN — ambos bloqueados pela CSP —,
 * o que deixava o escritório 3D preso em "Carregando…".
 */
function Label({ text, position, size = 0.22, color = '#dce6f5' }: { text: string; position: [number, number, number]; size?: number; color?: string }): JSX.Element {
  const { texture, aspect } = useMemo(() => {
    const px = 64;
    const font = `600 ${px}px system-ui, "Segoe UI", "Segoe UI Emoji", sans-serif`;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = Math.max(1, Math.ceil((ctx ? (ctx.font = font, ctx.measureText(text).width) : text.length * px * 0.6) + px * 0.5));
    canvas.width = width;
    canvas.height = Math.ceil(px * 1.4);
    if (ctx) {
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.8)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = color;
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return { texture: tex, aspect: canvas.width / canvas.height };
  }, [text, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  const h = size * 1.4;
  return (
    <sprite position={position} scale={[h * aspect, h, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}
import { useFrigg } from '../store.js';
import { deriveVisual, type Activity } from '../../core/session-model.js';
import { initialSessionState } from '../../core/turn-state.js';
import type { WorkspaceNode } from '../../core/workspace.js';
import { nodeTitle } from '../node-label.js';

/**
 * Escritório 3D (D02–D06): mesma sessão do canvas, câmera isométrica ortográfica,
 * uma estação por agente/terminal. Cor = estado REAL confirmado; sem animação
 * inventada (cena estática satisfaz redução de movimento — D11).
 */

const COLOR: Record<Activity, string> = {
  idle: '#8aa0c0',
  working: '#14e0c8',
  awaiting_approval: '#f5b942',
  cancelling: '#f5b942',
  done: '#35d07f',
  failed: '#ff6b6b',
  unknown: '#ff6b6b',
};

function Station({ node, x, z }: { node: WorkspaceNode; x: number; z: number }): JSX.Element {
  const slot = useFrigg((s) => s.sessions[node.id]);
  const select = useFrigg((s) => s.select);
  const selected = useFrigg((s) => s.selectedId === node.id);
  const activity = deriveVisual(slot?.state ?? initialSessionState(), {
    lastEventAt: slot?.lastEventAt ?? null,
  }).activity;
  const title = nodeTitle(node);

  return (
    <group position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); select(node.id); }}>
      {/* mesa */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[1.4, 0.5, 0.9]} />
        <meshStandardMaterial color={selected ? '#24344f' : '#16223c'} />
      </mesh>
      {/* monitor / indicador de estado */}
      <mesh position={[0, 0.85, -0.2]}>
        <boxGeometry args={[0.9, 0.55, 0.06]} />
        <meshStandardMaterial color={COLOR[activity]} emissive={COLOR[activity]} emissiveIntensity={0.35} />
      </mesh>
      {/* "agente" */}
      <mesh position={[0, 0.6, 0.5]}>
        <capsuleGeometry args={[0.18, 0.4, 4, 8]} />
        <meshStandardMaterial color={COLOR[activity]} />
      </mesh>
      <Label text={title} position={[0, 1.35, 0]} />
    </group>
  );
}

export function Office3D(): JSX.Element {
  const nodes = useFrigg((s) => s.nodes);
  const select = useFrigg((s) => s.select);
  const stations = useMemo(() => nodes.filter((n) => n.kind === 'agent' || n.kind === 'terminal'), [nodes]);

  return (
    <Canvas
      shadows
      orthographic
      camera={{ position: [12, 12, 12], zoom: 55, near: 0.1, far: 100 }}
      onPointerMissed={() => select(null)}
      style={{ background: '#0b1220' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 12, 6]} intensity={1.1} castShadow />
      <Grid args={[40, 40]} cellColor="#24344f" sectionColor="#35507a" infiniteGrid fadeDistance={40} />
      {stations.map((n, i) => {
        const cols = 4;
        const gx = (i % cols) * 3 - ((cols - 1) * 3) / 2;
        const gz = Math.floor(i / cols) * 3 - 3;
        return <Station key={n.id} node={n} x={gx} z={gz} />;
      })}
      {stations.length === 0 ? (
        <Label text="Adicione um Agente ou Terminal" position={[0, 1, 0]} size={0.5} color="#8aa0c0" />
      ) : null}
      <OrbitControls
        makeDefault
        enablePan
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 3}
        minZoom={25}
        maxZoom={120}
      />
    </Canvas>
  );
}
