import React, { useEffect, useState } from 'react';
import BASE_URL from '../../../config/config';
import './ModalPagos.css';

const ModalPagos = ({ socio, onClose }) => {
  const [periodos, setPeriodos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [periodosPagados, setPeriodosPagados] = useState([]);
  const [fechaIngreso, setFechaIngreso] = useState('');

  useEffect(() => {
    const fetchDatos = async () => {
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
          alert('Error al obtener períodos pagados: ' + dataPagados.mensaje);
        }
      } catch (error) {
        console.error('Error al obtener datos:', error);
        alert('Error de red');
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
      alert("Debes seleccionar al menos un período");
      return;
    }

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
        alert('✅ Pago registrado correctamente');
        onClose();
      } else {
        alert('❌ Error: ' + data.mensaje);
      }
    } catch (error) {
      console.error('Error al registrar el pago:', error);
      alert('❌ Error de red al registrar el pago');
    }
  };

  if (!socio) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-contenido">
        <h2>💲 Modal de Pago</h2>
        <p>Estás por registrar un pago para:</p>
        <h3>{socio.nombre}</h3>
        {fechaIngreso && <p><strong>Ingreso:</strong> {fechaIngreso}</p>}

        <div className="lista-periodos">
          <p><strong>Seleccioná los períodos a pagar:</strong></p>
          {periodos.map((periodo) => {
            const yaPagado = periodosPagados.includes(periodo.id);
            return (
              <label
                key={periodo.id}
                className={`checkbox-periodo ${yaPagado ? 'deshabilitado' : ''}`}
              >
                <input
                  type="checkbox"
                  value={periodo.id}
                  checked={seleccionados.includes(periodo.id)}
                  onChange={() => togglePeriodo(periodo.id)}
                  disabled={yaPagado}
                />
                {periodo.nombre} {yaPagado ? ' (Pagado)' : ''}
              </label>
            );
          })}
        </div>

        <div className="modal-botones">
          <button className="btn-cancelar" onClick={onClose}>❌ Cancelar</button>
          <button className="btn-confirmar" onClick={confirmarPago}>✅ Confirmar Pago</button>
        </div>
      </div>
    </div>
  );
};

export default ModalPagos;
