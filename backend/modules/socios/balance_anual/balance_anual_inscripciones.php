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
        $conexion = db();
        if ($conexion instanceof PDO) {
            return $conexion;
        }
    }

    if (function_exists('getConnection')) {
        $conexion = getConnection();
        if ($conexion instanceof PDO) {
            return $conexion;
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

    $dt = DateTime::createFromFormat('!Y-m-d', $fecha);

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
        1 => 'ENERO', 2 => 'FEBRERO', 3 => 'MARZO', 4 => 'ABRIL',
        5 => 'MAYO', 6 => 'JUNIO', 7 => 'JULIO', 8 => 'AGOSTO',
        9 => 'SEPTIEMBRE', 10 => 'OCTUBRE', 11 => 'NOVIEMBRE', 12 => 'DICIEMBRE',
    ];

    return $meses[$mes] ?? 'SIN MES';
}

function balance_inscripciones_periodo_por_mes(int $mes): array
{
    $map = [
        1 => [1, 1, 2, 'PERÍODO 1 Y 2', 'ENERO - FEBRERO'],
        2 => [1, 1, 2, 'PERÍODO 1 Y 2', 'ENERO - FEBRERO'],
        3 => [2, 3, 4, 'PERÍODO 3 Y 4', 'MARZO - ABRIL'],
        4 => [2, 3, 4, 'PERÍODO 3 Y 4', 'MARZO - ABRIL'],
        5 => [3, 5, 6, 'PERÍODO 5 Y 6', 'MAYO - JUNIO'],
        6 => [3, 5, 6, 'PERÍODO 5 Y 6', 'MAYO - JUNIO'],
        7 => [4, 7, 8, 'PERÍODO 7 Y 8', 'JULIO - AGOSTO'],
        8 => [4, 7, 8, 'PERÍODO 7 Y 8', 'JULIO - AGOSTO'],
        9 => [5, 9, 10, 'PERÍODO 9 Y 10', 'SEPTIEMBRE - OCTUBRE'],
        10 => [5, 9, 10, 'PERÍODO 9 Y 10', 'SEPTIEMBRE - OCTUBRE'],
        11 => [6, 11, 12, 'PERÍODO 11 Y 12', 'NOVIEMBRE - DICIEMBRE'],
        12 => [6, 11, 12, 'PERÍODO 11 Y 12', 'NOVIEMBRE - DICIEMBRE'],
    ];

    $datos = $map[$mes] ?? $map[12];

    return [
        'id_periodo' => $datos[0],
        'mes_desde' => $datos[1],
        'mes_hasta' => $datos[2],
        'periodo_nombre' => $datos[3],
        'periodo_meses' => $datos[4],
    ];
}

function balance_inscripciones_fecha_inicio_periodo(int $anio, int $mesDesde): string
{
    return sprintf('%04d-%02d-01', $anio, $mesDesde);
}

function balance_inscripciones_fecha_fin_periodo(int $anio, int $mesHasta): string
{
    $fecha = DateTime::createFromFormat('!Y-m-d', sprintf('%04d-%02d-01', $anio, $mesHasta));

    if (!$fecha) {
        return sprintf('%04d-%02d-28', $anio, $mesHasta);
    }

    $fecha->modify('last day of this month');
    return $fecha->format('Y-m-d');
}

function balance_inscripciones_monto($valor): float
{
    if ($valor === null || $valor === '') {
        return 0.0;
    }

    return round((float) $valor, 2);
}

function balance_inscripciones_grupo_estado(?int $idEstado, ?string $descripcion): string
{
    $desc = mb_strtoupper(trim((string) $descripcion), 'UTF-8');

    if ($idEstado === 1 || str_contains($desc, 'PASIV')) {
        return 'pasivos';
    }

    if ($idEstado === 2 || str_contains($desc, 'ACTIV')) {
        return 'activos';
    }

    return 'sin_estado';
}

function balance_inscripciones_grupo_label(string $grupo): string
{
    return match ($grupo) {
        'activos' => 'ACTIVO',
        'pasivos' => 'PASIVO',
        default => 'SIN ESTADO',
    };
}

function balance_inscripciones_mes_vacio(int $anio, int $mes): array
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
        'registros_sin_importe_cantidad' => 0,
        'sin_registro_pago_cantidad' => 0,
        'monto_unitario' => 0,
        'monto_deberia_pagar' => 0,
        'monto_esperado_total' => 0,
        'monto_pagado_total' => 0,
        'monto_total' => 0,
        'socios' => [],
        'socios_activos' => [],
        'socios_pasivos' => [],
        'socios_sin_estado' => [],
    ];
}

function balance_inscripciones_periodo_vacio(array $periodo, int $anio): array
{
    $mesesDetalle = [];

    for ($mes = (int) $periodo['mes_desde']; $mes <= (int) $periodo['mes_hasta']; $mes++) {
        $mesesDetalle[] = balance_inscripciones_mes_vacio($anio, $mes);
    }

    return [
        'key' => sprintf('%04d-%02d', $anio, (int) $periodo['id_periodo']),
        'id_periodo' => (int) $periodo['id_periodo'],
        'anio' => $anio,
        'periodo_nombre' => $periodo['periodo_nombre'],
        'periodo_meses' => $periodo['periodo_meses'],
        'periodo_label' => $periodo['periodo_nombre'] . ' / ' . $anio,
        'mes_desde' => (int) $periodo['mes_desde'],
        'mes_hasta' => (int) $periodo['mes_hasta'],
        'fecha_inicio' => balance_inscripciones_fecha_inicio_periodo($anio, (int) $periodo['mes_desde']),
        'fecha_fin' => balance_inscripciones_fecha_fin_periodo($anio, (int) $periodo['mes_hasta']),
        'meses_incluidos' => $periodo['periodo_meses'],
        'meses_detalle' => $mesesDetalle,
        'cantidad_total' => 0,
        'activos_cantidad' => 0,
        'pasivos_cantidad' => 0,
        'sin_estado_cantidad' => 0,
        'pagados_cantidad' => 0,
        'sin_pago_cantidad' => 0,
        'registros_sin_importe_cantidad' => 0,
        'sin_registro_pago_cantidad' => 0,
        'monto_unitario' => 0,
        'monto_deberia_pagar' => 0,
        'monto_esperado_total' => 0,
        'monto_pagado_total' => 0,
        'monto_total' => 0,
        'activos_monto_total' => 0,
        'pasivos_monto_total' => 0,
        'sin_estado_monto_total' => 0,
        'socios' => [],
        'socios_activos' => [],
        'socios_pasivos' => [],
        'socios_sin_estado' => [],
    ];
}

function balance_inscripciones_periodos_rango(string $desde, string $hasta): array
{
    $periodos = [];
    $anioDesde = (int) substr($desde, 0, 4);
    $anioHasta = (int) substr($hasta, 0, 4);

    for ($anio = $anioDesde; $anio <= $anioHasta; $anio++) {
        for ($mes = 1; $mes <= 12; $mes += 2) {
            $info = balance_inscripciones_periodo_por_mes($mes);
            $inicio = balance_inscripciones_fecha_inicio_periodo($anio, (int) $info['mes_desde']);
            $fin = balance_inscripciones_fecha_fin_periodo($anio, (int) $info['mes_hasta']);

            if ($fin < $desde || $inicio > $hasta) {
                continue;
            }

            $periodo = balance_inscripciones_periodo_vacio($info, $anio);
            $periodos[$periodo['key']] = $periodo;
        }
    }

    ksort($periodos);
    return $periodos;
}

function balance_inscripciones_pago_valido(array $pago): bool
{
    $fechaPago = trim((string) ($pago['fecha_pago'] ?? ''));

    if ($fechaPago === '') {
        return false;
    }

    // El rango corresponde a la fecha de alta. El pago puede haberse registrado
    // antes o después de esa fecha; si pertenece al socio, sigue siendo el pago real
    // de esa inscripción.
    return true;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        balance_inscripciones_responder([
            'ok' => false,
            'exito' => false,
            'mensaje' => 'Método no permitido.',
        ], 405);
    }

    $pdo = balance_inscripciones_pdo();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $rangoDefault = balance_inscripciones_rango_fechas_por_defecto();
    $desde = balance_inscripciones_validar_fecha($_GET['desde'] ?? null, $rangoDefault['desde']);
    $hasta = balance_inscripciones_validar_fecha($_GET['hasta'] ?? null, $rangoDefault['hasta']);

    if ($desde > $hasta) {
        throw new InvalidArgumentException('La fecha desde no puede ser mayor a la fecha hasta.');
    }

    /*
     * Se incluyen altas que hoy estén activas o dadas de baja. Excluir s.activo = 0
     * hacía desaparecer inscripciones históricas reales del reporte.
     */
    $sqlSocios = "
        SELECT
            s.id_socio,
            s.nombre,
            s.dni,
            s.ingreso,
            s.id_estado,
            e.descripcion AS estado_descripcion,
            s.activo,
            s.fecha_baja
        FROM socios s
        LEFT JOIN estado e ON e.id_estado = s.id_estado
        WHERE s.ingreso IS NOT NULL
          AND s.ingreso BETWEEN :desde AND :hasta
        ORDER BY s.ingreso ASC, s.nombre ASC, s.id_socio ASC
    ";

    $stmtSocios = $pdo->prepare($sqlSocios);
    $stmtSocios->execute([':desde' => $desde, ':hasta' => $hasta]);
    $socios = $stmtSocios->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $pagosPorSocio = [];

    if (!empty($socios)) {
        $ids = array_values(array_unique(array_map(
            static fn (array $row): int => (int) $row['id_socio'],
            $socios
        )));

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
            LEFT JOIN medios_pago mp ON mp.id_medio_pago = pi.id_medio_pago
            WHERE pi.id_socio IN ($placeholders)
            ORDER BY pi.id_socio ASC, pi.fecha_pago DESC, pi.id_inscripcion DESC
        ";

        $stmtPagos = $pdo->prepare($sqlPagos);
        $stmtPagos->execute($ids);

        while ($pago = $stmtPagos->fetch(PDO::FETCH_ASSOC)) {
            $idSocio = (int) $pago['id_socio'];
            $pagosPorSocio[$idSocio][] = [
                'id_inscripcion' => (int) $pago['id_inscripcion'],
                'id_socio' => $idSocio,
                'monto' => balance_inscripciones_monto($pago['monto'] ?? 0),
                'fecha_pago' => $pago['fecha_pago'] ?? null,
                'id_medio_pago' => $pago['id_medio_pago'] !== null ? (int) $pago['id_medio_pago'] : null,
                'medio_pago_nombre' => trim((string) ($pago['medio_pago_nombre'] ?? '')) ?: null,
            ];
        }
    }

    $periodos = balance_inscripciones_periodos_rango($desde, $hasta);
    $resumen = [];

    foreach (['activos', 'pasivos', 'sin_estado'] as $grupo) {
        $resumen[$grupo] = [
            'cantidad' => 0,
            'pagados_cantidad' => 0,
            'sin_pago_cantidad' => 0,
            'registros_sin_importe_cantidad' => 0,
            'sin_registro_pago_cantidad' => 0,
            'monto_total' => 0,
            'monto_pagado_total' => 0,
            'monto_esperado_total' => 0,
            'socios' => [],
        ];
    }

    $items = [];
    $advertencias = [];
    $duplicados = [];
    $inactivosSinRegistroExcluidos = 0;

    foreach ($socios as $socio) {
        $idSocio = (int) $socio['id_socio'];
        $ingreso = (string) $socio['ingreso'];
        $dtIngreso = DateTime::createFromFormat('!Y-m-d', $ingreso);

        if (!$dtIngreso) {
            $advertencias[] = [
                'codigo' => 'FECHA_INGRESO_INVALIDA',
                'id_socio' => $idSocio,
                'ingreso' => $ingreso,
            ];
            continue;
        }

        $mes = (int) $dtIngreso->format('n');
        $anio = (int) $dtIngreso->format('Y');
        $periodoInfo = balance_inscripciones_periodo_por_mes($mes);
        $periodoKey = sprintf('%04d-%02d', $anio, (int) $periodoInfo['id_periodo']);

        if (!isset($periodos[$periodoKey])) {
            $periodos[$periodoKey] = balance_inscripciones_periodo_vacio($periodoInfo, $anio);
        }

        $grupo = balance_inscripciones_grupo_estado(
            $socio['id_estado'] !== null ? (int) $socio['id_estado'] : null,
            $socio['estado_descripcion'] ?? null
        );
        $grupoLabel = balance_inscripciones_grupo_label($grupo);

        $candidatos = array_values(array_filter(
            $pagosPorSocio[$idSocio] ?? [],
            static fn (array $pago): bool => balance_inscripciones_pago_valido($pago)
        ));

        /*
         * Los socios cargados directamente como "baja" reciben ingreso = fecha de carga,
         * aunque no representan una inscripción del período. Para no inflar el balance:
         * - los socios activos con alta en rango se incluyen;
         * - un socio hoy inactivo sólo se incluye si existe un registro de inscripción
         *   válido que pruebe que realmente pasó por ese flujo.
         */
        if ((int) ($socio['activo'] ?? 0) === 0 && empty($candidatos)) {
            $inactivosSinRegistroExcluidos++;
            continue;
        }

        if (count($candidatos) > 1) {
            $duplicados[] = [
                'id_socio' => $idSocio,
                'ids_inscripcion' => array_map(
                    static fn (array $pago): int => (int) $pago['id_inscripcion'],
                    $candidatos
                ),
                'criterio_aplicado' => 'Se toma un único registro: el pago positivo más reciente; si no existe, el registro más reciente.',
            ];
        }

        $pagoCanonico = null;

        foreach ($candidatos as $candidato) {
            if ((float) $candidato['monto'] > 0) {
                $pagoCanonico = $candidato;
                break;
            }
        }

        if ($pagoCanonico === null && !empty($candidatos)) {
            $pagoCanonico = $candidatos[0];
        }

        $montoPagado = $pagoCanonico !== null
            ? balance_inscripciones_monto($pagoCanonico['monto'] ?? 0)
            : 0.0;

        $pagado = $montoPagado > 0;
        $registroSinImporte = $pagoCanonico !== null && !$pagado;
        $sinRegistroPago = $pagoCanonico === null;
        $pagos = $pagoCanonico !== null ? [$pagoCanonico] : [];

        $item = [
            'id_socio' => $idSocio,
            'nombre' => $socio['nombre'] ?? '',
            'dni' => $socio['dni'] ?? null,
            'ingreso' => $ingreso,
            'fecha_alta' => $ingreso,
            'fecha_baja_actual' => $socio['fecha_baja'] ?? null,
            'socio_activo_actual' => isset($socio['activo']) ? (int) $socio['activo'] : null,
            'periodo_key' => $periodoKey,
            'id_periodo' => (int) $periodoInfo['id_periodo'],
            'anio' => $anio,
            'periodo_nombre' => $periodoInfo['periodo_nombre'],
            'periodo_meses' => $periodoInfo['periodo_meses'],
            'periodo_label' => $periodoInfo['periodo_nombre'] . ' / ' . $anio,
            'periodo_balance' => $periodoInfo['periodo_nombre'] . ' / ' . $anio,
            'mes' => $mes,
            'mes_ingreso' => $mes,
            'mes_ingreso_nombre' => balance_inscripciones_nombre_mes($mes),
            'id_estado' => $socio['id_estado'] !== null ? (int) $socio['id_estado'] : null,
            'estado_descripcion' => $socio['estado_descripcion'] ?? null,
            'grupo' => $grupo,
            'grupo_label' => $grupoLabel,
            'activo' => isset($socio['activo']) ? (int) $socio['activo'] : null,
            'pagado' => $pagado,
            'estado_pago_inscripcion' => $pagado
                ? 'PAGADA'
                : ($registroSinImporte ? 'REGISTRO SIN IMPORTE' : 'SIN PAGO REGISTRADO'),
            'registro_sin_importe' => $registroSinImporte,
            'sin_registro_pago' => $sinRegistroPago,
            'pagos_cantidad' => $pagado ? 1 : 0,
            'registros_pago_cantidad' => $pagoCanonico !== null ? 1 : 0,
            'monto_total' => $montoPagado,
            'monto_pagado_total' => $montoPagado,
            'monto_inscripcion' => $montoPagado,
            // No existe una tabla de arancel histórico de inscripción. No se inventa un esperado.
            'monto_unitario' => 0,
            'monto_deberia_pagar' => 0,
            'fecha_pago_inscripcion' => $pagoCanonico['fecha_pago'] ?? null,
            'fechas_pago_inscripcion' => $pagoCanonico !== null && !empty($pagoCanonico['fecha_pago'])
                ? [$pagoCanonico['fecha_pago']]
                : [],
            'medio_pago_inscripcion' => $pagoCanonico['medio_pago_nombre'] ?? null,
            'medios_pago_inscripcion' => $pagoCanonico !== null && !empty($pagoCanonico['medio_pago_nombre'])
                ? [$pagoCanonico['medio_pago_nombre']]
                : [],
            'pagos' => $pagos,
        ];

        $items[] = $item;
        $periodos[$periodoKey]['cantidad_total']++;
        $periodos[$periodoKey]['socios'][] = $item;
        $periodos[$periodoKey]['monto_pagado_total'] += $montoPagado;
        $periodos[$periodoKey]['monto_total'] += $montoPagado;

        if ($grupo === 'activos') {
            $periodos[$periodoKey]['activos_cantidad']++;
            $periodos[$periodoKey]['activos_monto_total'] += $montoPagado;
            $periodos[$periodoKey]['socios_activos'][] = $item;
        } elseif ($grupo === 'pasivos') {
            $periodos[$periodoKey]['pasivos_cantidad']++;
            $periodos[$periodoKey]['pasivos_monto_total'] += $montoPagado;
            $periodos[$periodoKey]['socios_pasivos'][] = $item;
        } else {
            $periodos[$periodoKey]['sin_estado_cantidad']++;
            $periodos[$periodoKey]['sin_estado_monto_total'] += $montoPagado;
            $periodos[$periodoKey]['socios_sin_estado'][] = $item;
        }

        if ($pagado) {
            $periodos[$periodoKey]['pagados_cantidad']++;
        } else {
            $periodos[$periodoKey]['sin_pago_cantidad']++;
        }

        if ($registroSinImporte) {
            $periodos[$periodoKey]['registros_sin_importe_cantidad']++;
        }

        if ($sinRegistroPago) {
            $periodos[$periodoKey]['sin_registro_pago_cantidad']++;
        }

        foreach ($periodos[$periodoKey]['meses_detalle'] as $idxMes => $mesDetalle) {
            if ((int) $mesDetalle['mes'] !== $mes) {
                continue;
            }

            $mesRef = &$periodos[$periodoKey]['meses_detalle'][$idxMes];
            $mesRef['cantidad_total']++;
            $mesRef['monto_pagado_total'] += $montoPagado;
            $mesRef['monto_total'] += $montoPagado;
            $mesRef['socios'][] = $item;

            if ($grupo === 'activos') {
                $mesRef['activos_cantidad']++;
                $mesRef['socios_activos'][] = $item;
            } elseif ($grupo === 'pasivos') {
                $mesRef['pasivos_cantidad']++;
                $mesRef['socios_pasivos'][] = $item;
            } else {
                $mesRef['sin_estado_cantidad']++;
                $mesRef['socios_sin_estado'][] = $item;
            }

            if ($pagado) {
                $mesRef['pagados_cantidad']++;
            } else {
                $mesRef['sin_pago_cantidad']++;
            }

            if ($registroSinImporte) {
                $mesRef['registros_sin_importe_cantidad']++;
            }

            if ($sinRegistroPago) {
                $mesRef['sin_registro_pago_cantidad']++;
            }

            unset($mesRef);
            break;
        }

        $resumen[$grupo]['cantidad']++;
        $resumen[$grupo]['monto_total'] += $montoPagado;
        $resumen[$grupo]['monto_pagado_total'] += $montoPagado;
        $resumen[$grupo]['socios'][] = $item;

        if ($pagado) {
            $resumen[$grupo]['pagados_cantidad']++;
        } else {
            $resumen[$grupo]['sin_pago_cantidad']++;
        }

        if ($registroSinImporte) {
            $resumen[$grupo]['registros_sin_importe_cantidad']++;
        }

        if ($sinRegistroPago) {
            $resumen[$grupo]['sin_registro_pago_cantidad']++;
        }
    }

    ksort($periodos);

    foreach ($periodos as $key => $periodo) {
        foreach (['monto_pagado_total', 'monto_total', 'activos_monto_total', 'pasivos_monto_total', 'sin_estado_monto_total'] as $campo) {
            $periodos[$key][$campo] = balance_inscripciones_monto($periodo[$campo] ?? 0);
        }

        foreach ($periodos[$key]['meses_detalle'] as $idxMes => $mesDetalle) {
            $periodos[$key]['meses_detalle'][$idxMes]['monto_pagado_total'] = balance_inscripciones_monto($mesDetalle['monto_pagado_total'] ?? 0);
            $periodos[$key]['meses_detalle'][$idxMes]['monto_total'] = balance_inscripciones_monto($mesDetalle['monto_total'] ?? 0);
        }
    }

    foreach ($resumen as $grupo => $data) {
        $resumen[$grupo]['monto_total'] = balance_inscripciones_monto($data['monto_total'] ?? 0);
        $resumen[$grupo]['monto_pagado_total'] = balance_inscripciones_monto($data['monto_pagado_total'] ?? 0);
    }

    $montoItems = balance_inscripciones_monto(array_sum(array_map(
        static fn (array $item): float => balance_inscripciones_monto($item['monto_pagado_total'] ?? 0),
        $items
    )));
    $montoPeriodos = balance_inscripciones_monto(array_sum(array_map(
        static fn (array $periodo): float => balance_inscripciones_monto($periodo['monto_pagado_total'] ?? 0),
        $periodos
    )));
    $montoResumen = balance_inscripciones_monto(
        (float) $resumen['activos']['monto_pagado_total']
        + (float) $resumen['pasivos']['monto_pagado_total']
        + (float) $resumen['sin_estado']['monto_pagado_total']
    );

    $cantidadPeriodos = array_sum(array_map(
        static fn (array $periodo): int => (int) ($periodo['cantidad_total'] ?? 0),
        $periodos
    ));
    $cantidadResumen = (int) $resumen['activos']['cantidad']
        + (int) $resumen['pasivos']['cantidad']
        + (int) $resumen['sin_estado']['cantidad'];

    if (count($items) !== $cantidadPeriodos || count($items) !== $cantidadResumen) {
        throw new RuntimeException('El balance de inscripciones no cerró el control de cantidades.');
    }

    if (abs($montoItems - $montoPeriodos) > 0.009 || abs($montoItems - $montoResumen) > 0.009) {
        throw new RuntimeException('El balance de inscripciones no cerró el control de montos.');
    }

    if (!empty($duplicados)) {
        $advertencias[] = [
            'codigo' => 'INSCRIPCIONES_DUPLICADAS_POR_SOCIO',
            'cantidad_socios' => count($duplicados),
            'detalle' => $duplicados,
            'impacto_calculo' => 'SIN DOBLE IMPACTO: se usa un único registro canónico por socio.',
        ];
    }

    $pagadosCantidad = array_sum(array_map(
        static fn (array $item): int => !empty($item['pagado']) ? 1 : 0,
        $items
    ));
    $registrosSinImporteCantidad = array_sum(array_map(
        static fn (array $item): int => !empty($item['registro_sin_importe']) ? 1 : 0,
        $items
    ));
    $sinRegistroPagoCantidad = array_sum(array_map(
        static fn (array $item): int => !empty($item['sin_registro_pago']) ? 1 : 0,
        $items
    ));

    $totales = [
        'total_inscripciones' => count($items),
        'activos' => (int) $resumen['activos']['cantidad'],
        'pasivos' => (int) $resumen['pasivos']['cantidad'],
        'sin_estado' => (int) $resumen['sin_estado']['cantidad'],
        'pagados_cantidad' => $pagadosCantidad,
        'sin_pago_cantidad' => count($items) - $pagadosCantidad,
        'registros_sin_importe_cantidad' => $registrosSinImporteCantidad,
        'sin_registro_pago_cantidad' => $sinRegistroPagoCantidad,
        'monto_total' => $montoItems,
        'monto_pagado_total' => $montoItems,
        // Compatibilidad: ya no se inventa un valor esperado sin fuente histórica.
        'monto_esperado_total' => 0,
        'monto_deberia_cobrar_total' => 0,
        'monto_unitario_referencia' => 0,
        'monto_esperado_disponible' => false,
    ];

    balance_inscripciones_responder([
        'ok' => true,
        'exito' => true,
        'mensaje' => 'Inscripciones del balance obtenidas correctamente.',
        'desde' => $desde,
        'hasta' => $hasta,
        'criterio' => 'Se incluyen socios activos cuya fecha socios.ingreso cae dentro del rango. Los socios hoy dados de baja sólo se incluyen si tienen un registro válido en pagos_inscripcion, evitando contar como altas a personas cargadas directamente desde el flujo Agregar socio dado de baja. Una inscripción se considera pagada únicamente si el registro válido tiene monto mayor a cero.',
        'criterio_monto' => 'El total informado es exclusivamente el monto real almacenado en pagos_inscripcion. Los registros de monto cero no se presentan como pagos y no se calcula un monto esperado porque la base no posee un arancel histórico de inscripción.',
        'auditoria_calculo' => [
            'control_ok' => true,
            'cantidad_detalle' => count($items),
            'cantidad_periodos' => $cantidadPeriodos,
            'cantidad_resumen_estados' => $cantidadResumen,
            'monto_detalle' => $montoItems,
            'monto_periodos' => $montoPeriodos,
            'monto_resumen_estados' => $montoResumen,
            'duplicados_detectados' => count($duplicados),
            'socios_consultados_por_fecha_ingreso' => count($socios),
            'inactivos_sin_registro_inscripcion_excluidos' => $inactivosSinRegistroExcluidos,
        ],
        'advertencias_auditoria' => $advertencias,
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
