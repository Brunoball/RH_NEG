<?php
// backend/modules/socios/balance_anual/balance_anual_inscripciones.php

declare(strict_types=1);

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

require_once __DIR__ . '/../../../config/db.php';

function balance_inscripciones_pdo(): PDO
{
    if (function_exists('db')) {
        $pdo = db();
        if ($pdo instanceof PDO) {
            return $pdo;
        }
    }

    global $pdo, $conn;

    if (isset($pdo) && $pdo instanceof PDO) {
        return $pdo;
    }

    if (isset($conn) && $conn instanceof PDO) {
        return $conn;
    }

    throw new RuntimeException('No se pudo obtener la conexión PDO.');
}

function balance_inscripciones_responder(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function balance_inscripciones_validar_fecha(?string $fecha, string $fallback): string
{
    $fecha = trim((string) $fecha);

    if ($fecha === '') {
        return $fallback;
    }

    $dt = DateTime::createFromFormat('Y-m-d', $fecha);

    if (!$dt || $dt->format('Y-m-d') !== $fecha) {
        throw new InvalidArgumentException('Formato de fecha inválido. Usá YYYY-MM-DD.');
    }

    return $fecha;
}

function balance_inscripciones_rango_fechas_por_defecto(): array
{
    $hoy = new DateTime('today');
    $anioActual = (int) $hoy->format('Y');
    $mesActual = (int) $hoy->format('n');

    if ($mesActual <= 6) {
        return [
            'desde' => ($anioActual - 1) . '-07-01',
            'hasta' => $anioActual . '-06-30',
        ];
    }

    return [
        'desde' => $anioActual . '-07-01',
        'hasta' => $hoy->format('Y-m-d'),
    ];
}

function balance_inscripciones_nombre_mes(int $mes): string
{
    $meses = [
        1 => 'ENERO',
        2 => 'FEBRERO',
        3 => 'MARZO',
        4 => 'ABRIL',
        5 => 'MAYO',
        6 => 'JUNIO',
        7 => 'JULIO',
        8 => 'AGOSTO',
        9 => 'SEPTIEMBRE',
        10 => 'OCTUBRE',
        11 => 'NOVIEMBRE',
        12 => 'DICIEMBRE',
    ];

    return $meses[$mes] ?? 'SIN MES';
}

function balance_inscripciones_periodo_por_mes(int $mes): array
{
    if ($mes === 1 || $mes === 2) {
        return [
            'id_periodo' => 1,
            'mes_desde' => 1,
            'mes_hasta' => 2,
            'periodo_nombre' => 'PERÍODO 1 Y 2',
            'periodo_meses' => 'ENERO - FEBRERO',
        ];
    }

    if ($mes === 3 || $mes === 4) {
        return [
            'id_periodo' => 2,
            'mes_desde' => 3,
            'mes_hasta' => 4,
            'periodo_nombre' => 'PERÍODO 3 Y 4',
            'periodo_meses' => 'MARZO - ABRIL',
        ];
    }

    if ($mes === 5 || $mes === 6) {
        return [
            'id_periodo' => 3,
            'mes_desde' => 5,
            'mes_hasta' => 6,
            'periodo_nombre' => 'PERÍODO 5 Y 6',
            'periodo_meses' => 'MAYO - JUNIO',
        ];
    }

    if ($mes === 7 || $mes === 8) {
        return [
            'id_periodo' => 4,
            'mes_desde' => 7,
            'mes_hasta' => 8,
            'periodo_nombre' => 'PERÍODO 7 Y 8',
            'periodo_meses' => 'JULIO - AGOSTO',
        ];
    }

    if ($mes === 9 || $mes === 10) {
        return [
            'id_periodo' => 5,
            'mes_desde' => 9,
            'mes_hasta' => 10,
            'periodo_nombre' => 'PERÍODO 9 Y 10',
            'periodo_meses' => 'SEPTIEMBRE - OCTUBRE',
        ];
    }

    return [
        'id_periodo' => 6,
        'mes_desde' => 11,
        'mes_hasta' => 12,
        'periodo_nombre' => 'PERÍODO 11 Y 12',
        'periodo_meses' => 'NOVIEMBRE - DICIEMBRE',
    ];
}

function balance_inscripciones_fecha_inicio_periodo(int $anio, int $mesDesde): string
{
    return sprintf('%04d-%02d-01', $anio, $mesDesde);
}

function balance_inscripciones_fecha_fin_periodo(int $anio, int $mesHasta): string
{
    $fecha = DateTime::createFromFormat('Y-m-d', sprintf('%04d-%02d-01', $anio, $mesHasta));

    if (!$fecha) {
        return sprintf('%04d-%02d-28', $anio, $mesHasta);
    }

    $fecha->modify('last day of this month');

    return $fecha->format('Y-m-d');
}

function balance_inscripciones_formatear_monto($valor): float
{
    if ($valor === null || $valor === '') {
        return 0.0;
    }

    return round((float) $valor, 2);
}

function balance_inscripciones_crear_mes_vacio(int $anio, int $mes): array
{
    return [
        'key' => sprintf('%04d-%02d', $anio, $mes),
        'anio' => $anio,
        'mes' => $mes,
        'mes_nombre' => balance_inscripciones_nombre_mes($mes),

        'cantidad_total' => 0,
        'activos_cantidad' => 0,
        'pasivos_cantidad' => 0,
        'sin_estado_cantidad' => 0,

        'pagados_cantidad' => 0,
        'sin_pago_cantidad' => 0,

        // Monto que debería pagar cada inscripción de ese mes.
        'monto_unitario' => 0,
        'monto_deberia_pagar' => 0,

        // Total esperado: cantidad_total * monto_unitario.
        'monto_esperado_total' => 0,

        // Total realmente pagado en pagos_inscripcion.
        'monto_pagado_total' => 0,
        'monto_total' => 0,

        'montos_observados' => [],

        'socios' => [],
        'socios_activos' => [],
        'socios_pasivos' => [],
        'socios_sin_estado' => [],
    ];
}

function balance_inscripciones_crear_periodo_vacio(array $periodo, int $anio): array
{
    $key = sprintf('%04d-%02d', $anio, (int) $periodo['id_periodo']);
    $label = $periodo['periodo_nombre'] . ' / ' . $anio;

    $mesDesde = (int) $periodo['mes_desde'];
    $mesHasta = (int) $periodo['mes_hasta'];

    $mesesDetalle = [];

    for ($mes = $mesDesde; $mes <= $mesHasta; $mes++) {
        $mesesDetalle[] = balance_inscripciones_crear_mes_vacio($anio, $mes);
    }

    return [
        'key' => $key,
        'id_periodo' => (int) $periodo['id_periodo'],
        'anio' => $anio,

        // Primera columna: período.
        'periodo_nombre' => $periodo['periodo_nombre'],
        'periodo_meses' => $periodo['periodo_meses'],
        'periodo_label' => $label,

        'mes_desde' => $mesDesde,
        'mes_hasta' => $mesHasta,
        'fecha_inicio' => balance_inscripciones_fecha_inicio_periodo($anio, $mesDesde),
        'fecha_fin' => balance_inscripciones_fecha_fin_periodo($anio, $mesHasta),

        // Segunda columna / detalle: meses que incluye.
        'meses_incluidos' => $periodo['periodo_meses'],
        'meses_detalle' => $mesesDetalle,

        // Totales como estaban.
        'cantidad_total' => 0,
        'activos_cantidad' => 0,
        'pasivos_cantidad' => 0,
        'sin_estado_cantidad' => 0,

        'pagados_cantidad' => 0,
        'sin_pago_cantidad' => 0,

        // Monto unitario estimado/referencial del período.
        'monto_unitario' => 0,
        'monto_deberia_pagar' => 0,

        // Total esperado: suma de cada mes.
        'monto_esperado_total' => 0,

        // Total realmente pagado.
        'monto_pagado_total' => 0,
        'monto_total' => 0,

        'activos_monto_total' => 0,
        'pasivos_monto_total' => 0,
        'sin_estado_monto_total' => 0,

        'montos_observados' => [],

        'socios' => [],
        'socios_activos' => [],
        'socios_pasivos' => [],
        'socios_sin_estado' => [],
    ];
}

function balance_inscripciones_crear_periodos_del_rango(string $desde, string $hasta): array
{
    $anioDesde = (int) substr($desde, 0, 4);
    $anioHasta = (int) substr($hasta, 0, 4);

    $periodos = [];

    for ($anio = $anioDesde; $anio <= $anioHasta; $anio++) {
        for ($mes = 1; $mes <= 12; $mes += 2) {
            $periodo = balance_inscripciones_periodo_por_mes($mes);

            $fechaInicio = balance_inscripciones_fecha_inicio_periodo($anio, (int) $periodo['mes_desde']);
            $fechaFin = balance_inscripciones_fecha_fin_periodo($anio, (int) $periodo['mes_hasta']);

            if ($fechaFin < $desde || $fechaInicio > $hasta) {
                continue;
            }

            $key = sprintf('%04d-%02d', $anio, (int) $periodo['id_periodo']);
            $periodos[$key] = balance_inscripciones_crear_periodo_vacio($periodo, $anio);
        }
    }

    ksort($periodos);

    return $periodos;
}

function balance_inscripciones_grupo_estado(?int $idEstado, ?string $descripcion): string
{
    $desc = mb_strtoupper(trim((string) $descripcion), 'UTF-8');

    if ($idEstado === 1 || $desc === 'PASIVO') {
        return 'pasivos';
    }

    if ($idEstado === 2 || $desc === 'ACTIVO') {
        return 'activos';
    }

    return 'sin_estado';
}

function balance_inscripciones_grupo_label(string $grupo): string
{
    if ($grupo === 'activos') {
        return 'ACTIVO';
    }

    if ($grupo === 'pasivos') {
        return 'PASIVO';
    }

    return 'SIN ESTADO';
}

function balance_inscripciones_monto_frecuente(array $montos): float
{
    $frecuencias = [];

    foreach ($montos as $monto) {
        $monto = balance_inscripciones_formatear_monto($monto);

        if ($monto <= 0) {
            continue;
        }

        $key = number_format($monto, 2, '.', '');

        if (!isset($frecuencias[$key])) {
            $frecuencias[$key] = [
                'monto' => $monto,
                'cantidad' => 0,
            ];
        }

        $frecuencias[$key]['cantidad']++;
    }

    if (empty($frecuencias)) {
        return 0.0;
    }

    uasort($frecuencias, static function (array $a, array $b): int {
        if ($a['cantidad'] === $b['cantidad']) {
            return $b['monto'] <=> $a['monto'];
        }

        return $b['cantidad'] <=> $a['cantidad'];
    });

    $primero = reset($frecuencias);

    return balance_inscripciones_formatear_monto($primero['monto'] ?? 0);
}

function balance_inscripciones_normalizar_meses_detalle(array $mesesDetalle, float $montoPeriodoFallback, float $montoGlobalFallback): array
{
    foreach ($mesesDetalle as $index => $mes) {
        $montoUnitario = balance_inscripciones_monto_frecuente($mes['montos_observados'] ?? []);

        if ($montoUnitario <= 0) {
            $montoUnitario = $montoPeriodoFallback;
        }

        if ($montoUnitario <= 0) {
            $montoUnitario = $montoGlobalFallback;
        }

        $cantidadTotal = (int) ($mes['cantidad_total'] ?? 0);
        $montoPagadoTotal = balance_inscripciones_formatear_monto($mes['monto_pagado_total'] ?? 0);
        $montoEsperadoTotal = balance_inscripciones_formatear_monto($cantidadTotal * $montoUnitario);

        $mesesDetalle[$index]['monto_unitario'] = $montoUnitario;
        $mesesDetalle[$index]['monto_deberia_pagar'] = $montoUnitario;
        $mesesDetalle[$index]['monto_esperado_total'] = $montoEsperadoTotal;
        $mesesDetalle[$index]['monto_pagado_total'] = $montoPagadoTotal;

        // Compatibilidad con el frontend si ya lee monto_total.
        $mesesDetalle[$index]['monto_total'] = $montoPagadoTotal;

        unset($mesesDetalle[$index]['montos_observados']);
    }

    return $mesesDetalle;
}

try {
    $pdo = balance_inscripciones_pdo();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $rangoDefault = balance_inscripciones_rango_fechas_por_defecto();

    $desde = balance_inscripciones_validar_fecha($_GET['desde'] ?? null, $rangoDefault['desde']);
    $hasta = balance_inscripciones_validar_fecha($_GET['hasta'] ?? null, $rangoDefault['hasta']);

    if ($desde > $hasta) {
        throw new InvalidArgumentException('La fecha desde no puede ser mayor a la fecha hasta.');
    }

    $sqlSocios = "
        SELECT
            s.id_socio,
            s.nombre,
            s.dni,
            s.ingreso,
            s.id_estado,
            e.descripcion AS estado_descripcion,
            s.activo
        FROM socios s
        LEFT JOIN estado e 
            ON e.id_estado = s.id_estado
        WHERE s.ingreso IS NOT NULL
          AND s.activo = 1
          AND s.ingreso BETWEEN :desde AND :hasta
        ORDER BY s.ingreso ASC, s.nombre ASC, s.id_socio ASC
    ";

    $stmtSocios = $pdo->prepare($sqlSocios);
    $stmtSocios->execute([
        ':desde' => $desde,
        ':hasta' => $hasta,
    ]);

    $socios = $stmtSocios->fetchAll(PDO::FETCH_ASSOC);

    $pagosPorSocio = [];

    if (!empty($socios)) {
        $ids = array_values(array_unique(array_map(
            static fn ($row) => (int) $row['id_socio'],
            $socios
        )));

        if (!empty($ids)) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));

            $sqlPagos = "
                SELECT
                    pi.id_inscripcion,
                    pi.id_socio,
                    pi.monto,
                    pi.fecha_pago,
                    pi.id_medio_pago,
                    mp.nombre AS medio_pago_nombre
                FROM pagos_inscripcion pi
                LEFT JOIN medios_pago mp 
                    ON mp.id_medio_pago = pi.id_medio_pago
                WHERE pi.id_socio IN ($placeholders)
                ORDER BY pi.fecha_pago ASC, pi.id_inscripcion ASC
            ";

            $stmtPagos = $pdo->prepare($sqlPagos);
            $stmtPagos->execute($ids);

            while ($pago = $stmtPagos->fetch(PDO::FETCH_ASSOC)) {
                $idSocio = (int) $pago['id_socio'];

                if (!isset($pagosPorSocio[$idSocio])) {
                    $pagosPorSocio[$idSocio] = [];
                }

                $idMedioPago = isset($pago['id_medio_pago']) && $pago['id_medio_pago'] !== null
                    ? (int) $pago['id_medio_pago']
                    : null;

                $medioPagoNombre = trim((string) ($pago['medio_pago_nombre'] ?? ''));

                $pagosPorSocio[$idSocio][] = [
                    'id_inscripcion' => (int) $pago['id_inscripcion'],
                    'id_socio' => $idSocio,
                    'monto' => balance_inscripciones_formatear_monto($pago['monto'] ?? 0),
                    'fecha_pago' => $pago['fecha_pago'] ?? null,
                    'id_medio_pago' => $idMedioPago,
                    'medio_pago_nombre' => $medioPagoNombre !== '' ? $medioPagoNombre : null,
                ];
            }
        }
    }

    $periodos = balance_inscripciones_crear_periodos_del_rango($desde, $hasta);

    $resumen = [
        'activos' => [
            'cantidad' => 0,
            'pagados_cantidad' => 0,
            'sin_pago_cantidad' => 0,
            'monto_total' => 0,
            'monto_pagado_total' => 0,
            'monto_esperado_total' => 0,
            'socios' => [],
        ],
        'pasivos' => [
            'cantidad' => 0,
            'pagados_cantidad' => 0,
            'sin_pago_cantidad' => 0,
            'monto_total' => 0,
            'monto_pagado_total' => 0,
            'monto_esperado_total' => 0,
            'socios' => [],
        ],
        'sin_estado' => [
            'cantidad' => 0,
            'pagados_cantidad' => 0,
            'sin_pago_cantidad' => 0,
            'monto_total' => 0,
            'monto_pagado_total' => 0,
            'monto_esperado_total' => 0,
            'socios' => [],
        ],
    ];

    $items = [];
    $montosGlobalesObservados = [];

    foreach ($socios as $socio) {
        $idSocio = (int) $socio['id_socio'];
        $ingreso = (string) $socio['ingreso'];

        $dtIngreso = new DateTime($ingreso);
        $mes = (int) $dtIngreso->format('n');
        $anio = (int) $dtIngreso->format('Y');

        $periodoInfo = balance_inscripciones_periodo_por_mes($mes);
        $periodoKey = sprintf('%04d-%02d', $anio, (int) $periodoInfo['id_periodo']);
        $periodoLabel = $periodoInfo['periodo_nombre'] . ' / ' . $anio;

        if (!isset($periodos[$periodoKey])) {
            $periodos[$periodoKey] = balance_inscripciones_crear_periodo_vacio($periodoInfo, $anio);
        }

        $grupo = balance_inscripciones_grupo_estado(
            isset($socio['id_estado']) ? (int) $socio['id_estado'] : null,
            $socio['estado_descripcion'] ?? null
        );

        $grupoLabel = balance_inscripciones_grupo_label($grupo);

        $pagos = $pagosPorSocio[$idSocio] ?? [];
        $montoTotalPagadoSocio = 0.0;
        $fechasPago = [];
        $mediosPago = [];

        foreach ($pagos as $pago) {
            $montoPago = balance_inscripciones_formatear_monto($pago['monto'] ?? 0);
            $montoTotalPagadoSocio += $montoPago;

            if ($montoPago > 0) {
                $periodos[$periodoKey]['montos_observados'][] = $montoPago;
                $montosGlobalesObservados[] = $montoPago;
            }

            if (!empty($pago['fecha_pago'])) {
                $fechasPago[] = $pago['fecha_pago'];
            }

            if (!empty($pago['medio_pago_nombre'])) {
                $mediosPago[] = $pago['medio_pago_nombre'];
            }
        }

        $montoTotalPagadoSocio = balance_inscripciones_formatear_monto($montoTotalPagadoSocio);
        $mediosPago = array_values(array_unique($mediosPago));
        $pagado = count($pagos) > 0;

        $item = [
            'id_socio' => $idSocio,
            'nombre' => $socio['nombre'] ?? '',
            'dni' => $socio['dni'] ?? null,
            'ingreso' => $ingreso,
            'fecha_alta' => $ingreso,

            'periodo_key' => $periodoKey,
            'id_periodo' => (int) $periodoInfo['id_periodo'],
            'anio' => $anio,
            'periodo_nombre' => $periodoInfo['periodo_nombre'],
            'periodo_meses' => $periodoInfo['periodo_meses'],
            'periodo_label' => $periodoLabel,
            'periodo_balance' => $periodoLabel,

            'mes' => $mes,
            'mes_ingreso' => $mes,
            'mes_ingreso_nombre' => balance_inscripciones_nombre_mes($mes),

            'id_estado' => isset($socio['id_estado']) ? (int) $socio['id_estado'] : null,
            'estado_descripcion' => $socio['estado_descripcion'] ?? null,
            'grupo' => $grupo,
            'grupo_label' => $grupoLabel,
            'activo' => isset($socio['activo']) ? (int) $socio['activo'] : 1,

            'pagado' => $pagado,
            'pagos_cantidad' => count($pagos),

            // Total real pagado por inscripción.
            'monto_total' => $montoTotalPagadoSocio,
            'monto_pagado_total' => $montoTotalPagadoSocio,
            'monto_inscripcion' => $montoTotalPagadoSocio,

            // Se completa al final con el monto unitario estimado del mes.
            'monto_unitario' => 0,
            'monto_deberia_pagar' => 0,

            'fecha_pago_inscripcion' => $fechasPago[0] ?? null,
            'fechas_pago_inscripcion' => array_values($fechasPago),
            'medio_pago_inscripcion' => $mediosPago[0] ?? null,
            'medios_pago_inscripcion' => $mediosPago,
            'pagos' => $pagos,
        ];

        $items[] = $item;

        $periodos[$periodoKey]['cantidad_total']++;

        if ($grupo === 'activos') {
            $periodos[$periodoKey]['activos_cantidad']++;
            $periodos[$periodoKey]['activos_monto_total'] += $montoTotalPagadoSocio;
            $periodos[$periodoKey]['socios_activos'][] = $item;
        } elseif ($grupo === 'pasivos') {
            $periodos[$periodoKey]['pasivos_cantidad']++;
            $periodos[$periodoKey]['pasivos_monto_total'] += $montoTotalPagadoSocio;
            $periodos[$periodoKey]['socios_pasivos'][] = $item;
        } else {
            $periodos[$periodoKey]['sin_estado_cantidad']++;
            $periodos[$periodoKey]['sin_estado_monto_total'] += $montoTotalPagadoSocio;
            $periodos[$periodoKey]['socios_sin_estado'][] = $item;
        }

        if ($pagado) {
            $periodos[$periodoKey]['pagados_cantidad']++;
        } else {
            $periodos[$periodoKey]['sin_pago_cantidad']++;
        }

        $periodos[$periodoKey]['monto_pagado_total'] += $montoTotalPagadoSocio;
        $periodos[$periodoKey]['monto_total'] += $montoTotalPagadoSocio;
        $periodos[$periodoKey]['socios'][] = $item;

        foreach ($periodos[$periodoKey]['meses_detalle'] as $idxMes => $mesDetalle) {
            if ((int) $mesDetalle['mes'] !== $mes) {
                continue;
            }

            $periodos[$periodoKey]['meses_detalle'][$idxMes]['cantidad_total']++;

            if ($grupo === 'activos') {
                $periodos[$periodoKey]['meses_detalle'][$idxMes]['activos_cantidad']++;
                $periodos[$periodoKey]['meses_detalle'][$idxMes]['socios_activos'][] = $item;
            } elseif ($grupo === 'pasivos') {
                $periodos[$periodoKey]['meses_detalle'][$idxMes]['pasivos_cantidad']++;
                $periodos[$periodoKey]['meses_detalle'][$idxMes]['socios_pasivos'][] = $item;
            } else {
                $periodos[$periodoKey]['meses_detalle'][$idxMes]['sin_estado_cantidad']++;
                $periodos[$periodoKey]['meses_detalle'][$idxMes]['socios_sin_estado'][] = $item;
            }

            if ($pagado) {
                $periodos[$periodoKey]['meses_detalle'][$idxMes]['pagados_cantidad']++;
            } else {
                $periodos[$periodoKey]['meses_detalle'][$idxMes]['sin_pago_cantidad']++;
            }

            $periodos[$periodoKey]['meses_detalle'][$idxMes]['monto_pagado_total'] += $montoTotalPagadoSocio;
            $periodos[$periodoKey]['meses_detalle'][$idxMes]['monto_total'] += $montoTotalPagadoSocio;
            $periodos[$periodoKey]['meses_detalle'][$idxMes]['socios'][] = $item;

            if ($montoTotalPagadoSocio > 0) {
                $periodos[$periodoKey]['meses_detalle'][$idxMes]['montos_observados'][] = $montoTotalPagadoSocio;
            }

            break;
        }

        $resumen[$grupo]['cantidad']++;

        if ($pagado) {
            $resumen[$grupo]['pagados_cantidad']++;
        } else {
            $resumen[$grupo]['sin_pago_cantidad']++;
        }

        $resumen[$grupo]['monto_total'] += $montoTotalPagadoSocio;
        $resumen[$grupo]['monto_pagado_total'] += $montoTotalPagadoSocio;
        $resumen[$grupo]['socios'][] = $item;
    }

    ksort($periodos);

    $montoGlobalFallback = balance_inscripciones_monto_frecuente($montosGlobalesObservados);

    foreach ($periodos as $key => $periodo) {
        $montoPeriodo = balance_inscripciones_monto_frecuente($periodo['montos_observados'] ?? []);

        if ($montoPeriodo <= 0) {
            $montoPeriodo = $montoGlobalFallback;
        }

        $mesesDetalle = balance_inscripciones_normalizar_meses_detalle(
            $periodo['meses_detalle'] ?? [],
            $montoPeriodo,
            $montoGlobalFallback
        );

        $montoEsperadoPeriodo = 0.0;

        foreach ($mesesDetalle as $mesDetalle) {
            $montoEsperadoPeriodo += (float) ($mesDetalle['monto_esperado_total'] ?? 0);
        }

        $montoEsperadoPeriodo = balance_inscripciones_formatear_monto($montoEsperadoPeriodo);
        $montoPagadoPeriodo = balance_inscripciones_formatear_monto($periodo['monto_pagado_total'] ?? $periodo['monto_total'] ?? 0);

        $periodos[$key]['monto_unitario'] = $montoPeriodo;
        $periodos[$key]['monto_deberia_pagar'] = $montoPeriodo;
        $periodos[$key]['monto_esperado_total'] = $montoEsperadoPeriodo;

        $periodos[$key]['monto_pagado_total'] = $montoPagadoPeriodo;

        // Compatibilidad: monto_total sigue siendo lo realmente pagado.
        $periodos[$key]['monto_total'] = $montoPagadoPeriodo;

        $periodos[$key]['activos_monto_total'] = balance_inscripciones_formatear_monto($periodo['activos_monto_total']);
        $periodos[$key]['pasivos_monto_total'] = balance_inscripciones_formatear_monto($periodo['pasivos_monto_total']);
        $periodos[$key]['sin_estado_monto_total'] = balance_inscripciones_formatear_monto($periodo['sin_estado_monto_total']);

        $periodos[$key]['meses_detalle'] = $mesesDetalle;

        unset($periodos[$key]['montos_observados']);

        foreach ($periodos[$key]['socios'] as $idxSocio => $socioPeriodo) {
            $mesSocio = (int) ($socioPeriodo['mes_ingreso'] ?? $socioPeriodo['mes'] ?? 0);
            $montoMesSocio = $montoPeriodo;

            foreach ($mesesDetalle as $mesDetalle) {
                if ((int) $mesDetalle['mes'] === $mesSocio) {
                    $montoMesSocio = (float) $mesDetalle['monto_unitario'];
                    break;
                }
            }

            $periodos[$key]['socios'][$idxSocio]['monto_unitario'] = balance_inscripciones_formatear_monto($montoMesSocio);
            $periodos[$key]['socios'][$idxSocio]['monto_deberia_pagar'] = balance_inscripciones_formatear_monto($montoMesSocio);
        }
    }

    foreach ($resumen as $grupo => $data) {
        $resumen[$grupo]['monto_total'] = balance_inscripciones_formatear_monto($data['monto_total']);
        $resumen[$grupo]['monto_pagado_total'] = balance_inscripciones_formatear_monto($data['monto_pagado_total']);

        $montoEsperadoGrupo = 0.0;

        foreach ($data['socios'] as $socioResumen) {
            $periodoKeySocio = (string) ($socioResumen['periodo_key'] ?? '');

            if (!isset($periodos[$periodoKeySocio])) {
                continue;
            }

            $mesSocio = (int) ($socioResumen['mes_ingreso'] ?? $socioResumen['mes'] ?? 0);

            foreach ($periodos[$periodoKeySocio]['meses_detalle'] as $mesDetalle) {
                if ((int) $mesDetalle['mes'] === $mesSocio) {
                    $montoEsperadoGrupo += (float) ($mesDetalle['monto_unitario'] ?? 0);
                    break;
                }
            }
        }

        $resumen[$grupo]['monto_esperado_total'] = balance_inscripciones_formatear_monto($montoEsperadoGrupo);
    }

    $montoEsperadoTotal = 0.0;
    $montoPagadoTotal = 0.0;

    foreach ($periodos as $periodo) {
        $montoEsperadoTotal += (float) ($periodo['monto_esperado_total'] ?? 0);
        $montoPagadoTotal += (float) ($periodo['monto_pagado_total'] ?? 0);
    }

    $totales = [
        'total_inscripciones' => count($items),

        'activos' => (int) $resumen['activos']['cantidad'],
        'pasivos' => (int) $resumen['pasivos']['cantidad'],
        'sin_estado' => (int) $resumen['sin_estado']['cantidad'],

        'pagados_cantidad' =>
            (int) $resumen['activos']['pagados_cantidad']
            + (int) $resumen['pasivos']['pagados_cantidad']
            + (int) $resumen['sin_estado']['pagados_cantidad'],

        'sin_pago_cantidad' =>
            (int) $resumen['activos']['sin_pago_cantidad']
            + (int) $resumen['pasivos']['sin_pago_cantidad']
            + (int) $resumen['sin_estado']['sin_pago_cantidad'],

        // Total real pagado.
        'monto_total' => balance_inscripciones_formatear_monto($montoPagadoTotal),
        'monto_pagado_total' => balance_inscripciones_formatear_monto($montoPagadoTotal),

        // Total que deberían pagar según cantidad de inscriptos y monto unitario detectado por mes.
        'monto_esperado_total' => balance_inscripciones_formatear_monto($montoEsperadoTotal),
        'monto_deberia_cobrar_total' => balance_inscripciones_formatear_monto($montoEsperadoTotal),

        // Monto de referencia general.
        'monto_unitario_referencia' => balance_inscripciones_formatear_monto($montoGlobalFallback),
    ];

    balance_inscripciones_responder([
        'ok' => true,
        'exito' => true,
        'mensaje' => 'Inscripciones del balance obtenidas correctamente por período y meses.',
        'desde' => $desde,
        'hasta' => $hasta,
        'criterio' => 'Las inscripciones se filtran por socios activos (socios.activo = 1), se agrupan por período bimestral según la fecha de ingreso y se detalla cada mes incluido en el período.',
        'totales' => $totales,
        'resumen' => $resumen,
        'periodos' => array_values($periodos),
        'items' => $items,
    ]);
} catch (InvalidArgumentException $e) {
    balance_inscripciones_responder([
        'ok' => false,
        'exito' => false,
        'mensaje' => $e->getMessage(),
    ], 400);
} catch (Throwable $e) {
    error_log('[BALANCE INSCRIPCIONES ERROR] ' . $e->getMessage());

    balance_inscripciones_responder([
        'ok' => false,
        'exito' => false,
        'mensaje' => 'Error interno al obtener las inscripciones del balance.',
    ], 500);
}