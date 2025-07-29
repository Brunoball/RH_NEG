import React, { useEffect, useState } from 'react';
import BASE_URL from '../../../config/config';
import './ModalPagos.css';

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

  if (!socio) return null;

  return (
    <div className="modal-pagos-overlay">
      <div className="modal-pagos-contenido">
        <button className="modal-pagos-cerrar" onClick={onClose} disabled={cargando}>
          &times;
        </button>
        
        <div className="modal-pagos-header">
          <div className="modal-pagos-icono">
            <i className="fas fa-credit-card"></i>
          </div>
          <h2>REGISTRO DE PAGOS</h2>
          <div className="divider"></div>
        </div>

        <div className="modal-pagos-info-socio">
          <h3>{socio.nombre.toUpperCase()}</h3>
          {fechaIngreso && (
            <div className="info-fecha-ingreso">
              <span className="fecha-label">INGRESO:</span>
              <span className="fecha-valor">{fechaIngreso}</span>
            </div>
          )}
        </div>

        <div className="modal-pagos-lista-periodos">
          <h4>PERÍODOS DISPONIBLES</h4>
          {cargando && periodos.length === 0 ? (
            <div className="modal-pagos-cargando">
              <i className="fas fa-spinner fa-spin"></i> CARGANDO PERÍODOS...
            </div>
          ) : (
            <div className="periodos-grid">
              {periodos.map((periodo) => {
                const yaPagado = periodosPagados.includes(periodo.id);
                return (
                  <div 
                    key={periodo.id} 
                    className={`periodo-item ${yaPagado ? 'pagado' : ''} ${seleccionados.includes(periodo.id) ? 'seleccionado' : ''}`}
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
                    <label htmlFor={`periodo-${periodo.id}`}>
                      {periodo.nombre.toUpperCase()}
                      {yaPagado && <span className="badge-pagado"><i className="fas fa-check"></i> PAGADO</span>}
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modal-pagos-acciones">
          <button 
            className="btn-secundario" 
            onClick={onClose}
            disabled={cargando}
          >
            <i className="fas fa-times"></i> CANCELAR
          </button>
          <button 
            className="btn-primario" 
            onClick={confirmarPago}
            disabled={seleccionados.length === 0 || cargando}
          >
            {cargando ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> PROCESANDO...
              </>
            ) : (
              <>
                <i className="fas fa-check-circle"></i> CONFIRMAR PAGO
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalPagos;