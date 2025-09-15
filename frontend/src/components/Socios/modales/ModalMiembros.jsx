// src/components/Familias/modales/ModalMiembros.jsx
import React, { useEffect, useMemo, useState, useDeferredValue } from 'react';
import { FaTimes, FaPlus, FaTrash, FaSearch } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import './ModalMiembros.css';

/**
 * Columna izq: miembros actuales.
 * Columna der: TODOS los socios activos sin familia (se filtra en cliente).
 * Colorea cada tarjeta: verde (activo) / rojo (inactivo).
 * Búsqueda con useDeferredValue y actualizaciones optimistas.
 */
export default function ModalMiembros({ open, onClose, familia, notify, onDeltaCounts }) {
  const [miembros, setMiembros] = useState([]);
  const [candidatosAll, setCandidatosAll] = useState([]); // todos los SIN familia (activos)
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const qDeferred = useDeferredValue(q);

  useEffect(() => {
    if (!open || !familia) return;

    setQ('');
    setSel(new Set());
    cargarMiembros();
    cargarCandidatosIniciales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, familia?.id_familia]);

  const cargarMiembros = async () => {
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
  };

  // Trae TODOS los socios activos sin familia (sin límite)
  const cargarCandidatosIniciales = async () => {
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
        activo: Number(s.activo ?? 1)
      }));
      setCandidatosAll(rows);
    } catch {
      notify?.('Error al obtener socios sin familia', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtro instantáneo en cliente (sobre todos los sin familia)
  const candidatosFiltrados = useMemo(() => {
    const t = (qDeferred || '').trim().toLowerCase();
    if (!t) return candidatosAll;
    return candidatosAll.filter(c =>
      (c.nombre || '').toLowerCase().includes(t) ||
      String(c.dni || '').includes(t)
    );
  }, [candidatosAll, qDeferred]);

  const toggleSel = (id) => {
    setSel(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const agregarSeleccionados = async () => {
    if (sel.size === 0) return;
    const toAdd = candidatosAll.filter(c => sel.has(c.id_socio));
    if (toAdd.length === 0) return;

    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familia_agregar_miembros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_familia: familia.id_familia,
          ids_socio: toAdd.map(x => x.id_socio)
        }),
      });
      const j = await r.json();
      if (!j?.exito) {
        notify?.(j?.mensaje || 'No se pudo agregar', 'error');
        return;
      }

      // Optimista: pasan a miembros
      setMiembros(prev => [
        ...prev,
        ...toAdd.map(c => ({
          id_socio: c.id_socio,
          nombre: c.nombre,
          dni: c.dni,
          domicilio: c.domicilio,
          numero: c.numero,
          activo: c.activo
        }))
      ]);

      // Dejan de estar en “sin familia”
      setCandidatosAll(prev => prev.filter(c => !sel.has(c.id_socio)));
      setSel(new Set());

      const deltaTotales = toAdd.length;
      const deltaActivos = toAdd.reduce((acc, c) => acc + (Number(c.activo) === 1 ? 1 : 0), 0);
      onDeltaCounts?.({ id_familia: familia.id_familia, deltaActivos, deltaTotales });

      notify?.('Miembros agregados');
    } catch {
      notify?.('Error al agregar miembros', 'error');
    }
  };

  const quitarMiembro = async (id_socio) => {
    if (!window.confirm('¿Quitar este miembro de la familia?')) return;

    const m = miembros.find(x => x.id_socio === id_socio);
    const eraActivo = Number(m?.activo) === 1;

    try {
      const r = await fetch(`${BASE_URL}/api.php?action=familia_quitar_miembro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_socio })
      });
      const j = await r.json();
      if (!j?.exito) {
        notify?.(j?.mensaje || 'No se pudo quitar', 'error');
        return;
      }

      // Optimista: sale de miembros…
      setMiembros(prev => prev.filter(x => x.id_socio !== id_socio));
      // …y vuelve a “sin familia” si estaba activo
      if (m && eraActivo) {
        setCandidatosAll(prev => {
          if (prev.some(x => x.id_socio === m.id_socio)) return prev;
          const nuevo = {
            id_socio: m.id_socio,
            nombre: m.nombre,
            dni: m.dni,
            domicilio: m.domicilio,
            numero: m.numero,
            activo: m.activo
          };
          return [nuevo, ...prev];
        });
      }

      onDeltaCounts?.({
        id_familia: familia.id_familia,
        deltaActivos: eraActivo ? -1 : 0,
        deltaTotales: -1
      });

      notify?.('Miembro quitado');
    } catch {
      notify?.('Error al quitar miembro', 'error');
    }
  };

  if (!open || !familia) return null;

  return (
    <div className="mm_overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="mm_modal" onClick={e => e.stopPropagation()}>
        <div className="mm_head">
          <h3>Miembros de “{familia.nombre_familia}”</h3>
          <button className="mm_close" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="mm_body">
          {/* Columna izquierda: miembros actuales */}
          <div className="mm_col">
            <h4>Miembros actuales</h4>
            <div className="mm_list" data-fixed>
              {miembros.length === 0 ? (
                <div className="mm_empty">Sin miembros</div>
              ) : miembros.map(m => {
                  const statusCls = Number(m.activo) === 1 ? 'status-active' : 'status-inactive';
                  return (
                    <div key={m.id_socio} className={`mm_item ${statusCls}`}>
                      <div className="mm_main">
                        <strong>{m.nombre}</strong>
                        <small>DNI: {m.dni || '—'}</small>
                        <small>{[m.domicilio, m.numero].filter(Boolean).join(' ')}</small>
                        {Number(m.activo) !== 1 && <small className="mm_badge danger">Inactivo</small>}
                      </div>
                      <div className="mm_actions">
                        <button
                          className="danger"
                          title="Quitar"
                          onClick={() => quitarMiembro(m.id_socio)}
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Columna derecha: candidatos (activos sin familia) */}
          <div className="mm_col">
            <h4>Agregar socios</h4>

            <div className="mm_search">
              <FaSearch />
              <input
                placeholder="Buscar por nombre o DNI (activos sin familia)…"
                value={q}
                onChange={e => setQ(e.target.value)}
                aria-label="Buscar socios"
              />
            </div>

            <div className="mm_list" data-fixed>
              {loading ? (
                <div className="mm_empty">Cargando socios…</div>
              ) : candidatosFiltrados.length === 0 ? (
                <div className="mm_empty">Sin resultados</div>
              ) : candidatosFiltrados.map(c => {
                  const checked = sel.has(c.id_socio);
                  const statusCls = Number(c.activo) === 1 ? 'status-active' : 'status-inactive';
                  return (
                    <label key={c.id_socio} className={`mm_item sel ${statusCls} ${checked ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSel(c.id_socio)}
                      />
                      <div className="mm_main">
                        <strong>{c.nombre}</strong>
                        <small>DNI: {c.dni || '—'}</small>
                        <small>{[c.domicilio, c.numero].filter(Boolean).join(' ')}</small>
                        {Number(c.activo) !== 1 && <small className="mm_badge danger">Inactivo</small>}
                      </div>
                    </label>
                  );
                })}
            </div>

            <div className="mm_footer_right">
              <button className="mm_btn solid" onClick={agregarSeleccionados} disabled={sel.size === 0}>
                <FaPlus /> Agregar seleccionados ({sel.size})
              </button>
            </div>
          </div>
        </div>

        <div className="mm_foot">
          <button className="mm_btn ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
