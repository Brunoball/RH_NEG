import React, { useEffect, useState } from 'react';
import BASE_URL from '../../../config/config';
import './ModalInfoSocio.css';

const ModalInfoSocio = ({ socio, onClose }) => {
  const [listas, setListas] = useState({
    categorias: [],
    cobradores: [],
    estados: [],
    periodos: []
  });

  useEffect(() => {
    if (!socio) return;

    const obtenerListas = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=listas`);
        const data = await res.json();
        if (data.exito && data.listas) {
          setListas({
            categorias: data.listas.categorias || [],
            cobradores: data.listas.cobradores || [],
            estados: data.listas.estados || [],
            periodos: data.listas.periodos || []
          });
        } else {
          console.error('Error al obtener listas:', data.mensaje);
        }
      } catch (err) {
        console.error('Error de red:', err);
      }
    };

    obtenerListas();
  }, [socio]);

  if (!socio) return null;

  // ✅ Arreglado para evitar desfase horario
  const formatoFecha = (fecha) => {
    if (!fecha) return '-';
    const [year, month, day] = fecha.split('-');
    return `${day}/${month}/${year}`;
  };

  const obtenerDescripcion = (lista, id, campo = 'descripcion') => {
    if (!Array.isArray(lista)) return '-';
    const item = lista.find(el => el.id == id);
    return item ? item[campo] : '-';
  };

  return (
    <div className="ModalInfo-overlay">
      <div className="ModalInfo-container">
        <div className="ModalInfo-header">
          <h2 className="ModalInfo-title">Información del Socio</h2>
          <button 
            className="ModalInfo-closeButton" 
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            &times;
          </button>
        </div>

        <div className="ModalInfo-content">
          <div className="ModalInfo-section">
            <h3 className="ModalInfo-sectionTitle">Datos Personales</h3>
            <div className="ModalInfo-grid">
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">ID:</span>
                <span className="ModalInfo-value">{socio.id_socio}</span>
              </div>
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Nombre:</span>
                <span className="ModalInfo-value">{socio.nombre}</span>
              </div>
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">DNI:</span>
                <span className="ModalInfo-value">{socio.dni || '-'}</span>
              </div>
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Nacimiento:</span>
                <span className="ModalInfo-value">{formatoFecha(socio.nacimiento)}</span>
              </div>
            </div>
          </div>

          <div className="ModalInfo-section">
            <h3 className="ModalInfo-sectionTitle">Datos de Membresía</h3>
            <div className="ModalInfo-grid">
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Categoría:</span>
                <span className="ModalInfo-value">{obtenerDescripcion(listas.categorias, socio.id_categoria)}</span>
              </div>
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Estado:</span>
                <span className="ModalInfo-value">{obtenerDescripcion(listas.estados, socio.id_estado)}</span>
              </div>
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Ingreso:</span>
                <span className="ModalInfo-value">{formatoFecha(socio.ingreso)}</span>
              </div>
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Cobrador:</span>
                <span className="ModalInfo-value">{obtenerDescripcion(listas.cobradores, socio.id_cobrador, 'nombre')}</span>
              </div>
            </div>
          </div>

          <div className="ModalInfo-section">
            <h3 className="ModalInfo-sectionTitle">Contacto</h3>
            <div className="ModalInfo-grid">
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Domicilio:</span>
                <span className="ModalInfo-value">{socio.domicilio} {socio.numero}</span>
              </div>
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Domicilio de Cobro:</span>
                <span className="ModalInfo-value">{socio.domicilio_cobro}</span>
              </div>
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Teléfono Móvil:</span>
                <span className="ModalInfo-value">{socio.telefono_movil}</span>
              </div>
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Teléfono Fijo:</span>
                <span className="ModalInfo-value">{socio.telefono_fijo}</span>
              </div>
            </div>
          </div>

          <div className="ModalInfo-section">
            <h3 className="ModalInfo-sectionTitle">Finanzas</h3>
            <div className="ModalInfo-grid">
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Deuda 2024:</span>
                <span className="ModalInfo-value">{socio.deuda_2024}</span>
              </div>
              <div className="ModalInfo-item">
                <span className="ModalInfo-label">Periodo Adeudado:</span>
                <span className="ModalInfo-value">{obtenerDescripcion(listas.periodos, socio.id_periodo_adeudado)}</span>
              </div>
            </div>
          </div>

          {socio.comentario && (
            <div className="ModalInfo-section">
              <h3 className="ModalInfo-sectionTitle">Comentario</h3>
              <div className="ModalInfo-comment">
                {socio.comentario}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalInfoSocio;
