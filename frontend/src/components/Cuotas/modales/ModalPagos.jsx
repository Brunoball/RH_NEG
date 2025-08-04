import React, { useEffect, useState } from 'react';
import BASE_URL from '../../../config/config';
import './ModalPagos.css';

const obtenerPrimerMesDesdeNombre = (nombre) => {
  const match = nombre.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
};

const ModalPagos = ({ socio, onClose }) => {
  const [periodos, setPeriodos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [periodosPagados, setPeriodosPagados] = useState([]);
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const fetchDatos = async () => {
      setCargando(true);
      try {
        const [resListas, resPagados] = await Promise.all([
          fetch(`${BASE_URL}/api.php?action=listas`),
          fetch(`${BASE_URL}/api.php?action=periodos_pagados&id_socio=${socio.id_socio}`)
        ]);

        const dataListas = await resListas.json();
        const dataPagados = await resPagados.json();

        if (dataListas.exito) {
          const ordenados = dataListas.listas.periodos.sort((a, b) => a.id - b.id);
          setPeriodos(ordenados);
        }

        if (dataPagados.exito) {
          setPeriodosPagados(dataPagados.periodos_pagados);
          setFechaIngreso(dataPagados.ingreso);
        } else {
          console.error('Error al obtener períodos pagados:', dataPagados.mensaje);
        }
      } catch (error) {
        console.error('Error al obtener datos:', error);
      } finally {
        setCargando(false);
      }
    };

    if (socio?.id_socio) {
      fetchDatos();
    }
  }, [socio]);

  const togglePeriodo = (id) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const confirmarPago = async () => {
    if (seleccionados.length === 0) {
      alert("Por favor seleccione al menos un período para registrar el pago");
      return;
    }

    setCargando(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_socio: socio.id_socio,
          periodos: seleccionados
        })
      });

      const data = await res.json();
      if (data.exito) {
        alert('Pago registrado correctamente');
        onClose(true);
      } else {
        alert('Error al registrar el pago: ' + data.mensaje);
      }
    } catch (error) {
      console.error('Error al registrar el pago:', error);
      alert('Error de conexión al registrar el pago');
    } finally {
      setCargando(false);
    }
  };

  const filtrarPeriodosPorIngreso = () => {
    if (!fechaIngreso) return periodos;

    const fecha = new Date(fechaIngreso);
    const mesIngreso = fecha.getMonth() + 1;
    const anioIngreso = fecha.getFullYear();
    const anioActual = new Date().getFullYear();

    return periodos.filter((p) => {
      const primerMes = obtenerPrimerMesDesdeNombre(p.nombre);
      return (anioIngreso < anioActual) || (anioIngreso === anioActual && primerMes >= mesIngreso);
    });
  };

  const formatearFecha = (fechaStr) => {
    const fecha = new Date(fechaStr);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  if (!socio) return null;

  const periodosDisponibles = filtrarPeriodosPorIngreso();

  return (
    <div className="modal-pagos-overlay">
      <div className="modal-pagos-contenido">
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
                <path d="M12.5 7H11V13L16.2 16.2L17 14.9L12.5 12.2V7Z" fill="currentColor"/>
              </svg>
            </div>
            <h2 className="modal-title">Registro de Pagos</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} disabled={cargando}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="socio-info-card">
            <div className="socio-info-header">
              <h3 className="socio-nombre">{socio.nombre}</h3>
              {fechaIngreso && (
                <div className="socio-fecha">
                  <span className="fecha-label">Ingreso:</span>
                  <span className="fecha-valor">{formatearFecha(fechaIngreso)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="periodos-section">
            <div className="section-header">
              <h4 className="section-title">Períodos Disponibles</h4>
              <div className="selection-info">
                {seleccionados.length > 0 ? `${seleccionados.length} seleccionados` : 'Ninguno seleccionado'}
              </div>
            </div>

            {cargando && periodos.length === 0 ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <span>Cargando períodos...</span>
              </div>
            ) : (
              <div className="periodos-grid-container">
                <div className="periodos-grid">
                  {periodosDisponibles.map((periodo) => {
                    const yaPagado = periodosPagados.includes(periodo.id);
                    return (
                      <div 
                        key={periodo.id} 
                        className={`periodo-card ${yaPagado ? 'pagado' : ''} ${seleccionados.includes(periodo.id) ? 'seleccionado' : ''}`}
                        onClick={() => !yaPagado && togglePeriodo(periodo.id)}
                      >
                        <div className="periodo-checkbox">
                          <input
                            type="checkbox"
                            id={`periodo-${periodo.id}`}
                            checked={seleccionados.includes(periodo.id)}
                            onChange={() => togglePeriodo(periodo.id)}
                            disabled={yaPagado || cargando}
                          />
                          <span className="checkmark"></span>
                        </div>
                        <label htmlFor={`periodo-${periodo.id}`} className="periodo-label">
                          {periodo.nombre}
                          {yaPagado && (
                            <span className="periodo-status">
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              Pagado
                            </span>
                          )}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={cargando}
          >
            Cancelar
          </button>
          <button 
            className="btn btn-primary" 
            onClick={confirmarPago}
            disabled={seleccionados.length === 0 || cargando}
          >
            {cargando ? (
              <>
                <span className="spinner-btn"></span> Procesando...
              </>
            ) : (
              'Confirmar Pago'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalPagos;