import React, { useState, useEffect, useRef } from 'react';
import {
  FaTimes, FaCheck, FaSearch, FaSpinner, FaBarcode,
  FaUser, FaHome, FaPhone, FaCalendarAlt, FaMoneyBillWave, FaIdCard
} from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import './ModalCodigoBarras.css';

const ModalCodigoBarras = ({ onClose, periodo, onPagoRealizado }) => {
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);
  const [socioEncontrado, setSocioEncontrado] = useState(null);
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => {
      if (!codigo.trim()) {
        setResultadosBusqueda([]);
        setSocioEncontrado(null);
        setMensaje('');
        return;
      }

      const limpio = codigo.replace(/[^a-zA-Z0-9]/g, '');
      if (/^\d+$/.test(limpio)) {
        buscarPorCodigo(limpio);
      } else {
        buscarPorNombre(codigo);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [codigo]);

  const buscarPorCodigo = async (input) => {
    if (input.length < 2) return;

    const id_periodo = input.slice(0, 1);
    const id_socio = input.slice(1);

    setMensaje('');
    setError(false);
    setSocioEncontrado(null);
    setResultadosBusqueda([]);

    try {
      const res = await fetch(`${BASE_URL}/api.php?action=buscar_socio_codigo&id_socio=${id_socio}&id_periodo=${id_periodo}`);
      const data = await res.json();
      if (data.exito) {
        setSocioEncontrado({ ...data.socio, id_periodo: parseInt(id_periodo) });
        setMensaje(`✅ Socio encontrado: ${data.socio.nombre}`);
      } else {
        setMensaje(data.mensaje || 'Socio no encontrado.');
        setError(true);
      }
    } catch {
      setMensaje('⛔ Error al conectar con el servidor');
      setError(true);
    }
  };

  const buscarPorNombre = async (nombre) => {
    setMensaje('');
    setError(false);
    setSocioEncontrado(null);
    setResultadosBusqueda([]);

    try {
      const res = await fetch(`${BASE_URL}/api.php?action=buscar_por_nombre&nombre=${encodeURIComponent(nombre)}`);
      const data = await res.json();
      if (data.exito && data.socios.length > 0) {
        setResultadosBusqueda(data.socios);
      } else {
        setMensaje('No se encontraron socios con ese nombre.');
        setError(true);
      }
    } catch {
      setMensaje('⛔ Error al conectar con el servidor');
      setError(true);
    }
  };

  const seleccionarSocio = (socio) => {
    setSocioEncontrado({ ...socio, id_periodo: parseInt(periodo) });
    setMensaje(`✅ Socio seleccionado: ${socio.nombre}`);
    setError(false);
    setResultadosBusqueda([]);
  };

  const registrarPago = async () => {
    if (!socioEncontrado || !socioEncontrado.id_periodo) {
      setMensaje('⛔ No se puede registrar el pago. Datos incompletos.');
      setError(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_socio: socioEncontrado.id_socio,
          periodos: [socioEncontrado.id_periodo]
        })
      });

      const data = await res.json();
      if (data.exito) {
        setMensaje('✅ Pago registrado correctamente');
        setError(false);
        onPagoRealizado();
        setTimeout(() => {
          setCodigo('');
          setSocioEncontrado(null);
          setMensaje('');
          if (inputRef.current) inputRef.current.focus();
        }, 2000);
      } else {
        setMensaje(data.mensaje || '⛔ Error al registrar el pago');
        setError(true);
      }
    } catch {
      setMensaje('⛔ Error al conectar con el servidor');
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="codb-modal-overlay">
      <div className="codb-modal-container">
        <div className="codb-modal">
          <div className="codb-modal-header">
            <div className="codb-header-icon">
              <FaBarcode />
            </div>
            <div className="codb-header-text">
              <h2>Registro de Pagos</h2>
              <p>Escaneá el código de barras o ingresá manualmente el código/nombre del socio</p>
            </div>
            <button className="codb-close-button" onClick={onClose}>
              <FaTimes />
            </button>
          </div>

          <div className="codb-modal-content">
            <div className="codb-search-section">
              <div className="codb-search-input-container">
                <input
                  ref={inputRef}
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ej: 12860 (Período + ID) o nombre del socio"
                  className={`codb-search-input ${error ? 'codb-input-error' : ''}`}
                />
                <div className="codb-input-hint">
                  <FaIdCard /> Formato: PERIODO + ID (ej: 112860) o nombre completo
                </div>
              </div>
            </div>

            {mensaje && (
              <div className={`codb-message-container ${error ? 'codb-error' : 'codb-success'}`}>
                {mensaje}
              </div>
            )}

            {resultadosBusqueda.length > 0 && (
              <div className="codb-search-results">
                <h3>Resultados de búsqueda:</h3>
                <ul>
                  {resultadosBusqueda.map((socio) => (
                    <li key={socio.id_socio}>
                      <button 
                        onClick={() => seleccionarSocio(socio)}
                        className="codb-result-item"
                      >
                        <span className="codb-result-name">{socio.nombre}</span>
                        <span className="codb-result-address">{socio.domicilio}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {socioEncontrado && (
              <div className="codb-member-info">
                <div className="codb-info-header">
                  <h3>Información del Socio</h3>
                  <div className="codb-member-id">ID: {socioEncontrado.id_socio}</div>
                </div>
                
                <div className="codb-info-grid">
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaUser /> Nombre:</div>
                    <div className="codb-info-value">{socioEncontrado.nombre}</div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaHome /> Domicilio:</div>
                    <div className="codb-info-value">{socioEncontrado.domicilio}</div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaPhone /> Teléfono:</div>
                    <div className="codb-info-value">{socioEncontrado.telefono}</div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaCalendarAlt /> Período:</div>
                    <div className="codb-info-value codb-badge">{socioEncontrado.id_periodo}</div>
                  </div>
                  <div className="codb-info-row">
                    <div className="codb-info-label"><FaMoneyBillWave /> Monto:</div>
                    <div className="codb-info-value codb-amount">$4,000.00</div>
                  </div>
                </div>

                <div className="codb-payment-button-container">
                  <button 
                    onClick={registrarPago} 
                    disabled={loading} 
                    className="codb-payment-button"
                  >
                    {loading ? (
                      <>
                        <FaSpinner className="codb-spinner" /> Procesando...
                      </>
                    ) : (
                      <>
                        <FaCheck /> Registrar Pago
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalCodigoBarras;