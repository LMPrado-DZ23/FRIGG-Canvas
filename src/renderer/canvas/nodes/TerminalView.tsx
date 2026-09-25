import { useEffect, useRef, useState, type JSX } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { bridge } from '../../bridge.js';
import { autoInstallCommandWith } from '../../cli-catalog.js';

/** Terminal PTY real (G1). Se o PTY não estiver disponível, mostra a limitação. */
export function TerminalView({ id, command, cwd, install }: { id: string; command?: string; cwd?: string; install?: string }): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [approved, setApproved] = useState(!command?.trim() && !install?.trim());

  useEffect(() => {
    setApproved(!command?.trim() && !install?.trim());
  }, [command, install]);

  useEffect(() => {
    if (!approved) return undefined;
    const host = hostRef.current;
    if (!host) return;
    const term = new Terminal({
      fontSize: 12,
      theme: { background: '#05080f', foreground: '#dce6f5' },
      cursorBlink: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    try {
      fit.fit();
    } catch {
      /* host pode não ter tamanho ainda */
    }

    let disposed = false;
    const offData = bridge.pty.onData((e) => {
      if (e.id === id) term.write(e.data);
    });
    const offExit = bridge.pty.onExit((e) => {
      if (e.id === id) term.write(`\r\n\x1b[33m[processo encerrado: ${e.exitCode}]\x1b[0m\r\n`);
    });
    const inputSub = term.onData((d) => bridge.pty.write(id, d));

    void (async () => {
      const avail = await bridge.pty.available();
      if (disposed) return;
      if (!avail.available) {
        setWarn(`Terminal indisponível: ${avail.detail}. Instale o VS Build Tools ou o binário pré-compilado.`);
        return;
      }
      const res = await bridge.pty.start(id, term.cols, term.rows, autoInstallCommandWith(command ?? '', install), cwd);
      if (disposed) {
        // Desmontado com o start em voo: o kill do cleanup chegou antes do
        // processo existir; encerra agora para não deixar um shell órfão.
        if (res.ok) bridge.pty.kill(id);
        return;
      }
      if (!res.ok) setWarn(`Falha ao iniciar: ${res.detail}`);
    })();

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        bridge.pty.resize(id, term.cols, term.rows);
      } catch {
        /* ignore */
      }
    });
    ro.observe(host);

    return () => {
      disposed = true;
      ro.disconnect();
      offData();
      offExit();
      inputSub.dispose();
      bridge.pty.kill(id);
      term.dispose();
    };
  }, [id, command, cwd, install, approved]);

  return (
    <div className="term-wrap">
      {!approved ? (
        <div className="warn" role="alert">
          Este terminal executará <code>{command?.trim() || 'um instalador configurado'}</code> no diretório escolhido.
          <button className="btn mini nodrag" onClick={() => setApproved(true)}>Confirmar execução</button>
        </div>
      ) : null}
      {warn ? <div className="warn">{warn}</div> : null}
      <div className="term nodrag nowheel" ref={hostRef} />
    </div>
  );
}
