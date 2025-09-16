import React, { useEffect, useState } from 'react';
import BASE_URL from '../../../config/config';
import './ModalInfoSocio.css';

const ModalInfoSocio = ({ socio, onClose }) => {
  const [listas, setListas] = useState({
    categorias: [],
    categorias_monto: [],
    cobradores: [],
    estados: []
  });

  const [pestañaActiva, setPestañaActiva] = useState('datos');

  useEffect(() => {
    if (!socio) return;

    const obtenerListas = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=listas`);
        const data = await res.json();
        if (data.exito && data.listas) {
          setListas({
            categorias: data.listas.categorias || [],
            categorias_monto: data.listas.categorias_monto || [],
            cobradores: data.listas.cobradores || [],
            estados: data.listas.estados || []
          });
        } else {
          console.error('Error al obtener listas:', data.mensaje);
        }
      } catch (err) {
        console.error('Error de red:', err);
      }
    };

    obtenerListas();
  }, [socio, BASE_URL]);

  if (!socio) return null;

  const formatoFecha = (fecha) => {
    if (!fecha || fecha === '0000-00-00') return '-';
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
  };

  // Busca por "id" (default) y devuelve el campo solicitado
  const obtenerDescripcion = (lista, id, campo = 'descripcion', idField = 'id') => {
    if (!Array.isArray(lista)) return '-';
    const item = lista.find(el => String(el?.[idField]) === String(id));
    return item ? (item[campo] ?? '-') : '-';
  };

  // Formatea la categoría de monto: "Nombre — $mensual / anual $anual"
  const formatCatMonto = (lista, idCatMonto) => {
    if (!Array.isArray(lista)) return '-';
    const item = lista.find(el => String(el?.id_cat_monto) === String(idCatMonto));
    if (!item) return '-';
    const nombre = item.nombre_categoria ?? '-';
    const mensual = item.monto_mensual ?? '-';
    const anual = item.monto_anual ?? '-';
    return `${nombre} — $${mensual} / anual $${anual}`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-header-content">
            <h2 className="modal-title">Información del Socio</h2>
            <p className="modal-subtitle">ID: {socio.id_socio} | {socio.nombre}</p>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="modal-content">
          <div className="modal-tabs">
            <div
              className={`tab ${pestañaActiva === 'datos' ? 'active' : ''}`}
              onClick={() => setPestañaActiva('datos')}
            >
              Datos Generales
            </div>
            <div
              className={`tab ${pestañaActiva === 'contacto' ? 'active' : ''}`}
              onClick={() => setPestañaActiva('contacto')}
            >
              Contacto
            </div>
          </div>

          {pestañaActiva === 'datos' && (
            <div className="tab-content active">
              <div className="info-grid">
                <div className="info-card">
                  <h3 className="info-card-title">Datos Personales</h3>

                  <div className="info-item">
                    <span className="info-label">DNI:</span>
                    <span className="info-value">{socio.dni || '-'}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Nacimiento:</span>
                    <span className="info-value">{formatoFecha(socio.nacimiento)}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Familia:</span>
                    {/* viene del backend como `familia` (nombre_familia) */}
                    <span className="info-value">
                      {socio.familia && socio.familia.trim() !== '' ? socio.familia : '-'}
                    </span>
                  </div>
                </div>

                <div className="info-card">
                  <h3 className="info-card-title">Membresía</h3>

                  <div className="info-item">
                    <span className="info-label">Tipo de sangre:</span>
                    <span className="info-value">
                      {obtenerDescripcion(listas.categorias, socio.id_categoria)}
                    </span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Categoría (Cuota):</span>
                    <span className="info-value">
                      {formatCatMonto(listas.categorias_monto, socio.id_cat_monto)}
                    </span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Estado:</span>
                    <span className="info-value">
                      {obtenerDescripcion(listas.estados, socio.id_estado)}
                    </span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Ingreso:</span>
                    <span className="info-value">{formatoFecha(socio.ingreso)}</span>
                  </div>
                </div>

                <div className="info-card info-card-full">
                  <h3 className="info-card-title">Cobranza</h3>

                  <div className="info-item">
                    <span className="info-label">Cobrador:</span>
                    <span className="info-value">
                      {obtenerDescripcion(listas.cobradores, socio.id_cobrador, 'nombre')}
                    </span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Domicilio Cobro:</span>
                    <span className="info-value">{socio.domicilio_cobro || '-'}</span>
                  </div>

                  <div className="info-item comentario">
                    <span className="info-label">Comentario:</span>
                    <span className="info-value">
                      {(socio.comentario && socio.comentario.trim() !== '') ? socio.comentario : '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {pestañaActiva === 'contacto' && (
            <div className="tab-content active">
              <div className="info-grid">
                <div className="info-card">
                  <h3 className="info-card-title">Direcciones</h3>
                  <div className="info-item">
                    <span className="info-label">Domicilio:</span>
                    <span className="info-value">
                      {socio.domicilio || '-'} {socio.numero || ''}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Domicilio Cobro:</span>
                    <span className="info-value">{socio.domicilio_cobro || '-'}</span>
                  </div>
                </div>

                <div className="info-card">
                  <h3 className="info-card-title">Contacto</h3>
                  <div className="info-item">
                    <span className="info-label">Teléfono Móvil:</span>
                    <span className="info-value">{socio.telefono_movil || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Teléfono Fijo:</span>
                    <span className="info-value">{socio.telefono_fijo || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ModalInfoSocio;
