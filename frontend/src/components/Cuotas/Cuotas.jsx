import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import BASE_URL from '../../config/config';
import { FaDollarSign, FaPrint, FaSpinner, FaBarcode, FaSearch, FaCalendarAlt, FaFilter, FaUndo, FaSort, FaUsers } from 'react-icons/fa';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
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
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(false);
  const [orden, setOrden] = useState({ campo: 'nombre', ascendente: true });
  const navigate = useNavigate();

  const obtenerCuotasYListas = async () => {
    try {
      setLoading(true);
      const [resCuotas, resListas] = await Promise.all([
        fetch(`${BASE_URL}/api.php?action=cuotas${estadoPagoSeleccionado === 'pagado' ? '&pagados=1' : ''}`),
        fetch(`${BASE_URL}/api.php?action=listas`),
      ]);

      const dataCuotas = await resCuotas.json();
      const dataListas = await resListas.json();

      if (dataCuotas.exito) {
        setCuotas(dataCuotas.cuotas);
        if (dataListas.exito && dataListas.listas.periodos.length > 0) {
          setPeriodoSeleccionado(dataListas.listas.periodos[0].id);
        }
      }
      if (dataListas.exito) {
        setMediosPago(dataListas.listas.cobradores.map(c => c.nombre));
        setPeriodos(dataListas.listas.periodos.map(p => ({
          id: p.id,
          nombre: p.nombre
        })));
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

    const cuotasFiltradas = cuotas
      .filter((c) => String(c.id_periodo) === String(periodoSeleccionado))
      .filter((c) => {
        const coincideBusqueda = busqueda === '' || 
          c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          c.domicilio?.toLowerCase().includes(busqueda.toLowerCase()) ||
          c.documento?.toLowerCase().includes(busqueda.toLowerCase());
        const coincideEstadoSocio = estadoSocioSeleccionado === '' || c.estado === estadoSocioSeleccionado;
        const coincideMedio = medioPagoSeleccionado === '' || c.medio_pago === medioPagoSeleccionado;
        const coincideEstadoPago = estadoPagoSeleccionado === '' || c.estado_pago === estadoPagoSeleccionado;

        return coincideBusqueda && coincideEstadoSocio && coincideMedio && coincideEstadoPago;
      });

    return cuotasFiltradas.sort((a, b) => {
      const campoA = orden.campo === 'nombre' ? a.nombre : a.domicilio || '';
      const campoB = orden.campo === 'nombre' ? b.nombre : b.domicilio || '';
      
      if (orden.ascendente) {
        return campoA.localeCompare(campoB);
      } else {
        return campoB.localeCompare(campoA);
      }
    });
  }, [cuotas, busqueda, estadoSocioSeleccionado, medioPagoSeleccionado, periodoSeleccionado, estadoPagoSeleccionado, orden]);

  const toggleOrden = (campo) => {
    setOrden(prev => ({
      campo,
      ascendente: prev.campo === campo ? !prev.ascendente : true
    }));
  };

  const Row = ({ index, style, data }) => {
    const cuota = data[index];
    return (
      <div 
        style={style} 
        className={`cuo_tabla-fila ${index % 2 === 0 ? 'cuo_fila-par' : 'cuo_fila-impar'}`}
      >
        <div className="cuo_col-nombre">
          <div className="cuo_nombre-socio">{cuota.nombre}</div>
          {cuota.documento && <div className="cuo_documento">Doc: {cuota.documento}</div>}
        </div>
        <div className="cuo_col-domicilio">{cuota.domicilio || '-'}</div>
        <div className="cuo_col-estado">
          <span className={`cuo_badge ${cuota.estado === 'Activo' ? 'cuo_badge-success' : 'cuo_badge-danger'}`}>
            {cuota.estado}
          </span>
        </div>
        <div className="cuo_col-medio-pago">
          <span className={`cuo_badge ${cuota.medio_pago ? 'cuo_badge-info' : 'cuo_badge-warning'}`}>
            {cuota.medio_pago || 'Sin especificar'}
          </span>
        </div>
        <div className="cuo_col-acciones">
          <div className="cuo_acciones-cell">
            {estadoPagoSeleccionado === 'deudor' && (
              <button 
                className="cuo_boton-accion cuo_boton-accion-success"
                onClick={() => {
                  setSocioParaPagar(cuota);
                  setMostrarModalPagos(true);
                }}
                title="Registrar pago"
              >
                <FaDollarSign />
              </button>
            )}
            <button 
              className="cuo_boton-accion cuo_boton-accion-primary"
              onClick={() => imprimirRecibos([cuota], getNombrePeriodo(periodoSeleccionado))}
              title="Imprimir recibo"
            >
              <FaPrint />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const limpiarFiltros = () => {
    setBusqueda('');
    setEstadoSocioSeleccionado('');
    setMedioPagoSeleccionado('');
  };

  const toggleFiltros = () => {
    setFiltrosExpandidos(!filtrosExpandidos);
  };

  const getNombrePeriodo = (id) => {
    const periodo = periodos.find(p => String(p.id) === String(id));
    return periodo ? periodo.nombre : id;
  };

  return (
    <div className="cuo_app-container">
      {/* Panel de filtros */}
      <div className={`cuo_filtros-panel ${filtrosExpandidos ? 'cuo_filtros-expandidos' : ''}`}>
        <div className="cuo_filtros-header">
          <h3 className="cuo_filtros-titulo">
            <FaFilter className="cuo_filtro-icono" />
            Filtros Avanzados
          </h3>
          <div className="cuo_filtros-controles">
            <button 
              className="cuo_boton cuo_boton-secondary cuo_boton-icono"
              onClick={() => navigate('/panel')}
              title="Volver al panel"
            >
              <FaUndo />
            </button>
            <button 
              className="cuo_boton cuo_boton-icono cuo_boton-toggle"
              onClick={toggleFiltros}
              title={filtrosExpandidos ? 'Ocultar filtros' : 'Mostrar filtros'}
            >
              {filtrosExpandidos ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>
        </div>

        <div className="cuo_filtro-grupo">
          <label className="cuo_filtro-label">
            <FaCalendarAlt className="cuo_filtro-icono" />
            Período
          </label>
          <select 
            value={periodoSeleccionado} 
            onChange={(e) => setPeriodoSeleccionado(e.target.value)} 
            className="cuo_filtro-select"
            disabled={loading}
          >
            <option value="">Seleccionar período</option>
            {periodos.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div className="cuo_tabs-container">
          <label className="cuo_filtro-label">
            <FaFilter className="cuo_filtro-icono" />
            Estado de Pago
          </label>
          <div className="cuo_tabs-estado-pago">
            <button
              className={`cuo_tab ${estadoPagoSeleccionado === 'deudor' ? 'cuo_tab-activo' : ''}`}
              onClick={() => setEstadoPagoSeleccionado('deudor')}
              disabled={loading}
            >
              Deudores
            </button>
            <button
              className={`cuo_tab ${estadoPagoSeleccionado === 'pagado' ? 'cuo_tab-activo' : ''}`}
              onClick={() => setEstadoPagoSeleccionado('pagado')}
              disabled={loading}
            >
              Pagados
            </button>
          </div>
        </div>

        <div className="cuo_filtro-grupo">
          <label className="cuo_filtro-label">
            <FaFilter className="cuo_filtro-icono" />
            Estado del Socio
          </label>
          <select 
            value={estadoSocioSeleccionado} 
            onChange={(e) => setEstadoSocioSeleccionado(e.target.value)} 
            className="cuo_filtro-select"
            disabled={loading}
          >
            <option value="">Todos los estados</option>
            <option value="Activo">Activos</option>
            <option value="Pasivo">Pasivos</option>
          </select>
        </div>

        <div className="cuo_filtro-grupo">
          <label className="cuo_filtro-label">
            <FaFilter className="cuo_filtro-icono" />
            Medio de Pago
          </label>
          <select 
            value={medioPagoSeleccionado} 
            onChange={(e) => setMedioPagoSeleccionado(e.target.value)} 
            className="cuo_filtro-select"
            disabled={loading}
          >
            <option value="">Todos los medios</option>
            {mediosPago.map((m, i) => (
              <option key={i} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="cuo_filtro-acciones">
          <button 
            className="cuo_boton cuo_boton-light cuo_boton-limpiar"
            onClick={limpiarFiltros}
            disabled={loading}
          >
            Limpiar Filtros
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="cuo_main-content">
        <div className="cuo_content-header">
          <div className="cuo_header-top">
            <h2 className="cuo_content-title">
              Gestión de Cuotas 
              {periodoSeleccionado && (
                <span className="cuo_periodo-seleccionado"> - {getNombrePeriodo(periodoSeleccionado)}</span>
              )}
            </h2>
            
            <div className="cuo_contador-socios">
              <div className="cuo_contador-icono">
                <FaUsers />
              </div>
              <div className="cuo_contador-texto">
                {cuotasFiltradas.length} {cuotasFiltradas.length === 1 ? 'socio' : 'socios'}
              </div>
            </div>
          </div>

          <div className="cuo_header-bottom">
            <div className="cuo_buscador-container">
              <FaSearch className="cuo_buscador-icono" />
              <input
                type="text"
                placeholder="Buscar socio por nombre, documento o dirección..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="cuo_buscador-input"
                disabled={loading}
              />
            </div>

            <div className="cuo_content-actions">
              <button
                className="cuo_boton cuo_boton-success"
                onClick={() => setMostrarModalCodigoBarras(true)}
                disabled={!periodoSeleccionado || loading}
              >
                <FaBarcode /> Código de Barras
              </button>

              <button
                className="cuo_boton cuo_boton-warning"
                onClick={async () => {
                  setLoadingPrint(true);
                  await imprimirRecibos(cuotasFiltradas, getNombrePeriodo(periodoSeleccionado));
                  setLoadingPrint(false);
                }}
                disabled={loadingPrint || !periodoSeleccionado || cuotasFiltradas.length === 0 || loading}
              >
                {loadingPrint ? (
                  <>
                    <FaSpinner className="cuo_spinner" /> Imprimiendo...
                  </>
                ) : (
                  <>
                    <FaPrint /> Imprimir todos
                  </>
                )}
              </button>

              <button 
                className="cuo_boton cuo_boton-primary cuo_boton-icono"
                onClick={toggleFiltros}
                title={filtrosExpandidos ? 'Ocultar filtros' : 'Mostrar filtros'}
              >
                <FaFilter />
              </button>
            </div>
          </div>
        </div>

        <div className="cuo_tabla-container">
          {loading ? (
            <div className="cuo_estado-container">
              <FaSpinner className="cuo_spinner" size={24} />
              <p className="cuo_estado-mensaje">Cargando cuotas...</p>
            </div>
          ) : (
            <div className="cuo_tabla-wrapper">
              {cuotasFiltradas.length === 0 ? (
                <div className="cuo_estado-container">
                  <p className="cuo_estado-mensaje">
                    {periodoSeleccionado 
                      ? 'No se encontraron resultados con los filtros actuales' 
                      : 'Seleccione un período para mostrar las cuotas'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="cuo_tabla-header">
                    <div 
                      className="cuo_col-nombre" 
                      onClick={() => toggleOrden('nombre')}
                    >
                      Socio 
                      <FaSort className={`cuo_icono-orden ${orden.campo === 'nombre' ? 'cuo_icono-orden-activo' : ''}`} />
                      {orden.campo === 'nombre' && (orden.ascendente ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />)}
                    </div>
                    <div 
                      className="cuo_col-domicilio"
                      onClick={() => toggleOrden('domicilio')}
                    >
                      Dirección
                      <FaSort className={`cuo_icono-orden ${orden.campo === 'domicilio' ? 'cuo_icono-orden-activo' : ''}`} />
                      {orden.campo === 'domicilio' && (orden.ascendente ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />)}
                    </div>
                    <div className="cuo_col-estado">Estado</div>
                    <div className="cuo_col-medio-pago">Medio de Pago</div>
                    <div className="cuo_col-acciones">Acciones</div>
                  </div>

                  <div className="cuo_list-container">
                    <AutoSizer>
                      {({ height, width }) => (
                        <List
                          height={height}
                          itemCount={cuotasFiltradas.length}
                          itemSize={70}
                          width={width}
                          itemData={cuotasFiltradas}
                        >
                          {Row}
                        </List>
                      )}
                    </AutoSizer>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

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
          periodo={getNombrePeriodo(periodoSeleccionado)}
          onPagoRealizado={obtenerCuotasYListas}
        />
      )}
    </div>
  );
};

export default Cuotas;