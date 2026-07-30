<?php
/**
 * obtener_monto_objetivo.php  —  CÁLCULO CORRECTO POR MES/PERIODO
 *
 * NUEVO:
 *   - esperado_por_cobrador_por_estado: [
 *         { id_cobrador, nombre, estado, total_esperado, socios_contados }, ...
 *     ]
 *   - esperado_por_cobrador_por_mes_estado: [
 *         { id_cobrador, nombre, estado, socios_contados, por_mes: { mes => esperado } }, ...
 *     ]
 *
 * Regla de normalización de estado del socio:
 *   - descripcion == 'PASIVO'  => PASIVO
 *   - cualquier otro valor (NULL, vacío, distinto) => ACTIVO
 *   De esta forma TODOS los socios cuentan como ACTIVO o PASIVO y nunca se
 *   “pierden” en los totales.
 */

header('Content-Type: application/json; charset=utf-8');

/**
 * Devuelve la fecha de referencia usada por Cuotas/Registrar pago para un
 * bimestre. El precio de todo el período se define al cierre del bimestre.
 */
function fecha_referencia_por_periodo(int $anio, int $idPeriodo): string
{
    if ($idPeriodo < 1 || $idPeriodo > 6) {
        return sprintf('%04d-12-31', $anio);
    }

    $mesFin = $idPeriodo * 2;
    $dt = DateTime::createFromFormat('Y-m-d', sprintf('%04d-%02d-01', $anio, $mesFin));
    if (!$dt) {
        return sprintf('%04d-12-31', $anio);
    }

    $dt->modify('last day of this month');
    return $dt->format('Y-m-d');
}

/**
 * Carga una sola vez todos los cambios mensuales de las categorías presentes.
 * Evita hacer una consulta por socio/período (problema N+1).
 */
function cargar_historial_mensual(PDO $pdo, array $idsCategorias): array
{
    $idsCategorias = array_values(array_unique(array_filter(array_map('intval', $idsCategorias))));
    if (!$idsCategorias) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($idsCategorias), '?'));
    $sql = "
        SELECT id_historial, id_cat_monto, precio_viejo, precio_nuevo, fecha_cambio
        FROM precios_historicos
        WHERE tipo = 'mensual'
          AND id_cat_monto IN ($placeholders)
        ORDER BY id_cat_monto ASC, fecha_cambio ASC, id_historial ASC
    ";

    $st = $pdo->prepare($sql);
    foreach ($idsCategorias as $i => $idCategoria) {
        $st->bindValue($i + 1, $idCategoria, PDO::PARAM_INT);
    }
    $st->execute();

    $map = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
        $id = (int)$row['id_cat_monto'];
        $map[$id][] = [
            'fecha' => (string)$row['fecha_cambio'],
            'viejo' => (int)$row['precio_viejo'],
            'nuevo' => (int)$row['precio_nuevo'],
        ];
    }

    return $map;
}

/**
 * Misma regla histórica usada por Cuotas:
 * - antes del primer cambio: precio_viejo del primer registro;
 * - desde cada cambio: precio_nuevo del último cambio vigente;
 * - sin historial: valor actual de categoria_monto.
 */
function precio_mensual_vigente(
    ?int $idCategoria,
    string $fechaReferencia,
    int $precioActual,
    array $historialMap
): int {
    if (!$idCategoria) {
        return $precioActual;
    }

    $cambios = $historialMap[$idCategoria] ?? [];
    if (!$cambios) {
        return $precioActual;
    }

    if ($fechaReferencia < $cambios[0]['fecha']) {
        return (int)$cambios[0]['viejo'];
    }

    $vigente = null;
    foreach ($cambios as $cambio) {
        if ($cambio['fecha'] <= $fechaReferencia) {
            $vigente = (int)$cambio['nuevo'];
        } else {
            break;
        }
    }

    return $vigente ?? $precioActual;
}

/**
 * Reparte un monto bimestral entre sus dos meses sin alterar el total cuando
 * el importe es impar. El primer mes recibe piso(monto/2) y el segundo, el resto.
 */
function importe_del_mes(int $montoPeriodo, int $mes): int
{
    $primeraMitad = intdiv(max($montoPeriodo, 0), 2);
    $segundaMitad = max($montoPeriodo, 0) - $primeraMitad;
    return ($mes % 2 === 1) ? $primeraMitad : $segundaMitad;
}

try {
    require_once __DIR__ . '/../../config/db.php'; // Debe exponer $pdo (PDO)

    $g = fn($k, $d = null) => isset($_GET[$k]) ? $_GET[$k] : $d;

    /* ====== Parámetros ====== */
    $anio = (int)$g('anio', 0);
    if ($anio <= 0) {
        http_response_code(400);
        echo json_encode(['exito' => false, 'error' => 'Parámetro "anio" es requerido'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $mesRaw          = $g('mes', null);
    $periodoRaw      = $g('periodo', null);
    $idPeriodo       = (int)$g('id_periodo', 0);
    $cobrador        = $g('cobrador', null);
    $estadoSoc       = $g('estado_socio', null);
    $wantDebug       = $g('debug', '0') === '1';
    $todosCobradores = $g('todos_cobradores', '0') === '1';

    /* ====== Resolver MESES seleccionados ====== */
    $mesesSel = [];

    if ($mesRaw !== null && $mesRaw !== '' && ctype_digit((string)$mesRaw)) {
        $m = (int)$mesRaw;
        if ($m >= 1 && $m <= 12) {
            $mesesSel = [$m];
        }
    }

    if (!$mesesSel && $periodoRaw) {
        if (preg_match_all('/\d{1,2}/u', (string)$periodoRaw, $mm)) {
            $set = [];
            foreach ($mm[0] as $s) {
                $n = (int)$s;
                if ($n >= 1 && $n <= 12) {
                    $set[$n] = true;
                }
            }
            $mesesSel = array_map('intval', array_keys($set));
        }
    }

    if (!$mesesSel && $idPeriodo >= 1 && $idPeriodo <= 6) {
        $map = [
            1 => [1, 2],
            2 => [3, 4],
            3 => [5, 6],
            4 => [7, 8],
            5 => [9, 10],
            6 => [11, 12],
        ];
        $mesesSel = $map[$idPeriodo];
    }

    if (!$mesesSel) {
        $mesesSel = range(1, 12);
    }

    sort($mesesSel);
    $maxMes = (int)max($mesesSel);

    $mesToPeriodo = static function (int $m): int {
        return intdiv($m - 1, 2) + 1;
    };

    /* ====== OBTENER TODOS LOS COBRADORES ====== */
    $sqlCobradores = "SELECT id_cobrador, nombre FROM cobrador ORDER BY id_cobrador";
    $stCobradores = $pdo->query($sqlCobradores);
    $todosLosCobradores = $stCobradores->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $cobrId2Nombre = [];
    foreach ($todosLosCobradores as $c) {
        $cobrId2Nombre[(int)$c['id_cobrador']] = $c['nombre'];
    }

    /* ====== WHERE (elegibilidad) ====== */
    $where  = [];
    $params = [];

    // Socios activos hasta el último día del último mes considerado
    $where[] = "s.activo = 1";
    $where[] = "(s.ingreso IS NULL OR s.ingreso <= LAST_DAY(DATE(CONCAT(:anio,'-',:max_mes,'-01'))))";
    $params[':anio']    = $anio;
    $params[':max_mes'] = $maxMes;

    $cobradorAplicado = null;
    if ($cobrador !== null && $cobrador !== '' && !$todosCobradores) {
        if (ctype_digit((string)$cobrador)) {
            $where[]                = "s.id_cobrador = :id_cobrador";
            $params[':id_cobrador'] = (int)$cobrador;
            $cobradorAplicado       = (int)$cobrador;
        } else {
            $where[]                 = "cb.nombre = :nom_cobrador";
            $params[':nom_cobrador'] = trim((string)$cobrador);
            $cobradorAplicado        = trim((string)$cobrador);
        }
    }

    // Filtro opcional por estado de socio (descripción ACTIVO/PASIVO)
    $estadoAplicado = null;
    if ($estadoSoc) {
        $e = mb_strtoupper(trim((string)$estadoSoc), 'UTF-8');
        if ($e === 'ACTIVO' || $e === 'PASIVO') {
            $where[]                = "UPPER(e.descripcion) = :estado_desc";
            $params[':estado_desc'] = $e;
            $estadoAplicado         = $e;
        }
    }

    $whereSQL = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    /* ====== Traer socios + monto POR PERÍODO ====== */
    $sql = "
        SELECT
            s.id_socio,
            s.nombre                      AS socio_nombre,
            s.ingreso                     AS ingreso,
            s.id_cobrador,
            cb.nombre                     AS cobrador_nombre,
            s.id_cat_monto,
            COALESCE(cm.monto_mensual,0)  AS monto_por_periodo_actual,
            s.activo,
            s.id_estado                   AS socio_estado_id,
            e.descripcion                 AS socio_estado_desc
        FROM socios s
        LEFT JOIN categoria_monto cm ON cm.id_cat_monto = s.id_cat_monto
        LEFT JOIN cobrador       cb ON cb.id_cobrador   = s.id_cobrador
        LEFT JOIN estado         e  ON e.id_estado      = s.id_estado
        $whereSQL
    ";

    $st = $pdo->prepare($sql);
    foreach ($params as $k => $v) {
        $st->bindValue($k, $v);
    }
    $st->execute();
    $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // Cargar el historial una sola vez para todas las categorías involucradas.
    $idsCategorias = [];
    foreach ($rows as $row) {
        if (!empty($row['id_cat_monto'])) {
            $idsCategorias[] = (int)$row['id_cat_monto'];
        }
    }
    $historialMensual = cargar_historial_mensual($pdo, $idsCategorias);

    /* ====== Inicializar agregadores ====== */
    $esperadoPorCobrador       = [];
    $esperadoPorCobradorPorMes = [];

    // Por estado (ACTIVO/PASIVO)
    $esperadoPorCobradorEstado       = []; // [id_cobrador][estado] => [tot,soc]
    $esperadoPorCobradorPorMesEstado = []; // [id_cobrador][estado][mes] => monto

    foreach ($todosLosCobradores as $c) {
        $id   = (int)$c['id_cobrador'];
        $name = (string)$c['nombre'];

        $esperadoPorCobrador[$id] = [
            'id_cobrador'     => $id,
            'nombre'          => $name,
            'total_esperado'  => 0,
            'socios_contados' => 0,
        ];
        $esperadoPorCobradorPorMes[$id] = [];

        $esperadoPorCobradorEstado[$id] = [
            'ACTIVO' => ['total_esperado' => 0, 'socios_contados' => 0],
            'PASIVO' => ['total_esperado' => 0, 'socios_contados' => 0],
        ];
        $esperadoPorCobradorPorMesEstado[$id] = [
            'ACTIVO' => [],
            'PASIVO' => [],
        ];
    }

    $ensureCob0 = function () use (&$esperadoPorCobrador, &$esperadoPorCobradorPorMes, &$esperadoPorCobradorEstado, &$esperadoPorCobradorPorMesEstado) {
        if (!isset($esperadoPorCobrador[0])) {
            $esperadoPorCobrador[0] = [
                'id_cobrador'     => 0,
                'nombre'          => 'SIN COBRADOR',
                'total_esperado'  => 0,
                'socios_contados' => 0,
            ];
            $esperadoPorCobradorPorMes[0] = [];
            $esperadoPorCobradorEstado[0] = [
                'ACTIVO' => ['total_esperado' => 0, 'socios_contados' => 0],
                'PASIVO' => ['total_esperado' => 0, 'socios_contados' => 0],
            ];
            $esperadoPorCobradorPorMesEstado[0] = [
                'ACTIVO' => [],
                'PASIVO' => [],
            ];
        }
    };

    /* ====== Cálculo ====== */
    $totalEsperado  = 0;
    $sociosContados = 0;
    $detalle        = [];

    foreach ($rows as $r) {
        if ((int)$r['activo'] !== 1) {
            continue;
        }

        $montoActualCategoria = (int)$r['monto_por_periodo_actual'];
        $idCategoriaMonto = !empty($r['id_cat_monto']) ? (int)$r['id_cat_monto'] : null;

        $idCobrador     = $r['id_cobrador'] !== null ? (int)$r['id_cobrador'] : 0;
        $cobradorNombre = $cobrId2Nombre[$idCobrador] ?? ($r['cobrador_nombre'] ?? 'SIN COBRADOR');
        if ($idCobrador === 0) {
            $ensureCob0();
        }

        // ===== Estado del socio normalizado =====
        // - 'PASIVO' literal  => PASIVO
        // - cualquier otro valor (NULL, vacío, distinto) => ACTIVO
        $estadoSocioRaw  = strtoupper(trim((string)($r['socio_estado_desc'] ?? '')));
        $estadoSocioNorm = ($estadoSocioRaw === 'PASIVO') ? 'PASIVO' : 'ACTIVO';

        // ===== Ingreso / meses válidos =====
        $yIng = 0;
        $mIng = 1;
        if (!empty($r['ingreso'])) {
            $d = date_create_from_format('Y-m-d', $r['ingreso']);
            if ($d) {
                $yIng = (int)$d->format('Y');
                $mIng = (int)$d->format('n');
            } else {
                $ts = strtotime($r['ingreso']);
                if ($ts) {
                    $yIng = (int)date('Y', $ts);
                    $mIng = (int)date('n', $ts);
                }
            }
        }

        $mesesValidos = [];
        if ($yIng === 0 || $yIng < $anio) {
            $mesesValidos = $mesesSel;
        } elseif ($yIng > $anio) {
            $mesesValidos = [];
        } else {
            foreach ($mesesSel as $m) {
                if ($m >= $mIng) {
                    $mesesValidos[] = $m;
                }
            }
        }

        if (!$mesesValidos) {
            if ($wantDebug) {
                $detalle[] = [
                    'id_socio'      => (int)$r['id_socio'],
                    'socio_nombre'  => $r['socio_nombre'],
                    'ingreso'       => $r['ingreso'],
                    'monto_periodo_actual' => $montoActualCategoria,
                    'factor'        => 0.0,
                    'parcial'       => 0,
                    'razon'         => 'sin meses válidos por ingreso',
                ];
            }
            continue;
        }

        $mesesPorPeriodo = [];
        foreach ($mesesValidos as $m) {
            $p                     = $mesToPeriodo($m);
            $mesesPorPeriodo[$p][] = $m;
        }

        $parcialTotalSocio   = 0;
        $mesesParciales      = [];
        $montosPorPeriodo    = [];
        $fechasReferencia    = [];

        foreach ($mesesPorPeriodo as $p => $mesesDelP) {
            $idPeriodo = (int)$p;
            $fechaReferencia = fecha_referencia_por_periodo($anio, $idPeriodo);
            $montoHistorico = precio_mensual_vigente(
                $idCategoriaMonto,
                $fechaReferencia,
                $montoActualCategoria,
                $historialMensual
            );

            $montosPorPeriodo[$idPeriodo] = $montoHistorico;
            $fechasReferencia[$idPeriodo] = $fechaReferencia;

            sort($mesesDelP);
            foreach (array_slice($mesesDelP, 0, 2) as $m) {
                $parcialMes = importe_del_mes($montoHistorico, (int)$m);
                $parcialTotalSocio += $parcialMes;
                $mesesParciales[(int)$m] = ($mesesParciales[(int)$m] ?? 0) + $parcialMes;
            }
        }

        if ($parcialTotalSocio <= 0) {
            if ($wantDebug) {
                $detalle[] = [
                    'id_socio'      => (int)$r['id_socio'],
                    'socio_nombre'  => $r['socio_nombre'],
                    'ingreso'       => $r['ingreso'],
                    'monto_periodo_actual' => $montoActualCategoria,
                    'factor'        => 0.0,
                    'parcial'       => 0,
                    'razon'         => 'factor=0',
                ];
            }
            continue;
        }

        // ===== Acumuladores globales =====
        $totalEsperado  += $parcialTotalSocio;
        $sociosContados++;

        if (!isset($esperadoPorCobrador[$idCobrador])) {
            $esperadoPorCobrador[$idCobrador] = [
                'id_cobrador'     => $idCobrador,
                'nombre'          => $cobradorNombre,
                'total_esperado'  => 0,
                'socios_contados' => 0,
            ];
        }
        if (!isset($esperadoPorCobradorPorMes[$idCobrador])) {
            $esperadoPorCobradorPorMes[$idCobrador] = [];
        }

        $esperadoPorCobrador[$idCobrador]['total_esperado'] += $parcialTotalSocio;
        $esperadoPorCobrador[$idCobrador]['socios_contados']++;

        foreach ($mesesParciales as $mes => $parcial) {
            $esperadoPorCobradorPorMes[$idCobrador][$mes] =
                ($esperadoPorCobradorPorMes[$idCobrador][$mes] ?? 0) + $parcial;
        }

        // ===== Acumuladores por ESTADO (ACTIVO/PASIVO) =====
        if (!isset($esperadoPorCobradorEstado[$idCobrador][$estadoSocioNorm])) {
            $esperadoPorCobradorEstado[$idCobrador][$estadoSocioNorm] = [
                'total_esperado'  => 0,
                'socios_contados' => 0,
            ];
        }
        if (!isset($esperadoPorCobradorPorMesEstado[$idCobrador][$estadoSocioNorm])) {
            $esperadoPorCobradorPorMesEstado[$idCobrador][$estadoSocioNorm] = [];
        }

        $esperadoPorCobradorEstado[$idCobrador][$estadoSocioNorm]['total_esperado'] += $parcialTotalSocio;
        $esperadoPorCobradorEstado[$idCobrador][$estadoSocioNorm]['socios_contados']++;

        foreach ($mesesParciales as $mes => $parcial) {
            $esperadoPorCobradorPorMesEstado[$idCobrador][$estadoSocioNorm][$mes] =
                ($esperadoPorCobradorPorMesEstado[$idCobrador][$estadoSocioNorm][$mes] ?? 0) + $parcial;
        }

        if ($wantDebug) {
            $detalle[] = [
                'id_socio'        => (int)$r['id_socio'],
                'socio_nombre'    => $r['socio_nombre'],
                'cobrador'        => $cobradorNombre,
                'estado_socio'    => $estadoSocioNorm,
                'ingreso'         => $r['ingreso'],
                'id_cat_monto'       => $idCategoriaMonto,
                'monto_actual'       => $montoActualCategoria,
                'montos_periodo'     => $montosPorPeriodo,
                'fechas_referencia'  => $fechasReferencia,
                'parcial_total'      => $parcialTotalSocio,
                'meses_parciales'    => $mesesParciales,
            ];
        }
    }

    /* ====== Construir respuesta ====== */
    $response = [
        'exito'             => true,
        'anio'              => $anio,
        'meses'             => $mesesSel,
        'periodos'          => array_values(array_unique(array_map($mesToPeriodo, $mesesSel))),
        'cobrador_aplicado' => $cobradorAplicado,
        'estado_aplicado'   => $estadoAplicado,
        'total_esperado'    => (int)$totalEsperado,
        'total_socios'      => (int)$sociosContados,
    ];

    if ($todosCobradores) {
        // 1) Totales por cobrador (global)
        $response['esperado_por_cobrador'] = array_values($esperadoPorCobrador);

        // 2) Detalle por mes y cobrador
        $pm = [];
        foreach ($esperadoPorCobradorPorMes as $id => $mapMes) {
            $porMes = [];
            foreach ($mapMes as $mes => $val) {
                $porMes[(int)$mes] = (int)$val;
            }

            $pm[] = [
                'id_cobrador'     => $id,
                'nombre'          => $esperadoPorCobrador[$id]['nombre'] ?? ($cobrId2Nombre[$id] ?? (string)$id),
                'socios_contados' => (int)($esperadoPorCobrador[$id]['socios_contados'] ?? 0),
                'por_mes'         => $porMes,
            ];
        }
        $response['esperado_por_cobrador_por_mes'] = $pm;

        // 3) Totales por cobrador y estado
        $pe = [];
        foreach ($esperadoPorCobradorEstado as $id => $byEstado) {
            foreach ($byEstado as $estado => $data) {
                if ($estado !== 'ACTIVO' && $estado !== 'PASIVO') {
                    continue;
                }
                $pe[] = [
                    'id_cobrador'     => $id,
                    'nombre'          => $esperadoPorCobrador[$id]['nombre'] ?? ($cobrId2Nombre[$id] ?? (string)$id),
                    'estado'          => $estado,
                    'total_esperado'  => (int)$data['total_esperado'],
                    'socios_contados' => (int)$data['socios_contados'],
                ];
            }
        }
        $response['esperado_por_cobrador_por_estado'] = $pe;

        // 4) Por mes, cobrador y estado
        $pme = [];
        foreach ($esperadoPorCobradorPorMesEstado as $id => $byEstado) {
            foreach ($byEstado as $estado => $mapMes) {
                if ($estado !== 'ACTIVO' && $estado !== 'PASIVO') {
                    continue;
                }
                $porMes = [];
                foreach ($mapMes as $mes => $val) {
                    $porMes[(int)$mes] = (int)$val;
                }
                $pme[] = [
                    'id_cobrador'     => $id,
                    'nombre'          => $esperadoPorCobrador[$id]['nombre'] ?? ($cobrId2Nombre[$id] ?? (string)$id),
                    'estado'          => $estado,
                    'socios_contados' => (int)($esperadoPorCobradorEstado[$id][$estado]['socios_contados'] ?? 0),
                    'por_mes'         => $porMes,
                ];
            }
        }
        $response['esperado_por_cobrador_por_mes_estado'] = $pme;
    }

    if ($wantDebug) {
        $response['detalle'] = $detalle;
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'  => false,
        'error'  => 'Error en obtener_monto_objetivo (fracciones por período)',
        'detail' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
