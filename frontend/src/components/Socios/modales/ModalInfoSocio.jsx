// src/components/socios/modales/ModalInfoSocio.jsx
import React, { useEffect, useState } from 'react';
import BASE_URL from '../../../config/config';

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

  const formatoFecha = (fecha) => {
    return fecha ? new Date(fecha).toLocaleDateString('es-AR') : '-';
  };

  const obtenerDescripcion = (lista, id, campo = 'descripcion') => {
    if (!Array.isArray(lista)) return '-';
    const item = lista.find(el => el.id == id);
    return item ? item[campo] : '-';
  };

  return (
    <div className="modal-info-overlay">
      <div className="modal-info-contenido">
        <h2>Información del Socio</h2>

        <div className="modal-info-datos">
          <p><strong>ID:</strong> {socio.id_socio}</p>
          <p><strong>Nombre:</strong> {socio.nombre}</p>
          <p><strong>DNI:</strong> {socio.dni || '-'}</p>
          <p><strong>Categoría:</strong> {obtenerDescripcion(listas.categorias, socio.id_categoria)}</p>
          <p><strong>Cobrador:</strong> {obtenerDescripcion(listas.cobradores, socio.id_cobrador, 'nombre')}</p>
          <p><strong>Estado:</strong> {obtenerDescripcion(listas.estados, socio.id_estado)}</p>
          <p><strong>Domicilio:</strong> {socio.domicilio} {socio.numero}</p>
          <p><strong>Domicilio de Cobro:</strong> {socio.domicilio_cobro}</p>
          <p><strong>Teléfono Móvil:</strong> {socio.telefono_movil}</p>
          <p><strong>Teléfono Fijo:</strong> {socio.telefono_fijo}</p>
          <p><strong>Nacimiento:</strong> {formatoFecha(socio.nacimiento)}</p>
          <p><strong>Ingreso:</strong> {socio.ingreso}</p>
          <p><strong>Deuda 2024:</strong> {socio.deuda_2024}</p>
          <p><strong>Periodo Adeudado:</strong> {obtenerDescripcion(listas.periodos, socio.id_periodo_adeudado)}</p>
          <p><strong>Comentario:</strong> {socio.comentario}</p>
        </div>

        <button onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
};

export default ModalInfoSocio;
