// ... imports
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import BASE_URL from '../../config/config';
import { FaDollarSign, FaPrint, FaSpinner, FaBarcode } from 'react-icons/fa';
import ModalPagos from './modales/ModalPagos';
import ModalCodigoBarras from './modales/ModalCodigoBarras';
import { imprimirRecibos } from '../../utils/imprimirRecibos';
import './Cuotas.css';

const Cuotas = () => {
  const [cuotas, setCuotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPrint, setLoadingPrint] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [estadoPagoSeleccionado, setEstadoPagoSeleccionado] = useState('deudor');
  const [estadoSocioSeleccionado, setEstadoSocioSeleccionado] = useState('');
  const [medioPagoSeleccionado, setMedioPagoSeleccionado] = useState('');
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('');
  const [mediosPago, setMediosPago] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [mostrarModalPagos, setMostrarModalPagos] = useState(false);
  const [mostrarModalCodigoBarras, setMostrarModalCodigoBarras] = useState(false);
  const [socioParaPagar, setSocioParaPagar] = useState(null);
  const navigate = useNavigate();

  const obtenerCuotasYListas = async () => {
    try {
      const [resCuotas, resListas] = await Promise.all([
        fetch(`${BASE_URL}/api.php?action=cuotas${estadoPagoSeleccionado === 'pagado' ? '&pagados=1' : ''}`),
        fetch(`${BASE_URL}/api.php?action=listas`),
      ]);

      const dataCuotas = await resCuotas.json();
      const dataListas = await resListas.json();

      if (dataCuotas.exito) setCuotas(dataCuotas.cuotas);
      if (dataListas.exito) {
        setMediosPago(dataListas.listas.cobradores.map(c => c.nombre));
        setPeriodos(dataListas.listas.periodos.map(p => p.nombre));
      }
    } catch (error) {
      console.error('Error al conectar con el servidor:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerCuotasYListas();
  }, [estadoPagoSeleccionado]);

  const cuotasFiltradas = useMemo(() => {
    if (!periodoSeleccionado) return [];

    return cuotas
      .filter((c) => c.mes === periodoSeleccionado)
      .filter((c) => {
        const coincideBusqueda = busqueda === '' || c.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const coincideEstadoSocio = estadoSocioSeleccionado === '' || c.estado === estadoSocioSeleccionado;
        const coincideMedio = medioPagoSeleccionado === '' || c.medio_pago === medioPagoSeleccionado;
        const coincideEstadoPago = estadoPagoSeleccionado === '' || c.estado_pago === estadoPagoSeleccionado;

        return coincideBusqueda && coincideEstadoSocio && coincideMedio && coincideEstadoPago;
      });
  }, [cuotas, busqueda, estadoSocioSeleccionado, medioPagoSeleccionado, periodoSeleccionado, estadoPagoSeleccionado]);

  const Row = ({ index, style, data }) => {
    const cuota = data[index];
    return (
      <div style={style} className="soc_tabla-fila">
        <div className="soc_col-nombre">{cuota.nombre}</div>
        <div className="soc_col-domicilio">{cuota.domicilio || '-'}</div>
        <div className="soc_col-comentario">
          <span className={cuota.estado === 'Activo' ? 'pagado' : 'deudor'}>
            {cuota.estado}
          </span>
        </div>
        <div className="soc_col-id">{cuota.medio_pago}</div>
        <div className="soc_col-acciones">
          <button onClick={() => {
            setSocioParaPagar(cuota);
            setMostrarModalPagos(true);
          }}>
            <FaDollarSign />
          </button>
          <button onClick={() => imprimirRecibos([cuota], periodoSeleccionado)}>
            <FaPrint />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="soc_container">
      <h2 className="soc_titulo">Gestión de Cuotas</h2>

      <div className="soc_barra-superior">
        <select value={periodoSeleccionado} onChange={(e) => setPeriodoSeleccionado(e.target.value)} className="soc_selector-letras">
          <option value="">📅 Seleccionar período</option>
          {periodos.map((p, i) => (
            <option key={i} value={p}>{p}</option>
          ))}
        </select>

        <div className="soc_tabs-estado-pago">
          <button
            className={`soc_tab ${estadoPagoSeleccionado === 'deudor' ? 'activo' : ''}`}
            onClick={() => setEstadoPagoSeleccionado('deudor')}
          >
            ❌ Deudores
          </button>
          <button
            className={`soc_tab ${estadoPagoSeleccionado === 'pagado' ? 'activo' : ''}`}
            onClick={() => setEstadoPagoSeleccionado('pagado')}
          >
            ✅ Pagados
          </button>
        </div>

        <select value={estadoSocioSeleccionado} onChange={(e) => setEstadoSocioSeleccionado(e.target.value)} className="soc_selector-letras">
          <option value="">📌 Seleccionar estado del socio</option>
          <option value="Activo">✅ Activos</option>
          <option value="Pasivo">🛑 Pasivos</option>
        </select>

        <select value={medioPagoSeleccionado} onChange={(e) => setMedioPagoSeleccionado(e.target.value)} className="soc_selector-letras">
          <option value="">🎯 Seleccionar medio de pago</option>
          {mediosPago.map((m, i) => (
            <option key={i} value={m}>{m}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="soc_buscador"
          disabled={loading}
        />

        <button className="soc_boton" onClick={() => navigate('/panel')}>🔙 Volver</button>

        <button
          className="soc_boton"
          onClick={() => setMostrarModalCodigoBarras(true)}
        >
          <FaBarcode /> Código de Barras
        </button>

        <button
          className="soc_boton"
          onClick={async () => {
            setLoadingPrint(true);
            await imprimirRecibos(cuotasFiltradas, periodoSeleccionado);
            setLoadingPrint(false);
          }}
          disabled={loadingPrint}
        >
          {loadingPrint ? (
            <>
              <FaSpinner className="spinner" /> Generando...
            </>
          ) : (
            <>
              <FaPrint /> Imprimir todos
            </>
          )}
        </button>
      </div>

      <p className="soc_contador">Total de resultados: <strong>{cuotasFiltradas.length}</strong></p>

      {loading ? (
        <p className="soc_cargando">Cargando cuotas...</p>
      ) : (
        <div className="soc_tabla-container">
          <div className="soc_tabla-header">
            <div className="soc_col-nombre">Socio</div>
            <div className="soc_col-domicilio">Dirección</div>
            <div className="soc_col-comentario">Estado</div>
            <div className="soc_col-id">Medio de Pago</div>
            <div className="soc_col-acciones">Acciones</div>
          </div>

          {cuotasFiltradas.length === 0 ? (
            <div className="soc_sin-resultados">No se encontraron resultados</div>
          ) : (
            <List
              height={600}
              itemCount={cuotasFiltradas.length}
              itemSize={60}
              width="100%"
              itemData={cuotasFiltradas}
            >
              {Row}
            </List>
          )}
        </div>
      )}

      {mostrarModalPagos && (
        <ModalPagos
          socio={socioParaPagar}
          onClose={() => {
            setMostrarModalPagos(false);
            obtenerCuotasYListas();
          }}
        />
      )}

      {mostrarModalCodigoBarras && (
        <ModalCodigoBarras
          onClose={() => setMostrarModalCodigoBarras(false)}
          periodo={periodoSeleccionado}
          onPagoRealizado={obtenerCuotasYListas}
        />
      )}
    </div>
  );
};

export default Cuotas;