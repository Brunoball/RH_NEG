import React, { useEffect, useState } from 'react';
import BASE_URL from '../../config/config';
import './Cuotas.css';
import { FaDollarSign, FaPrint } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const Cuotas = () => {
  const [cuotas, setCuotas] = useState([]); // No se usarán por ahora
  const [cuotasFiltradas, setCuotasFiltradas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('deudor');
  const [medioPagoSeleccionado, setMedioPagoSeleccionado] = useState('');
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');
  const [mediosPago, setMediosPago] = useState([]);
  const [periodos, setPeriodos] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    const obtenerListas = async () => {
      setLoading(true);
      try {
        const resListas = await fetch(`${BASE_URL}/api.php?action=listas`);
        const data = await resListas.json();

        if (data.exito) {
          setMediosPago(data.listas.cobradores.map(c => c.nombre));
          setPeriodos(data.listas.periodos.map(p => p.descripcion));
        } else {
          console.error('Error al obtener listas:', data.mensaje);
        }
      } catch (error) {
        console.error('Error al conectar con el servidor:', error);
      } finally {
        setLoading(false);
      }
    };

    obtenerListas();
  }, []);

  const imprimirCuota = (cuota) => {
    alert(`🖨 Imprimir cuota: ${cuota.nombre}`);
  };

  const pagarCuota = (cuota) => {
    alert(`💲 Pagar cuota: ${cuota.nombre}`);
  };

  const imprimirTodos = () => {
    alert('🖨 Imprimir todos los resultados actuales');
  };

  return (
    <div className="cuotas-container">
      <h2 className="titulo-cuotas">📋 Gestión de Cuotas</h2>

      <div className="cuotas-controles">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="estado-toggle">
          <button
            className={filtroEstado === 'pagado' ? 'activo' : ''}
            onClick={() => setFiltroEstado('pagado')}
          >
            ✅ Pagados
          </button>
          <button
            className={filtroEstado === 'deudor' ? 'activo' : ''}
            onClick={() => setFiltroEstado('deudor')}
          >
            ❌ Deudores
          </button>
        </div>

        <select value={medioPagoSeleccionado} onChange={(e) => setMedioPagoSeleccionado(e.target.value)}>
          <option value="">🎯 Todos los medios</option>
          {mediosPago.map((nombre, i) => (
            <option key={i} value={nombre}>{nombre}</option>
          ))}
        </select>

        <select value={periodoSeleccionado} onChange={(e) => setPeriodoSeleccionado(e.target.value)}>
          <option value="">📅 Todos los periodos</option>
          {periodos.map((p, i) => (
            <option key={i} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="spinner">⏳ Cargando opciones...</div>
      ) : (
        <div className="cuotas-tabla-container">
          <table className="cuotas-tabla">
            <thead>
              <tr>
                <th>Socio</th>
                <th>Mes</th>
                <th>Año</th>
                <th>Estado</th>
                <th>Monto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                  🔕 Aún no hay cuotas cargadas.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="cuotas-botones">
        <button onClick={() => navigate('/panel')}>🔙 Volver</button>
        <button onClick={imprimirTodos}>🖨 Imprimir Todos</button>
      </div>
    </div>
  );
};

export default Cuotas;
