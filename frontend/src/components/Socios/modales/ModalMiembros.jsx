// src/components/Familias/modales/ModalMiembros.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useDeferredValue,
  useCallback,
  useTransition,
  useRef,
  memo,
} from 'react';
import { FaTimes, FaPlus, FaTrash, FaSearch } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import './ModalMiembros.css';

/* Utilidad: inicial del nombre */
const getInitial = (str) => {
  const s = (str || '').trim();
  return s ? s.charAt(0).toUpperCase() : '?';
};

/* ---------- Tarjetas memoizadas ---------- */
const MiembroCard = memo(function MiembroCard({ m, onRemove, cascadeIndex = -1, playCascade = false }) {
  const active = Number(m.activo) === 1;
  const cascadeClass = playCascade && cascadeIndex > -1 && cascadeIndex < 10 ? 'modalmi-cascade' : '';
  const cascadeStyle = cascadeClass ? { '--mi-cascade-i': cascadeIndex } : undefined;

  return (
    <div
      className={`modalmi-card ${active ? 'is-active' : 'is-inactive'} ${cascadeClass}`}
      style={cascadeStyle}
    >
      <div className="modalmi-avatar" title={m.nombre} aria-hidden="true">
        {getInitial(m.nombre)}
      </div>

      <div className="modalmi-info">
        <div className="modalmi-name-row">
          <span className={`modalmi-status-dot ${active ? 'ok' : 'off'}`} />
          <span className="modalmi-name" title={m.nombre}>{m.nombre}</span>
        </div>
        <div className="modalmi-meta">
          <span className="modalmi-dni"><strong>DNI:</strong> {m.dni || '—'}</span>
        </div>
      </div>

      <button className="modalmi-remove" title="Quitar" onClick={() => onRemove(m.id_socio)}>
        <FaTrash />
      </button>
    </div>
  );
});

const CandidatoCard = memo(function CandidatoCard({ c, checked, onToggle, cascadeIndex = -1, playCascade = false }) {
  const active = Number(c.activo) === 1;
  const cascadeClass = playCascade && cascadeIndex > -1 && cascadeIndex < 10 ? 'modalmi-cascade' : '';
  const cascadeStyle = cascadeClass ? { '--mi-cascade-i': cascadeIndex } : undefined;

  return (
    <label
      className={`modalmi-card modalmi-selectable ${active ? 'is-active' : 'is-inactive'} ${checked ? 'is-checked' : ''} ${cascadeClass}`}
      style={cascadeStyle}
    >
      <input type="checkbox" checked={checked} onChange={() => onToggle(c.id_socio)} />
      <div className="modalmi-checkslot" aria-hidden="true" />
      <div className="modalmi-info">
        <div className="modalmi-name nameizs" title={c.nombre}>{c.nombre}</div>
        <div className="modalmi-meta">
          <span className="modalmi-dni"><strong>DNI:</strong> {c.dni || '—'}</span>
        </div>
      </div>
    </label>
  );
});

/* ---------- Modal ---------- */
export default function ModalMiembros({ open, onClose, familia, notify, onDeltaCounts }) {
  const [miembros, setMiembros] = useState([]);
  const [candidatosAll, setCandidatosAll] = useState([]);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(new Set());

  const [loading, setLoading] = useState(false); // carga candidatos
  const [miembrosLoading, setMiembrosLoading] = useState(false); // carga miembros

  // Skeleton + cascada primera vez
  const [showMiembrosSkeleton, setShowMiembrosSkeleton] = useState(false);
  const [showCandidatosSkeleton, setShowCandidatosSkeleton] = useState(false);
  const [playCascade, setPlayCascade] = useState(false);
  const didFirstIntroRef = useRef(false);

  const [isPending, startTransition] = useTransition();
  const qDeferred = useDeferredValue(q);

  // Infinite scroll candidatos
  const BATCH = 60;
  const [visibleCount, setVisibleCount] = useState(BATCH);

  // refs para el buscador
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!open || !familia) return;

    // reset UI
    setQ('');
    setSel(new Set());
    setVisibleCount(BATCH);

    // Primera entrada: skeleton corto + cascada (ambas columnas) solo 1 vez
    if (!didFirstIntroRef.current) {
      setShowMiembrosSkeleton(true);
      setShowCandidatosSkeleton(true);
      setPlayCascade(false);

      const t = setTimeout(() => {
        setShowMiembrosSkeleton(false);
        setShowCandidatosSkeleton(false);
        setPlayCascade(true);
        didFirstIntroRef.current = true;

        const off = setTimeout(() => setPlayCascade(false), 900);
        return () => clearTimeout(off);
      }, 220);

      return () => clearTimeout(t);
    }
  }, [open, familia?.id_familia]);

  // Carga de datos
  useEffect(() => {
    if (!open || !familia) return;
    setMiembrosLoading(true);
    cargarMiembros().finally(() => setMiembrosLoading(false));
    cargarCandidatosIniciales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, familia?.id_familia]);

  const cargarMiembros = useCallback(async () => {
    try {
      const r = await fetch(
        `${BASE_URL}/api.php?action=familia_miembros&id_familia=${familia.id_familia}&ts=${Date.now()}`,
        { cache: 'no-store' }
      );
      const j = await r.json();
      setMiembros(j?.miembros || []);
    } catch {
      notify?.('Error al obtener miembros', 'error');
    }
  }, [familia, notify]);

  const cargarCandidatosIniciales = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `${BASE_URL}/api.php?action=socios_sin_familia&ts=${Date.now()}`,
        { cache: 'no-store' }
      );
      const j = await r.json();
      const rows = (j?.socios || []).map(s => ({
        id_socio: s.id_socio ?? s.id ?? s.idSocios,
        nombre: s.nombre ?? '',
        dni: s.dni ?? '',
        domicilio: s.domicilio ?? '',
        numero: s.numero ?? '',
        activo: Number(s.activo ?? 1),
      }));
      setCandidatosAll(rows);
    } catch {
      notify?.('Error al obtener socios sin familia', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const candidatosFiltrados = useMemo(() => {
    const t = (qDeferred || '').trim().toLowerCase();
    if (!t) return candidatosAll;
    return candidatosAll.filter(c =>
      (c.nombre || '').toLowerCase().includes(t) || String(c.dni || '').includes(t)
    );
  }, [candidatosAll, qDeferred]);

  useEffect(() => { setVisibleCount(BATCH); }, [qDeferred]);
  const visibles = useMemo(() => candidatosFiltrados.slice(0, visibleCount), [candidatosFiltrados, visibleCount]);

  const onGridScroll = useCallback((e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 160) {
      setVisibleCount(v => (v < candidatosFiltrados.length ? v + BATCH : v));
    }
  }, [candidatosFiltrados.length]);

  const toggleSel = useCallback((id) => {
    setSel(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const agregarSeleccionados = useCallback(async () => {
    if (sel.size === 0) return;
    const ids = Array.from(sel);
    const setIds = new Set(ids);
    const toAdd = candidatosAll.filter(c => setIds.has(c.id_socio));
    if (!toAdd.length) return;

    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familia_agregar_miembros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_familia: familia.id_familia, ids_socio: ids }),
      });
      const j = await r.json();
      if (!j?.exito) { notify?.(j?.mensaje || 'No se pudo agregar', 'error'); return; }

      setMiembros(prev => [
        ...prev,
        ...toAdd.map(c => ({
          id_socio: c.id_socio, nombre: c.nombre, dni: c.dni,
          domicilio: c.domicilio, numero: c.numero, activo: c.activo,
        })),
      ]);
      setCandidatosAll(prev => prev.filter(c => !setIds.has(c.id_socio)));
      setSel(new Set());

      const deltaTotales = toAdd.length;
      const deltaActivos = toAdd.reduce((acc, c) => acc + (Number(c.activo) === 1 ? 1 : 0), 0);
      onDeltaCounts?.({ id_familia: familia.id_familia, deltaActivos, deltaTotales });
      notify?.('Miembros agregados');
    } catch {
      notify?.('Error al agregar miembros', 'error');
    }
  }, [sel, candidatosAll, familia, notify, onDeltaCounts]);

  const quitarMiembro = useCallback(async (id_socio) => {
    if (!window.confirm('¿Quitar este miembro de la familia?')) return;
    const m = miembros.find(x => x.id_socio === id_socio);
    const eraActivo = Number(m?.activo) === 1;

    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familia_quitar_miembro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_socio }),
      });
      const j = await r.json();
      if (!j?.exito) { notify?.(j?.mensaje || 'No se pudo quitar', 'error'); return; }

      setMiembros(prev => prev.filter(x => x.id_socio !== id_socio));
      if (m && eraActivo) {
        setCandidatosAll(prev =>
          prev.some(x => x.id_socio === m.id_socio)
            ? prev
            : [{ id_socio: m.id_socio, nombre: m.nombre, dni: m.dni, domicilio: m.domicilio, numero: m.numero, activo: m.activo }, ...prev]
        );
      }

      onDeltaCounts?.({ id_familia: familia.id_familia, deltaActivos: eraActivo ? -1 : 0, deltaTotales: -1 });
      notify?.('Miembro quitado');
    } catch {
      notify?.('Error al quitar miembro', 'error');
    }
  }, [miembros, notify, onDeltaCounts, familia]);

  // --- acciones del buscador (lupa/clear) ---
  const handleSearchIcon = useCallback(() => {
    if (!q) {
      searchInputRef.current?.focus();
      return;
    }
    startTransition(() => setQ(''));
    searchInputRef.current?.focus();
  }, [q]);

  const onSearchKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && q) {
      e.preventDefault();
      e.stopPropagation();
      startTransition(() => setQ(''));
    }
  }, [q]);

  if (!open || !familia) return null;

  // Skeletons solo en primera entrada (~380ms)
  const showMiembrosSkeletonNow = !didFirstIntroRef.current && showMiembrosSkeleton;
  const showCandidatosSkeletonNow = !didFirstIntroRef.current && showCandidatosSkeleton;

  return (
    <div className="modalmi-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modalmi-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modalmi-head">
          <h3 className="modalmi-title">
            <span className="modalmi-title-dot" />
            Miembros de “{familia.nombre_familia}”
          </h3>
          <button className="modalmi-close" onClick={onClose} aria-label="Cerrar">
            <FaTimes />
          </button>
        </div>

        <div className="modalmi-body">
          {/* Columna izquierda: miembros actuales */}
          <div className="modalmi-col">
            <h4 className="modalmi-subtitle miembros-ctual">Miembros actuales</h4>
            <div className="modalmi-grid" data-fixed>
              {showMiembrosSkeletonNow ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div className="modalmi-skel-card" key={`skel-left-${i}`}>
                    <div className="modalmi-skel-avatar" />
                    <div className="modalmi-skel-lines">
                      <div className="modalmi-skel-line long" />
                      <div className="modalmi-skel-line short" />
                    </div>
                  </div>
                ))
              ) : miembros.length === 0 ? (
                <div className="modalmi-empty">Sin miembros</div>
              ) : (
                miembros.map((m, idx) => (
                  <MiembroCard
                    key={m.id_socio}
                    m={m}
                    onRemove={quitarMiembro}
                    cascadeIndex={idx}
                    playCascade={playCascade}
                  />
                ))
              )}
            </div>
          </div>

          {/* Columna derecha: candidatos */}
          <div className="modalmi-col">
            <div className="modalmi-subbar">
              <h4 className="modalmi-subtitle">
                Agregar socios {isPending && <span className="modalmi-hint"></span>}
              </h4>

              <div className={`modalmi-search modalmi-search--compact ${q ? 'is-filled' : ''}`} role="search">
                <input
                  ref={searchInputRef}
                  placeholder="Buscar por nombre o DNI…"
                  value={q}
                  onChange={(e) => startTransition(() => setQ(e.target.value))}
                  onKeyDown={onSearchKeyDown}
                  aria-label="Buscar socios"
                />
                <button
                  className="modalmi-search-ico"
                  onClick={handleSearchIcon}
                  aria-label={q ? 'Limpiar búsqueda' : 'Buscar'}
                  title={q ? 'Limpiar' : 'Buscar'}
                  type="button"
                >
                  {q ? <FaTimes /> : <FaSearch />}
                </button>
              </div>
            </div>

            <div className="modalmi-grid" data-fixed onScroll={onGridScroll}>
              {showCandidatosSkeletonNow ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div className="modalmi-skel-card modalmi-skel-card--cand" key={`skel-right-${i}`}>
                    <div className="modalmi-skel-check" />
                    <div className="modalmi-skel-lines">
                      <div className="modalmi-skel-line long" />
                      <div className="modalmi-skel-line short" />
                    </div>
                  </div>
                ))
              ) : loading && visibles.length === 0 ? (
                <div className="modalmi-empty">Cargando socios…</div>
              ) : visibles.length === 0 ? (
                <div className="modalmi-empty">Sin resultados</div>
              ) : (
                visibles.map((c, idx) => (
                  <CandidatoCard
                    key={c.id_socio}
                    c={c}
                    checked={sel.has(c.id_socio)}
                    onToggle={toggleSel}
                    cascadeIndex={idx}
                    playCascade={playCascade}
                  />
                ))
              )}
              {visibles.length < candidatosFiltrados.length && !showCandidatosSkeletonNow && (
                <div className="modalmi-sentinel">Cargando más…</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modalmi-foot">
          <button
            className="modalmi-btn modalmi-solid"
            onClick={agregarSeleccionados}
            disabled={sel.size === 0}
            title="Agregar seleccionados"
          >
            <FaPlus /> Agregar seleccionados ({sel.size})
          </button>
          <button className="modalmi-btn modalmi-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
