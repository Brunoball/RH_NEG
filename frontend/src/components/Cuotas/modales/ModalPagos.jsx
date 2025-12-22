// src/components/Cuotas/modales/ModalPagos.jsx
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { FaCoins, FaCalendarAlt } from 'react-icons/fa';
import BASE_URL from '../../../config/config';
import Toast from '../../Global/Toast';
import './ModalPagos.css';
import { imprimirRecibosUnicos } from '../../../utils/Recibosunicos';
import { generarReciboPDFUnico } from '../../../utils/ReciboPDF';

// ======= CONSTANTES LÓGICAS (no montos) =======
const ID_CONTADO_ANUAL = 7;
const MIN_YEAR = 2025;

// URL de la CABECERA para el PDF
const HEADER_IMG_URL = `${BASE_URL}/assets/cabecera_rh.png`;

const getSocioId = (s) => {
  const v = s?.id_socio ?? s?.idSocio ?? s?.idsocio ?? s?.id ?? null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const getCatMontoId = (s) => {
  const v = s?.id_cat_monto ?? s?.idCatMonto ?? s?.id_categoria_monto ?? s?.idCategoriaMonto ?? null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const obtenerPrimerMesDesdeNombre = (nombre) => {
  const match = String(nombre || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
};

const construirListaAnios = (nowYear) => {
  const start = MIN_YEAR;
  const end = nowYear + 4;
  const arr = [];
  for (let y = start; y <= end; y++) arr.push(y);
  return arr;
};

const ventanaAnualActiva = () => {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const startActual = new Date(y, 11, 15);
  const endSiguiente = new Date(y + 1, 2, 1);
  if (hoy >= startActual && hoy < endSiguiente) return true;

  const startPrev = new Date(y - 1, 11, 15);
  const endActual = new Date(y, 2, 1);
  if (hoy >= startPrev && hoy < endActual) return true;

  return false;
};

const parseIngresoYM = (fechaStr) => {
  if (!fechaStr) return null;

  let m = String(fechaStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const anio = Number(m[1]);
    const mes = Number(m[2]);
    if (Number.isFinite(anio) && Number.isFinite(mes)) return { anio, mes };
  }

  m = String(fechaStr).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const mes = Number(m[2]);
    const anio = Number(m[3]);
    if (Number.isFinite(anio) && Number.isFinite(mes)) return { anio, mes };
  }

  const d = new Date(fechaStr);
  if (!Number.isNaN(d.getTime())) {
    return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
  }

  return null;
};

const ModalPagos = ({
  socio,
  onClose,

  // ✅ contexto desde Cuotas
  anioContexto,
  periodoContexto,

  // ✅ NUEVO
  modoInicial = 'cuotas', // 'cuotas' | 'inscripcion'
}) => {
  const nowYear = new Date().getFullYear();

  // ✅ modo
  const [modo, setModo] = useState(modoInicial);

  const [periodos, setPeriodos] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [periodosPagados, setPeriodosPagados] = useState([]);
  const [estadosPorPeriodo, setEstadosPorPeriodo] = useState({});
  const [fechaIngreso, setFechaIngreso] = useState('');
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState(null);
  const [todosSeleccionados, setTodosSeleccionados] = useState(false);
  const [pagoExitoso, setPagoExitoso] = useState(false);

  // Montos desde DB
  const [montoMensual, setMontoMensual] = useState(0);
  const [montoAnual, setMontoAnual] = useState(0);
  const [montosListos, setMontosListos] = useState(false);

  // montos por período
  const [montosPorPeriodo, setMontosPorPeriodo] = useState({});
  const [montosPeriodosListos, setMontosPeriodosListos] = useState(false);

  // condonar (solo cuotas)
  const [condonar, setCondonar] = useState(false);

  // ✅ INSCRIPCIÓN: monto libre
  const [montoInscripcion, setMontoInscripcion] = useState(6000);

  // ✅ NUEVO: estado inscripción (pagada o no)
  const [inscripcionPagada, setInscripcionPagada] = useState(false);
  const [inscripcionInfo, setInscripcionInfo] = useState(null); // {monto, fecha_pago, id_medio_pago}

  // ✅ Medios de pago (con ID)
  const [mediosPago, setMediosPago] = useState([]); // [{id, nombre}]
  const [medioPagoSeleccionado, setMedioPagoSeleccionado] = useState(''); // value = id (string)

  // Año de trabajo
  const [anioTrabajo, setAnioTrabajo] = useState(() => {
    const y = Number(anioContexto);
    return Number.isFinite(y) && y >= MIN_YEAR ? y : Math.max(nowYear, MIN_YEAR);
  });

  const [showYearPicker, setShowYearPicker] = useState(false);
  const yearOptions = useMemo(() => construirListaAnios(nowYear), [nowYear]);

  // Modo salida
  const [modoSalida, setModoSalida] = useState('imprimir');
  const [showConfirm, setShowConfirm] = useState(false);

  // anti-race montos
  const montosAbortRef = useRef(null);
  const montosReqIdRef = useRef(0);
  const montosCacheRef = useRef(new Map());

  const montosPeriodoAbortRef = useRef(null);
  const montosPeriodoReqIdRef = useRef(0);
  const montosPeriodoCacheRef = useRef(new Map());

  const esOficina = useMemo(() => {
    const cobrador = socio?.cobrador || socio?.medio_pago || '';
    return String(cobrador).toLowerCase() === 'oficina';
  }, [socio]);

  // ✅ REGLA:
  // - En "inscripcion" SIEMPRE selector de medio de pago
  // - En cuotas solo si esOficina
  const mostrarSelectorMedioPago = modo === 'inscripcion' || esOficina;

  const medioPagoNombreSeleccionado = useMemo(() => {
    const id = Number(medioPagoSeleccionado);
    if (!Number.isFinite(id) || id <= 0) return '';
    const found = (mediosPago || []).find((m) => Number(m.id) === id);
    return found?.nombre || '';
  }, [medioPagoSeleccionado, mediosPago]);

  const medioPagoNombrePorId = (id) => {
    const n = Number(id);
    if (!Number.isFinite(n) || n <= 0) return '';
    const found = (mediosPago || []).find((m) => Number(m.id) === n);
    return found?.nombre || '';
  };

  const mostrarToast = (tipo, mensaje, duracion = 3000) => {
    setToast({ tipo, mensaje, duracion });
  };

  // ✅ Inscripción: NO se elige año (se paga una sola vez)
  useEffect(() => {
    if (modo === 'inscripcion') {
      setShowYearPicker(false);
      setAnioTrabajo(nowYear);
    }
  }, [modo, nowYear]);

  // ===== Cargar medios de pago desde listas =====
  useEffect(() => {
    const fetchMediosPago = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api.php?action=listas`);
        const data = await res.json();

        if (data?.exito && Array.isArray(data?.listas?.medios_pago)) {
          const medios = data.listas.medios_pago
            .map((m) => ({
              id: Number(m?.id_medio_pago ?? m?.id ?? m?.value ?? 0),
              nombre: String(m?.nombre ?? m?.label ?? '').trim(),
            }))
            .filter((m) => Number.isFinite(m.id) && m.id > 0 && m.nombre);

          setMediosPago(medios);
          // NO reseteamos si ya hay uno seleccionado (ej: inscripción pagada)
          setMedioPagoSeleccionado((prev) => prev || '');
          return;
        }

        // fallback viejo (por si todavía no está medios_pago con id)
        if (data?.exito && Array.isArray(data?.listas?.cobradores)) {
          const medios = data.listas.cobradores
            .map((c, idx) => ({ id: idx + 1, nombre: String(c?.nombre ?? '').trim() }))
            .filter((m) => m.nombre);

          setMediosPago(medios);
          setMedioPagoSeleccionado((prev) => prev || '');
        }
      } catch (error) {
        console.error('Error al cargar medios de pago:', error);
      }
    };

    if (mostrarSelectorMedioPago) {
      fetchMediosPago();
    } else {
      setMediosPago([]);
      setMedioPagoSeleccionado('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarSelectorMedioPago]);

  // ✅ si abrís en modo inscripción, no tiene sentido condonar
  useEffect(() => {
    if (modo === 'inscripcion') {
      setCondonar(false);
      setSeleccionados([]);
    }
  }, [modo]);

  // ✅ Período referencia para montos base
  const periodoReferencia = useMemo(() => {
    if (seleccionados.includes(ID_CONTADO_ANUAL)) return ID_CONTADO_ANUAL;
    const sinAnual = seleccionados.filter((x) => x !== ID_CONTADO_ANUAL);
    if (sinAnual.length > 0) return sinAnual.slice().sort((a, b) => a - b)[0];
    const ctx = Number(periodoContexto);
    return Number.isFinite(ctx) ? ctx : 0;
  }, [seleccionados, periodoContexto]);

  const buildMontosQS = (idPeriodo) => {
    const qs = new URLSearchParams();

    const idSocio = getSocioId(socio);
    const idCatMonto = getCatMontoId(socio);

    if (idCatMonto) qs.set('id_cat_monto', String(idCatMonto));
    if (idSocio) qs.set('id_socio', String(idSocio));

    qs.set('anio', String(anioTrabajo));
    if (idPeriodo) qs.set('id_periodo', String(idPeriodo));

    return qs.toString();
  };

  const buildMontosCacheKey = (idPeriodo) => {
    const idCatMonto = getCatMontoId(socio) || 0;
    const idSocio = getSocioId(socio) || 0;
    return `anio=${anioTrabajo}|periodo=${idPeriodo || 0}|id_cat_monto=${idCatMonto}|id_socio=${idSocio}`;
  };

  // ====== 1) Montos base ======
  const refrescarMontosActuales = async () => {
    try {
      const cacheKey = buildMontosCacheKey(periodoReferencia || 0);

      const cached = montosCacheRef.current.get(cacheKey);
      if (cached) {
        setMontoMensual(Number(cached.mensual) || 0);
        setMontoAnual(Number(cached.anual) || 0);
        setMontosListos(true);
      } else {
        setMontosListos(false);
      }

      if (montosAbortRef.current) {
        try { montosAbortRef.current.abort(); } catch {}
      }

      const ctrl = new AbortController();
      montosAbortRef.current = ctrl;

      const reqId = ++montosReqIdRef.current;

      const res = await fetch(
        `${BASE_URL}/api.php?action=montos&${buildMontosQS(periodoReferencia || 0)}`,
        { signal: ctrl.signal }
      );
      const data = await res.json();

      if (reqId !== montosReqIdRef.current) return;

      if (data?.exito) {
        const mens = Number(data.mensual) || 0;
        const anua = Number(data.anual) || 0;

        montosCacheRef.current.set(cacheKey, { mensual: mens, anual: anua });

        setMontoMensual(mens);
        setMontoAnual(anua);
        setMontosListos(true);
      } else {
        setMontosListos(false);
        mostrarToast('advertencia', data?.mensaje || 'No se pudieron obtener los montos.');
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setMontosListos(false);
      mostrarToast('error', 'Error al consultar montos.');
    }
  };

  useEffect(() => {
    if (!socio) return;
    if (modo !== 'cuotas') return;
    refrescarMontosActuales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socio, anioTrabajo, periodoReferencia, modo]);

  // Carga inicial (periodos_pagados + INSCRIPCIÓN pagada)
  useEffect(() => {
    const fetchDatos = async () => {
      setCargando(true);
      try {
        const idSocio = getSocioId(socio);
        if (!idSocio) {
          mostrarToast('error', 'El socio no tiene un ID válido (id_socio / id).');
          setPeriodos([]);
          setEstadosPorPeriodo({});
          setPeriodosPagados([]);
          setFechaIngreso('');
          setInscripcionPagada(false);
          setInscripcionInfo(null);
          return;
        }

        const [resListas, resPagados] = await Promise.all([
          fetch(`${BASE_URL}/api.php?action=listas`),
          fetch(`${BASE_URL}/api.php?action=periodos_pagados&id_socio=${idSocio}&anio=${anioTrabajo}`),
        ]);

        const dataListas = await resListas.json();
        const dataPagados = await resPagados.json();

        if (dataListas.exito) {
          const ordenados = dataListas.listas.periodos.sort((a, b) => a.id - b.id);
          setPeriodos(ordenados);
        }

        if (dataPagados.exito) {
          let mapa = dataPagados.estados_por_periodo;
          if (!mapa || typeof mapa !== 'object') {
            mapa = {};
            (dataPagados.periodos_pagados || []).forEach((id) => {
              mapa[id] = 'pagado';
            });
          }
          setEstadosPorPeriodo(mapa);
          setPeriodosPagados(
            Object.keys(mapa).map((k) => parseInt(k, 10)).filter(Number.isFinite)
          );
          setFechaIngreso(dataPagados.ingreso);

          // ✅ NUEVO: inscripción pagada
          const pagada = !!dataPagados.inscripcion_pagada;
          setInscripcionPagada(pagada);
          setInscripcionInfo(dataPagados.inscripcion || null);

          // Si ya está pagada, mostramos el monto real y (si viene) el medio real
          if (pagada && dataPagados.inscripcion) {
            const m = Number(dataPagados.inscripcion.monto);
            if (Number.isFinite(m) && m > 0) setMontoInscripcion(m);

            const idmp = Number(dataPagados.inscripcion.id_medio_pago);
            if (Number.isFinite(idmp) && idmp > 0) setMedioPagoSeleccionado(String(idmp));
          } else {
            // si no está pagada, limpiamos selección de medio SOLO si estás en inscripción
            // (y no tocamos si estás en cuotas/oficina)
            if (modoInicial === 'inscripcion') setMedioPagoSeleccionado('');
          }
        } else {
          setEstadosPorPeriodo({});
          setPeriodosPagados([]);
          setInscripcionPagada(false);
          setInscripcionInfo(null);
          mostrarToast('advertencia', 'No se pudieron obtener períodos marcados para el año seleccionado');
        }
      } catch (error) {
        console.error('Error al obtener datos:', error);
        mostrarToast('error', 'Error al obtener datos del servidor');
      } finally {
        setCargando(false);
      }
    };

    if (socio) fetchDatos();

    setSeleccionados([]);
    setMontosPorPeriodo({});
    setMontosPeriodosListos(false);
  }, [socio, anioTrabajo]);

  // ✅ Si la inscripción está pagada y ya cargaron medios, forzamos mostrar el nombre (solo display)
  useEffect(() => {
    if (!inscripcionPagada) return;
    const idmp = Number(inscripcionInfo?.id_medio_pago);
    if (!Number.isFinite(idmp) || idmp <= 0) return;
    // si aún no está seteado, lo seteamos
    setMedioPagoSeleccionado((prev) => prev || String(idmp));
  }, [inscripcionPagada, inscripcionInfo, mediosPago]);

  // ---- Helpers selección por ingreso ----
  const filtrarPeriodosPorIngreso = () => {
    if (!fechaIngreso) return periodos;

    const ym = parseIngresoYM(fechaIngreso);
    if (!ym) return periodos;

    const anioIngreso = ym.anio;
    const mesIngreso = ym.mes;

    if (anioTrabajo < anioIngreso) return [];

    return periodos.filter((p) => {
      if (anioTrabajo === anioIngreso) {
        if (p.id === ID_CONTADO_ANUAL) return false;
        const primerMes = obtenerPrimerMesDesdeNombre(p.nombre);
        const segundoMes = primerMes + 1;
        return mesIngreso <= segundoMes;
      }
      return true;
    });
  };

  const periodosBase = filtrarPeriodosPorIngreso();
  const ingresoYM = parseIngresoYM(fechaIngreso);
  const yearIsBeforeIngreso = ingresoYM ? anioTrabajo < ingresoYM.anio : false;

  const ventanaFlag = ventanaAnualActiva();
  const periodosDisponibles = useMemo(() => {
    return periodosBase.filter((p) => {
      if (p.id === ID_CONTADO_ANUAL) return ventanaFlag && !yearIsBeforeIngreso;
      return true;
    });
  }, [periodosBase, ventanaFlag, yearIsBeforeIngreso]);

  const seleccionIncluyeAnual = seleccionados.includes(ID_CONTADO_ANUAL);

  const idsBimestralesDisponibles = periodosDisponibles
    .filter((p) => p.id !== ID_CONTADO_ANUAL && !periodosPagados.includes(p.id))
    .map((p) => p.id);

  useEffect(() => {
    const sinAnual = seleccionados.filter((x) => x !== ID_CONTADO_ANUAL);
    const todos =
      idsBimestralesDisponibles.length > 0 &&
      idsBimestralesDisponibles.every((id) => sinAnual.includes(id));
    setTodosSeleccionados(todos);
  }, [seleccionados, idsBimestralesDisponibles]);

  const togglePeriodo = async (id) => {
    if (id === ID_CONTADO_ANUAL) {
      if (!ventanaFlag || yearIsBeforeIngreso) return;
      setSeleccionados((prev) => {
        const ya = prev.includes(ID_CONTADO_ANUAL);
        return ya ? [] : [ID_CONTADO_ANUAL];
      });
      return;
    }

    setSeleccionados((prev) => {
      const base = prev.filter((pid) => pid !== ID_CONTADO_ANUAL);
      const ya = base.includes(id);
      return ya ? base.filter((pid) => pid !== id) : [...base, id];
    });
  };

  const toggleSeleccionarTodos = async () => {
    if (todosSeleccionados) {
      setSeleccionados((prev) => {
        const sinAnual = prev.filter((id) => id !== ID_CONTADO_ANUAL);
        return sinAnual.filter((id) => !idsBimestralesDisponibles.includes(id));
      });
    } else {
      setSeleccionados((prev) => {
        const sinAnual = prev.filter((id) => id !== ID_CONTADO_ANUAL);
        const union = new Set([...sinAnual, ...idsBimestralesDisponibles]);
        return Array.from(union);
      });
    }
  };

  const seleccionSinAnual = useMemo(
    () => seleccionados.filter((id) => id !== ID_CONTADO_ANUAL),
    [seleccionados]
  );

  const aplicaAnualPorSeleccion = ventanaFlag && seleccionIncluyeAnual;

  const refrescarMontosDePeriodosSeleccionados = async () => {
    if (!socio) return;
    if (modo !== 'cuotas') return;

    if (aplicaAnualPorSeleccion || seleccionSinAnual.length === 0) {
      setMontosPeriodosListos(true);
      return;
    }

    const ids = seleccionSinAnual.slice().sort((a, b) => a - b);
    const missing = [];
    const nextLocal = { ...montosPorPeriodo };

    for (const idp of ids) {
      const key = buildMontosCacheKey(idp);
      if (montosPeriodoCacheRef.current.has(key)) {
        const cachedMonto = Number(montosPeriodoCacheRef.current.get(key)) || 0;
        nextLocal[idp] = cachedMonto;
      } else if (nextLocal[idp] == null) {
        missing.push(idp);
      }
    }

    setMontosPorPeriodo(nextLocal);

    if (missing.length === 0) {
      setMontosPeriodosListos(true);
      return;
    }

    setMontosPeriodosListos(false);

    if (montosPeriodoAbortRef.current) {
      try { montosPeriodoAbortRef.current.abort(); } catch {}
    }
    const ctrl = new AbortController();
    montosPeriodoAbortRef.current = ctrl;

    const reqId = ++montosPeriodoReqIdRef.current;

    try {
      const results = await Promise.all(
        missing.map(async (idp) => {
          const res = await fetch(
            `${BASE_URL}/api.php?action=montos&${buildMontosQS(idp)}`,
            { signal: ctrl.signal }
          );
          const data = await res.json();
          return { idp, data };
        })
      );

      if (reqId !== montosPeriodoReqIdRef.current) return;

      const merged = { ...nextLocal };

      for (const { idp, data } of results) {
        if (data?.exito) {
          const monto = Number(data.mensual) || 0;
          merged[idp] = monto;

          const key = buildMontosCacheKey(idp);
          montosPeriodoCacheRef.current.set(key, monto);

          if (Number(data.anual) > 0) {
            const cacheKeyRef = buildMontosCacheKey(periodoReferencia || 0);
            const prev = montosCacheRef.current.get(cacheKeyRef) || {};
            montosCacheRef.current.set(cacheKeyRef, {
              mensual: prev.mensual ?? montoMensual,
              anual: Number(data.anual),
            });
            setMontoAnual(Number(data.anual));
          }
        } else {
          merged[idp] = 0;
        }
      }

      setMontosPorPeriodo(merged);

      const ok = ids.every((idp) => Number.isFinite(Number(merged[idp])) && Number(merged[idp]) > 0);
      setMontosPeriodosListos(ok);

      if (!ok) {
        mostrarToast('advertencia', 'Hay períodos sin monto válido. Revisá montos en el backend.');
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
      setMontosPeriodosListos(false);
      mostrarToast('error', 'Error al consultar montos por período.');
    }
  };

  useEffect(() => {
    if (!socio) return;
    if (modo !== 'cuotas') return;
    refrescarMontosDePeriodosSeleccionados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socio, anioTrabajo, aplicaAnualPorSeleccion, seleccionSinAnual.join(','), modo]);

  // ✅ TOTAL:
  const total = useMemo(() => {
    if (modo === 'inscripcion') {
      const v = Number(montoInscripcion);
      return Number.isFinite(v) ? v : 0;
    }

    if (condonar) return 0;
    if (aplicaAnualPorSeleccion) return Number(montoAnual) || 0;

    if (seleccionSinAnual.length === 0) return 0;

    let suma = 0;
    for (const idp of seleccionSinAnual) {
      const v = Number(montosPorPeriodo[idp]);
      if (Number.isFinite(v)) suma += v;
    }
    return suma;
  }, [modo, montoInscripcion, condonar, aplicaAnualPorSeleccion, montoAnual, seleccionSinAnual, montosPorPeriodo]);

  const periodoTextoFinal = useMemo(() => {
    // ✅ Inscripción SIN año (porque es una sola vez)
    if (modo === 'inscripcion') return `INSCRIPCIÓN`;

    if (aplicaAnualPorSeleccion) return `CONTADO ANUAL ${anioTrabajo}`;

    if (seleccionSinAnual.length === 0) return '';
    const partes = seleccionSinAnual.map((id) => {
      const p = periodos.find((pp) => pp.id === id);
      if (!p) return String(id);
      return p.nombre.replace(/^\s*per[ií]odo?s?\s*:?\s*/i, '').trim();
    });
    return `${partes.join(' / ')} ${anioTrabajo}`;
  }, [modo, aplicaAnualPorSeleccion, seleccionSinAnual, periodos, anioTrabajo]);

  const buildSocioParaComprobante = (esAnualSeleccion) => {
    const medioTexto = medioPagoNombreSeleccionado || (socio.medio_pago || socio.cobrador || '');

    if (modo === 'inscripcion') {
      return {
        ...socio,
        id_socio: getSocioId(socio) ?? socio?.id_socio,
        id_periodo: 0,
        periodo_texto: `INSCRIPCIÓN`,
        importe_total: Number(total) || 0,
        anio: nowYear, // fijo
        medio_pago: medioTexto,
      };
    }

    const periodoCodigo = esAnualSeleccion ? ID_CONTADO_ANUAL : seleccionSinAnual[0] || 0;

    const importe = condonar
      ? 0
      : esAnualSeleccion
        ? Number(montoAnual) || 0
        : Number(total) || 0;

    return {
      ...socio,
      id_socio: getSocioId(socio) ?? socio?.id_socio,
      id_periodo: periodoCodigo,
      periodo_texto: esAnualSeleccion ? `CONTADO ANUAL ${anioTrabajo}` : periodoTextoFinal || '',
      importe_total: importe,
      anio: anioTrabajo,
      medio_pago: esOficina ? (medioTexto || '') : (socio.medio_pago || socio.cobrador),
    };
  };

  // ✅ registrar
  const confirmar = async () => {
    const idSocio = getSocioId(socio);
    if (!idSocio) {
      mostrarToast('error', 'El socio no tiene ID válido (id_socio / id).');
      return;
    }

    const requiereMedio = modo === 'inscripcion' || esOficina;
    if (requiereMedio && !medioPagoSeleccionado) {
      mostrarToast('advertencia', 'Debés seleccionar un medio de pago');
      return;
    }

    // ===== INSCRIPCIÓN =====
    if (modo === 'inscripcion') {
      // ✅ si ya está pagada -> bloqueamos
      if (inscripcionPagada) {
        mostrarToast('advertencia', 'La inscripción ya figura como PAGADA. No se puede registrar de nuevo.');
        return;
      }

      const monto = Number(total) || 0;
      if (monto <= 0) {
        mostrarToast('advertencia', 'Ingresá un monto válido para la inscripción.');
        return;
      }

      setCargando(true);
      try {
        const payload = {
          id_socio: idSocio,
          // ✅ año fijo actual (solo para backend si lo usa)
          anio: nowYear,
          monto,
          id_medio_pago: Number(medioPagoSeleccionado) || null,
          medio_pago: medioPagoNombreSeleccionado || null,
          observacion: null,
        };

        const res = await fetch(`${BASE_URL}/api.php?action=registrar_inscripcion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data?.exito) {
          // ✅ marcamos como pagada y guardamos info básica
          setInscripcionPagada(true);
          setInscripcionInfo({
            monto,
            fecha_pago: data?.fecha_pago || null,
            id_medio_pago: Number(medioPagoSeleccionado) || null,
          });
          setPagoExitoso(true);
        } else {
          mostrarToast('error', data?.mensaje || 'No se pudo registrar la inscripción.');
        }
      } catch (e) {
        console.error(e);
        mostrarToast('error', 'Error de conexión al registrar inscripción.');
      } finally {
        setCargando(false);
      }
      return;
    }

    // ===== CUOTAS =====
    if (seleccionados.length === 0) {
      mostrarToast('advertencia', 'Seleccioná al menos un período');
      return;
    }

    const montosValidos = aplicaAnualPorSeleccion
      ? Number(montoAnual) > 0
      : seleccionSinAnual.length > 0 && montosPeriodosListos && Number(total) > 0;

    if (!condonar && (!montosListos || !montosValidos)) {
      mostrarToast('advertencia', 'El monto aún no está listo. Esperá un segundo e intentá de nuevo.');
      return;
    }
    if (!condonar && (!total || Number(total) <= 0)) {
      mostrarToast('advertencia', 'El total calculado es inválido.');
      return;
    }

    setCargando(true);
    try {
      const payload = {
        id_socio: idSocio,
        periodos: seleccionados,
        condonar,
        anio: anioTrabajo,
        monto: Number(total) || 0,
        monto_por_periodo: 0,
        id_medio_pago: esOficina ? (Number(medioPagoSeleccionado) || null) : null,
        medio_pago: esOficina ? (medioPagoNombreSeleccionado || null) : (socio.medio_pago || socio.cobrador),
      };

      const res = await fetch(`${BASE_URL}/api.php?action=registrar_pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.exito) {
        setPagoExitoso(true);
      } else {
        if (Array.isArray(data.ya_registrados) && data.ya_registrados.length > 0) {
          const detalles = data.ya_registrados
            .map((it) => `${it.periodo ?? it} (${String(it.estado || 'ya existe').toUpperCase()})`)
            .join(', ');
          mostrarToast('advertencia', `Ya registrados: ${detalles}`);
        } else {
          mostrarToast('error', 'Error: ' + (data.mensaje || 'No se pudo registrar'));
        }
      }
    } catch (error) {
      console.error('Error al registrar:', error);
      mostrarToast('error', 'Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  const handleImprimirComprobante = async () => {
    const socioParaImprimir = buildSocioParaComprobante(aplicaAnualPorSeleccion);
    const periodoCodigo = socioParaImprimir.id_periodo;

    const win = window.open('', '_blank');
    if (!win) return alert('Habilitá ventanas emergentes para imprimir el comprobante.');
    await imprimirRecibosUnicos([socioParaImprimir], periodoCodigo, win);
  };

  const handleGenerarPDFComprobante = async () => {
    const socioParaImprimir = buildSocioParaComprobante(aplicaAnualPorSeleccion);
    const periodoCodigo = socioParaImprimir.id_periodo;

    await generarReciboPDFUnico({
      listaSocios: [socioParaImprimir],
      periodoActual: periodoCodigo,
      anioSeleccionado: modo === 'inscripcion' ? nowYear : anioTrabajo,
      headerImageUrl: HEADER_IMG_URL,
      nombreArchivo: `${modo === 'inscripcion' ? 'Inscripcion' : 'Comprobante'}_${getSocioId(socio) || socio.id_socio}_${modo === 'inscripcion' ? nowYear : anioTrabajo}.pdf`,
      baseUrl: BASE_URL,
    });
  };

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '';
    const m = String(fechaStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const dd = String(d).padStart(2, '0');
      const mm = String(mo).padStart(2, '0');
      return `${dd}/${mm}/${y}`;
    }
    const fecha = new Date(fechaStr);
    if (Number.isNaN(fecha.getTime())) return String(fechaStr);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  };

  const formatearARS = (monto) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(monto);

  if (!socio) return null;

  // ======= VISTA DE ÉXITO =======
  if (pagoExitoso) {
    const tituloExito =
      modo === 'inscripcion'
        ? '¡Inscripción registrada con éxito!'
        : condonar
          ? '¡Condonación registrada con éxito!'
          : '¡Pago realizado con éxito!';
    const subExito = 'Elegí cómo querés obtener el comprobante.';

    return (
      <>
        {toast && <Toast tipo={toast.tipo} mensaje={toast.mensaje} duracion={toast.duracion} onClose={() => setToast(null)} />}

        <div className="modal-pagos-overlay">
          <div className="modal-pagos-contenido">
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-circle">
                  <FaCoins size={20} />
                </div>
                <h2 className="modal-title">
                  {modo === 'inscripcion' ? 'Inscripción' : 'Registro de Pagos'}
                </h2>
              </div>
              <button className="modal-close-btn" onClick={() => onClose(true)} disabled={cargando}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="success-card">
                <h3 className="success-title">{tituloExito}</h3>
                <p className="success-sub">{subExito}</p>

                <div className="output-mode">
                  <label className={`mode-option ${modoSalida === 'imprimir' ? 'active' : ''}`}>
                    <input type="radio" name="modoSalida" value="imprimir" checked={modoSalida === 'imprimir'} onChange={() => setModoSalida('imprimir')} />
                    <span className="mode-bullet" />
                    <span>Imprimir</span>
                  </label>

                  <label className={`mode-option ${modoSalida === 'pdf' ? 'active' : ''}`}>
                    <input type="radio" name="modoSalida" value="pdf" checked={modoSalida === 'pdf'} onChange={() => setModoSalida('pdf')} />
                    <span className="mode-bullet" />
                    <span>PDF</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div className="footer-left">
                <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>Total: {formatearARS(total)}</span>
              </div>
              <div className="footer-actions">
                <button className="btn btn-secondary" onClick={() => onClose(true)}>Cerrar</button>
                {modoSalida === 'imprimir' ? (
                  <button className="btn btn-primary" onClick={handleImprimirComprobante}>Imprimir</button>
                ) : (
                  <button className="btn btn-primary" onClick={handleGenerarPDFComprobante}>Descargar PDF</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ======= VISTA NORMAL =======
  const cantidadSeleccionados = seleccionados.length;

  const bloquearPorMontos = modo === 'cuotas' && !condonar && (
    aplicaAnualPorSeleccion
      ? Number(montoAnual) <= 0
      : (seleccionSinAnual.length > 0 && (!montosPeriodosListos || Number(total) <= 0))
  );

  const requiereMedio = modo === 'inscripcion' || esOficina;

  // ✅ si inscripción ya pagada, bloquear confirmación en ese modo
  const bloquearInscripcion = modo === 'inscripcion' && inscripcionPagada;

  const deshabilitarConfirmar =
    modo === 'inscripcion'
      ? (cargando || bloquearInscripcion || Number(total) <= 0 || (requiereMedio && !medioPagoSeleccionado))
      : (seleccionados.length === 0 || cargando || bloquearPorMontos || (requiereMedio && !medioPagoSeleccionado));

  const handleAbrirConfirmacion = () => {
    if (deshabilitarConfirmar) return;
    setShowConfirm(true);
  };

  const handleConfirmarDesdeModal = () => {
    setShowConfirm(false);
    confirmar();
  };

  // ✅ texto medio para mostrar cuando está pagada
  const medioInscripcionPagada = inscripcionPagada
    ? (medioPagoNombrePorId(inscripcionInfo?.id_medio_pago) || '')
    : '';

  return (
    <>
      {toast && <Toast tipo={toast.tipo} mensaje={toast.mensaje} duracion={toast.duracion} onClose={() => setToast(null)} />}

      <div className="modal-pagos-overlay">
        <div className="modal-pagos-contenido">
          <div className="modal-header">
            <div className="modal-header-content">
              <div className="modal-icon-circle">
                <FaCoins size={20} />
              </div>
              <h2 className="modal-title">
                {modo === 'inscripcion' ? 'Cobrar Inscripción' : 'Registro de Pagos / Condonar'}
              </h2>
            </div>
            <button className="modal-close-btn" onClick={() => onClose(false)} disabled={cargando}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="modal-body">
            <div className="socio-info-card">
              <div className="socio-info-header">
                <h3 className="socio-nombre">{`${getSocioId(socio) ?? socio.id_socio ?? '-'} - ${socio.nombre}`}</h3>
                {fechaIngreso && (
                  <div className="socio-fecha">
                    <span className="fecha-label">Ingreso:</span>
                    <span className="fecha-valor">{formatearFecha(fechaIngreso)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ✅ Selector modo */}
{/* ✅ Selector modo (tabs) */}
<div className="modo-tabs">
  <button
    type="button"
    className={`modo-tab ${modo === "cuotas" ? "active" : ""}`}
    onClick={() => setModo("cuotas")}
    disabled={cargando}
  >
    Cuotas
  </button>

  <button
    type="button"
    className={`modo-tab ${modo === "inscripcion" ? "active" : ""}`}
    onClick={() => setModo("inscripcion")}
    disabled={cargando}
  >
    Inscripción
  </button>
</div>


            {/* ✅ condonar SOLO en cuotas */}
            {modo === 'cuotas' && (
              <div className={`condonar-box ${condonar ? 'is-active' : ''}`}>
                <label className="condonar-check">
                  <input type="checkbox" checked={condonar} onChange={(e) => setCondonar(e.target.checked)} disabled={cargando} />
                  <span className="switch"><span className="switch-thumb" /></span>
                  <span className="switch-label">
                    Marcar como <strong>Condonado</strong> (no genera cobro)
                  </span>
                </label>

                <div className="year-picker">
                  <button
                    type="button"
                    className="year-button"
                    onClick={() => setShowYearPicker((s) => !s)}
                    disabled={cargando}
                    title="Cambiar año"
                  >
                    <FaCalendarAlt />
                    <span>{anioTrabajo}</span>
                  </button>

                  {showYearPicker && (
                    <div className="year-popover" onMouseLeave={() => setShowYearPicker(false)}>
                      {yearOptions.map((y) => (
                        <button
                          key={y}
                          className={`year-item ${y === anioTrabajo ? 'active' : ''}`}
                          disabled={ingresoYM ? y < ingresoYM.anio : false}
                          title={ingresoYM && y < ingresoYM.anio ? 'Año anterior al ingreso del socio' : undefined}
                          onClick={() => {
                            setAnioTrabajo(y);
                            setShowYearPicker(false);
                          }}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
{modo === 'inscripcion' && (
  <div className="condonar-box is-active inscripcion-box">
    {inscripcionPagada && (
      <div className="inscripcion-paid-banner">
        <span className="inscripcion-paid-left">Pagado</span>
        <span className="inscripcion-paid-right">
          {inscripcionInfo?.fecha_pago ? formatearFecha(inscripcionInfo.fecha_pago) : ''}
        </span>
      </div>
    )}

    <div className="inscripcion-row">
      <div className="inscripcion-left">
        <div className="inscripcion-label">
          Monto de inscripción{" "}
          <span className="inscripcion-label-muted">
            {inscripcionPagada ? "(ya registrada)" : "(libre)"}
          </span>
        </div>

        <input
          type="text"
          inputMode="numeric"
          value={String(montoInscripcion)}
          onChange={(e) => {
            if (inscripcionPagada) return;
            const v = e.target.value.replace(/[^\d]/g, "");
            setMontoInscripcion(v ? Number(v) : 0);
          }}
          className={`medio-pago-select inscripcion-input ${inscripcionPagada ? "is-locked" : ""}`}
          disabled={cargando || inscripcionPagada}
          placeholder="Ej: 6000"
        />

        <div className="medio-pago-hint inscripcion-hint">
          {inscripcionPagada
            ? `Registrada${
                inscripcionInfo?.monto ? ` por ${formatearARS(Number(inscripcionInfo.monto) || 0)}` : ""
              }${medioInscripcionPagada ? ` • Medio: ${medioInscripcionPagada}` : ""}`
            : "Se registra una sola vez por socio."}
        </div>
      </div>

<div className="inscripcion-year-pill">
  <FaCalendarAlt />
  <span>{nowYear}</span> 
</div>

    </div>
  </div>
)}



            {/* ✅ MEDIO DE PAGO */}
            {mostrarSelectorMedioPago && (
              <div className="medio-pago-section">
                <div className="section-header">
                  <h4 className="section-title">Medio de Pago*</h4>
  {!medioPagoSeleccionado && (
    <span className="required-badge">Requerido</span>
  )}

                </div>
                <div className="medio-pago-selector">
                  <select
                    value={medioPagoSeleccionado}
                    onChange={(e) => {
                      if (modo === 'inscripcion' && inscripcionPagada) return; // ✅ bloqueado
                      setMedioPagoSeleccionado(e.target.value);
                    }}
                    className="medio-pago-select"
                    disabled={cargando || (modo === 'inscripcion' && inscripcionPagada)}
                    required
                  >
                    <option value="">Seleccionar medio de pago</option>
                    {mediosPago.map((medio) => (
                      <option key={medio.id} value={String(medio.id)}>
                        {medio.nombre}
                      </option>
                    ))}
                  </select>
                  <div className="medio-pago-hint">
                    {modo === 'inscripcion' && inscripcionPagada
                      ? 'La inscripción ya está registrada, no se puede modificar.'
                      : 'Campo obligatorio para registrar'}
                  </div>
                </div>
              </div>
            )}

            {/* ✅ sección periodos SOLO en cuotas */}
            {modo === 'cuotas' && (
              <div className="periodos-section">
                <div className="section-header">
                  <h4 className="section-title">Períodos Disponibles</h4>
                  <div className="section-header-actions">
                    <button
                      className="btn btn-small btn-terciario"
                      onClick={toggleSeleccionarTodos}
                      disabled={cargando || idsBimestralesDisponibles.length === 0}
                    >
                      {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'} ({cantidadSeleccionados})
                    </button>
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
                      {periodosDisponibles.length === 0 ? (
                        <div className="empty-state">
                          No hay períodos disponibles para el año seleccionado.
                        </div>
                      ) : (
                        periodosDisponibles.map((periodo) => {
                          const estadoExacto = estadosPorPeriodo[periodo.id];
                          const yaMarcado = !!estadoExacto;
                          const checked = seleccionados.includes(periodo.id);
                          const disabled = yaMarcado || cargando;

                          const etiquetaEstado =
                            estadoExacto === 'condonado' ? 'Condonado' : estadoExacto === 'pagado' ? 'Pagado' : '';

                          return (
                            <div
                              key={periodo.id}
                              className={`periodo-card ${yaMarcado ? 'pagado' : ''} ${checked ? 'seleccionado' : ''}`}
                              onClick={() => !disabled && togglePeriodo(periodo.id)}
                            >
                              <div className="periodo-checkbox">
                                <input
                                  type="checkbox"
                                  id={`periodo-${periodo.id}`}
                                  checked={checked}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePeriodo(periodo.id);
                                  }}
                                  onChange={() => {}}
                                  disabled={disabled}
                                />
                                <span className="checkmark"></span>
                              </div>
                              <div className="periodo-label">
                                {periodo.nombre}
                                {yaMarcado && (
                                  <span className={`periodo-status ${estadoExacto === 'condonado' ? 'status-condonado' : 'status-pagado'}`}>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                      <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    {etiquetaEstado}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <div className="footer-left">
              <span className={`total-badge ${condonar ? 'total-badge-warning' : ''}`}>
                Total: {formatearARS(total)}
              </span>

              {mostrarSelectorMedioPago && medioPagoNombreSeleccionado && (
                <span className="medio-pago-badge">Medio: {medioPagoNombreSeleccionado}</span>
              )}

              {modo === 'inscripcion' && inscripcionPagada && (
                <span className="medio-pago-badge" style={{ background: 'rgba(46,204,113,0.18)' }}>
                  ✅ Pagada
                </span>
              )}
            </div>

            <div className="footer-actions">
              <button className="btn btn-secondary" onClick={() => onClose(false)} disabled={cargando}>
                Cancelar
              </button>

              <button
                className={`btn ${condonar ? 'btn-warnings' : 'btn-primary'}`}
                onClick={handleAbrirConfirmacion}
                disabled={deshabilitarConfirmar}
                title={bloquearInscripcion ? 'La inscripción ya está pagada' : undefined}
              >
                {cargando ? (
                  <>
                    <span className="spinner-btn"></span> Procesando...
                  </>
                ) : (
                  modo === 'inscripcion'
                    ? (inscripcionPagada ? 'Inscripción pagada' : 'Registrar inscripción')
                    : (condonar ? 'Condonar' : 'Pagar')
                )}
              </button>
            </div>
          </div>
        </div>

        {showConfirm && (
          <div className="confirm-pago-overlay">
            <div className="confirm-pago-card">
              <h3 className="confirm-pago-title">
                {modo === 'inscripcion'
                  ? 'Confirmar inscripción'
                  : (condonar ? 'Confirmar condonación' : 'Confirmar pago')}
              </h3>

              <p className="confirm-pago-text">
                Estás a punto de registrar:
              </p>

              <div className="confirm-pago-resumen">
                <div className="confirm-pago-row">
                  <span className="confirm-pago-label">Socio:</span>
                  <span className="confirm-pago-value">{(getSocioId(socio) ?? socio.id_socio) || '-'} - {socio.nombre}</span>
                </div>

                <div className="confirm-pago-row">
                  <span className="confirm-pago-label">Concepto:</span>
                  <span className="confirm-pago-value">{periodoTextoFinal || '-'}</span>
                </div>

                {mostrarSelectorMedioPago && medioPagoNombreSeleccionado && (
                  <div className="confirm-pago-row">
                    <span className="confirm-pago-label">Medio de pago:</span>
                    <span className="confirm-pago-value">{medioPagoNombreSeleccionado}</span>
                  </div>
                )}

                <div className="confirm-pago-row total">
                  <span className="confirm-pago-label">Total:</span>
                  <span className="confirm-pago-value">
                    {condonar ? 'Condonado (sin cobro)' : formatearARS(total)}
                  </span>
                </div>
              </div>

              <p className="confirm-pago-warning">
                {modo === 'inscripcion'
                  ? 'Esta acción se registra una sola vez por socio.'
                  : (condonar ? 'Esta acción registrará la deuda como condonada.' : 'Al confirmar, se registrará el pago de forma definitiva.')}
              </p>

              <div className="confirm-pago-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfirm(false)} disabled={cargando}>
                  Revisar
                </button>
                <button
                  type="button"
                  className={`btn ${condonar ? 'btn-warnings' : 'btn-primary'}`}
                  onClick={handleConfirmarDesdeModal}
                  disabled={cargando}
                >
                  {cargando ? 'Procesando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ModalPagos;
