import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ComponentType } from 'react';
import { useLanguage } from '../i18n';

type EmbeddedTool = { default: ComponentType; styles: string };
type ToolLoader = () => Promise<EmbeddedTool>;

const shellOverrides = `
:host { display:block; height:100%; min-height:0; overflow:hidden; background:#f7f8f5; color:#202a26; }
#tool-mount { height:100%; min-height:0; width:100%; overflow:hidden; }
#tool-mount > .h-screen { height:100% !important; min-height:0 !important; width:100% !important; }
#tool-mount > .min-h-screen { min-height:100% !important; }
@media print { :host { height:auto !important; min-height:0 !important; overflow:visible !important; } #tool-mount, #tool-mount > .h-screen { height:auto !important; overflow:visible !important; } }
`;

export function ToolStage({ load, label }: { load: ToolLoader; label: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reactRootRef = useRef<Root | null>(null);
  const labelRef = useRef(label);
  labelRef.current = label;
  const { copy } = useLanguage();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    let shadow = hostRef.current?.shadowRoot;
    if (!shadow && hostRef.current) shadow = hostRef.current.attachShadow({ mode: 'open' });
    if (!shadow) return;
    shadow.replaceChildren();
    reactRootRef.current = null;

    load().then((module) => {
      if (cancelled || !shadow) return;
      const style = document.createElement('style');
      style.textContent = `${module.styles}\n${shellOverrides}`;
      const mount = document.createElement('div');
      mount.id = 'tool-mount';
      shadow.replaceChildren(style, mount);
      const root = createRoot(mount);
      reactRootRef.current = root;
      root.render(<module.default />);
      setStatus('ready');
    }).catch((error: unknown) => {
      if (cancelled) return;
      console.error(`Unable to load ${labelRef.current}:`, error);
      setStatus('error');
    });

    return () => {
      cancelled = true;
      reactRootRef.current?.unmount();
      reactRootRef.current = null;
    };
  }, [load, retry]);

  return <div className="tool-stage-frame">
    <div className="tool-stage" ref={hostRef} aria-label={label} />
    {status !== 'ready' && <div className={`tool-stage-message ${status === 'error' ? 'tool-load-error' : ''}`} role={status === 'error' ? 'alert' : 'status'}>
      <div>{status === 'loading' ? <><div className="stage-spinner" /><strong>{copy.stage.loading} {label}…</strong><p>{copy.stage.prepare}</p></> : <><strong>{copy.stage.failed}</strong><p>{copy.stage.other}</p><button className="button button-secondary" onClick={() => setRetry((value) => value + 1)}>{copy.stage.retry}</button></>}</div>
    </div>}
  </div>;
}
