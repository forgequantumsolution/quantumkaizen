import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  newInstance,
  FlowchartConnector,
  BlankEndpoint,
  AnchorLocations,
  EVENT_CONNECTION,
  EVENT_DRAG_STOP,
  type BrowserJsPlumbInstance,
} from '@jsplumb/browser-ui';
import { Maximize2, Minus, Plus, X } from 'lucide-react';
import { nodeComponents } from './nodes';
import type { WorkflowFlowEdge, WorkflowFlowNode } from './builder.types';
import './jsplumb-canvas.css';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.75;

export interface JsPlumbCanvasHandle {
  fitView: () => void;
}

interface Transform {
  x: number;
  y: number;
  zoom: number;
}

interface Props {
  nodes: WorkflowFlowNode[];
  edges: WorkflowFlowEdge[];
  selectedId?: string | null;
  /** Allow pan / zoom / node selection. */
  interactive?: boolean;
  /** Allow dragging nodes and drawing new connections. Implies interactive. */
  editable?: boolean;
  /** Flow direction — drives anchor placement (TB = top→bottom, LR = left→right). */
  direction?: 'TB' | 'LR';
  onNodePositionChange?: (id: string, pos: { x: number; y: number }) => void;
  onConnect?: (source: string, target: string) => void;
  onSelect?: (id: string) => void;
  onPaneClick?: () => void;
  /** When provided (and `editable`), each node shows a hover ✕ to delete it. */
  onNodeDelete?: (id: string) => void;
}

/**
 * Framework-agnostic flow canvas built on the jsPlumb community edition
 * (`@jsplumb/browser-ui`). Replaces the previous React Flow canvas.
 *
 * jsPlumb owns node positioning (via `style.left/top`), dragging, and
 * connector rendering (SVG). Pan/zoom is layered on top: the surface is CSS
 * `transform`ed and `instance.setZoom` keeps jsPlumb's drag math in sync.
 * Connections are a pure function of the `edges` prop — every sync deletes and
 * redraws them, so user-drawn edges round-trip through parent state.
 */
const JsPlumbCanvas = forwardRef<JsPlumbCanvasHandle, Props>(function JsPlumbCanvas(
  {
    nodes,
    edges,
    selectedId,
    interactive = true,
    editable = false,
    direction = 'TB',
    onNodePositionChange,
    onConnect,
    onSelect,
    onPaneClick,
    onNodeDelete,
  },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<BrowserJsPlumbInstance | null>(null);
  const nodeEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const managed = useRef<Map<string, HTMLElement>>(new Map());
  const suppress = useRef(false);
  const firstFit = useRef(false);

  // Latest callbacks kept in refs so the (mount-only) jsPlumb event bindings
  // never read stale closures.
  const cbs = useRef({ onConnect, onNodePositionChange });
  cbs.current = { onConnect, onNodePositionChange };

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, zoom: 1 });
  const [panning, setPanning] = useState(false);

  const canDrag = editable;
  // Stable across renders so the sync effect below doesn't rebuild every
  // connector on each pan/zoom frame — only when the direction actually flips.
  const anchors = useMemo<[string, string]>(
    () =>
      direction === 'LR'
        ? [AnchorLocations.Right, AnchorLocations.Left]
        : [AnchorLocations.Bottom, AnchorLocations.Top],
    [direction],
  );

  // ─── Fit the graph into the viewport ────────────────────────────────────
  const fitView = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || nodes.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      const el = nodeEls.current.get(n.id);
      const w = el?.offsetWidth ?? 220;
      const h = el?.offsetHeight ?? 96;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }
    if (!Number.isFinite(minX)) return;
    const pad = 56;
    const cw = maxX - minX + pad * 2;
    const ch = maxY - minY + pad * 2;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const zoom = Math.max(MIN_ZOOM, Math.min(vw / cw, vh / ch, 1));
    const x = (vw - (maxX - minX) * zoom) / 2 - minX * zoom;
    const y = (vh - (maxY - minY) * zoom) / 2 - minY * zoom;
    setTransform({ x, y, zoom });
  }, [nodes]);

  useImperativeHandle(ref, () => ({ fitView }), [fitView]);

  // ─── Create the jsPlumb instance once ───────────────────────────────────
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const instance = newInstance({
      container: surface,
      connector: {
        type: FlowchartConnector.type,
        options: { cornerRadius: 10, stub: 20, gap: 6, alwaysRespectStubs: true },
      },
      endpoint: { type: BlankEndpoint.type, options: {} },
      paintStyle: { stroke: '#94A3B8', strokeWidth: 2 },
      hoverPaintStyle: { stroke: '#C9A84C', strokeWidth: 3 },
      connectionOverlays: [
        {
          type: 'PlainArrow',
          options: { location: 1, width: 9, length: 11, id: 'arrow' },
        },
      ],
      connectionsDetachable: false,
    } as never);
    instanceRef.current = instance;

    instance.bind(EVENT_CONNECTION, (info: { sourceId: string; targetId: string }) => {
      if (suppress.current) return; // programmatic (render-sync) connection
      const { sourceId, targetId } = info;
      if (sourceId && targetId && sourceId !== targetId) {
        cbs.current.onConnect?.(sourceId, targetId);
      }
    });

    instance.bind(EVENT_DRAG_STOP, (payload: { elements?: unknown[]; el?: HTMLElement }) => {
      const els: HTMLElement[] = [];
      for (const d of payload?.elements ?? []) {
        const rec = d as { el?: HTMLElement; element?: HTMLElement };
        const el = (rec?.el ?? rec?.element ?? (d as HTMLElement)) as HTMLElement;
        if (el instanceof HTMLElement) els.push(el);
      }
      if (els.length === 0 && payload?.el) els.push(payload.el);
      for (const el of els) {
        const id = el.getAttribute('data-node-id');
        if (!id) continue;
        const x = parseFloat(el.style.left) || 0;
        const y = parseFloat(el.style.top) || 0;
        cbs.current.onNodePositionChange?.(id, { x, y });
      }
    });

    return () => {
      // jsPlumb's destroy() → reset() removes every element still tagged with
      // `data-jtk-managed` from the DOM — which includes the React-owned
      // `.wf-node` divs (jsPlumb tags them on manage()). React doesn't rebuild
      // them (the `nodes` array is unchanged), so the canvas would render only
      // connectors and no node cards. This bites under React 18 StrictMode's
      // mount→unmount→remount cycle (and HMR / any real remount). Unmanaging
      // first with removeElement=false strips that attribute without touching
      // the DOM, so our nodes survive and the next instance just re-manages them.
      for (const el of managed.current.values()) {
        try {
          instance.unmanage(el, false);
        } catch {
          /* element already detached */
        }
      }
      instance.destroy();
      instanceRef.current = null;
      managed.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Connection drag sources/targets — only while editable.
  useLayoutEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    if (!editable) return;
    const src = instance.addSourceSelector('.wf-connect-handle', {
      anchor: anchors[0],
    } as never);
    const tgt = instance.addTargetSelector('.wf-node', {
      anchor: anchors[1],
    } as never);
    return () => {
      instance.removeSourceSelector(src);
      instance.removeTargetSelector(tgt);
    };
  }, [editable, anchors]);

  // ─── Sync React state → jsPlumb (nodes, positions, edges) ───────────────
  useLayoutEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    suppress.current = true;
    instance.setSuspendDrawing(true);

    const ids = new Set(nodes.map((n) => n.id));
    for (const [id, el] of managed.current) {
      if (!ids.has(id)) {
        try {
          instance.unmanage(el);
        } catch {
          /* element already detached */
        }
        managed.current.delete(id);
      }
    }
    for (const n of nodes) {
      const el = nodeEls.current.get(n.id);
      if (!el) continue;
      if (!managed.current.has(n.id)) {
        instance.manage(el, n.id);
        managed.current.set(n.id, el);
      }
      instance.setDraggable(el, canDrag);
      instance.setPosition(el, { x: n.position.x, y: n.position.y });
    }

    instance.deleteEveryConnection();
    for (const e of edges) {
      const s = nodeEls.current.get(e.source);
      const t = nodeEls.current.get(e.target);
      if (!s || !t) continue;
      const params: Record<string, unknown> = { source: s, target: t, anchors };
      if (e.label) {
        params.overlays = [
          {
            type: 'Label',
            options: { label: e.label, cssClass: 'wf-edge-label', location: 0.5 },
          },
        ];
      }
      instance.connect(params as never);
    }

    instance.setSuspendDrawing(false, true);
    suppress.current = false;

    if (!firstFit.current && nodes.length > 0) {
      firstFit.current = true;
      requestAnimationFrame(fitView);
    }
  }, [nodes, edges, canDrag, anchors, fitView]);

  // Keep jsPlumb's drag geometry aligned with the CSS zoom.
  useEffect(() => {
    instanceRef.current?.setZoom(transform.zoom);
  }, [transform.zoom]);

  // ─── Pan (drag empty canvas) ────────────────────────────────────────────
  const panState = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(
    null,
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    const target = e.target as HTMLElement;
    if (target.closest('.wf-node') || target.closest('.wf-canvas-controls')) return;
    panState.current = {
      x: e.clientX,
      y: e.clientY,
      px: transform.x,
      py: transform.y,
      moved: false,
    };
    setPanning(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = panState.current;
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) p.moved = true;
    setTransform((t) => ({ ...t, x: p.px + dx, y: p.py + dy }));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const p = panState.current;
    panState.current = null;
    setPanning(false);
    if (p && !p.moved) onPaneClick?.();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer capture may already be released */
    }
  };

  // ─── Zoom (wheel, cursor-anchored) ──────────────────────────────────────
  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setTransform((t) => {
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, t.zoom * factor));
      const ratio = zoom / t.zoom;
      // Keep the point under the cursor fixed while zooming.
      return {
        zoom,
        x: cx - (cx - t.x) * ratio,
        y: cy - (cy - t.y) * ratio,
      };
    });
  };

  const zoomBy = (factor: number) => {
    const vp = viewportRef.current;
    setTransform((t) => {
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, t.zoom * factor));
      const ratio = zoom / t.zoom;
      const cx = (vp?.clientWidth ?? 0) / 2;
      const cy = (vp?.clientHeight ?? 0) / 2;
      return { zoom, x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio };
    });
  };

  return (
    <div
      ref={viewportRef}
      className={`wf-canvas-viewport ${panning ? 'is-panning' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      style={interactive ? undefined : { cursor: 'default' }}
    >
      <div
        ref={surfaceRef}
        className="wf-canvas-surface"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
        }}
      >
        {nodes.map((n) => {
          const Comp = nodeComponents[n.type] ?? nodeComponents.stage;
          const isSelected = n.id === selectedId;
          return (
            <div
              key={n.id}
              ref={(el) => {
                if (el) nodeEls.current.set(n.id, el);
                else nodeEls.current.delete(n.id);
              }}
              className="wf-node"
              data-node-id={n.id}
              data-editable={editable ? 'true' : 'false'}
              data-dir={direction}
              onClick={(e) => {
                if (!interactive) return;
                e.stopPropagation();
                onSelect?.(n.id);
              }}
            >
              <Comp data={n.data} selected={isSelected} />
              {editable && onNodeDelete && (
                <button
                  type="button"
                  className="wf-node-delete"
                  title="Delete node"
                  // Stop jsPlumb from starting a node drag on press.
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNodeDelete(n.id);
                  }}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              )}
              {editable && <div className="wf-connect-handle" title="Drag to connect" />}
            </div>
          );
        })}
      </div>

      {interactive && (
        <div className="wf-canvas-controls">
          <button type="button" onClick={() => zoomBy(1.2)} title="Zoom in">
            <Plus size={15} />
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.2)} title="Zoom out">
            <Minus size={15} />
          </button>
          <button type="button" onClick={fitView} title="Fit to view">
            <Maximize2 size={14} />
          </button>
          <div className="wf-zoom-readout">{Math.round(transform.zoom * 100)}%</div>
        </div>
      )}
    </div>
  );
});

export default JsPlumbCanvas;
