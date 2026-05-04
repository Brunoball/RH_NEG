<?php
// backend/modules/socios/balance_anual/balance_anual_preview.php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Balance anual - Vista previa de bajas por período + pagos
|--------------------------------------------------------------------------
| Este archivo solamente:
| 1. Obtiene socios dados de baja.
| 2. Usa socios.fecha_baja.
| 3. Calcula el período bimestral de la baja.
| 4. Separa bajas por estado: Activo / Pasivo / Sin estado.
| 5. Busca en pagos los períodos pagados por cada socio dado de baja.
| 6. Devuelve período pagado, año aplicado y monto.
|
| No registra pagos.
| No aplica bajas.
| No lee Word.
| No modifica datos.
|--------------------------------------------------------------------------
*/

function balance_response(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function balance_get_pdo(): PDO
{
    if (function_exists('db')) {
        return db();
    }

    if (function_exists('getConnection')) {
        return getConnection();
    }

    if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
        return $GLOBALS['pdo'];
    }

    if (isset($GLOBALS['conn']) && $GLOBALS['conn'] instanceof PDO) {
        return $GLOBALS['conn'];
    }

    throw new RuntimeException('No se pudo obtener la conexión PDO.');
}

function balance_periodo_bimestral_por_mes(int $mes): array
{
    if ($mes < 1 || $mes > 12) {
        return [
            'desde' => null,
            'hasta' => null,
            'label' => 'Sin período',
        ];
    }

    if ($mes % 2 === 1) {
        $desde = $mes;
        $hasta = $mes + 1;
    } else {
        $desde = $mes - 1;
        $hasta = $mes;
    }

    return [
        'desde' => $desde,
        'hasta' => $hasta,
        'label' => $desde . '/' . $hasta,
    ];
}

function balance_periodo_bimestral_por_id(int $idPeriodo): array
{
    $map = [
        1 => ['desde' => 1,  'hasta' => 2,  'label' => '1/2'],
        2 => ['desde' => 3,  'hasta' => 4,  'label' => '3/4'],
        3 => ['desde' => 5,  'hasta' => 6,  'label' => '5/6'],
        4 => ['desde' => 7,  'hasta' => 8,  'label' => '7/8'],
        5 => ['desde' => 9,  'hasta' => 10, 'label' => '9/10'],
        6 => ['desde' => 11, 'hasta' => 12, 'label' => '11/12'],
        7 => ['desde' => 1,  'hasta' => 12, 'label' => 'Contado anual'],
    ];

    return $map[$idPeriodo] ?? [
        'desde' => null,
        'hasta' => null,
        'label' => 'Período ' . $idPeriodo,
    ];
}

function balance_sort_periodo(int $anio, ?int $mesDesde): int
{
    if (!$anio || !$mesDesde) {
        return 0;
    }

    return ($anio * 100) + $mesDesde;
}

function balance_normalizar_estado(?string $estado): array
{
    $estadoOriginal = trim((string) $estado);
    $estadoLower = mb_strtolower($estadoOriginal, 'UTF-8');

    if (str_contains($estadoLower, 'pasiv')) {
        return [
            'key' => 'pasivos',
            'label' => 'Pasivo',
        ];
    }

    if (str_contains($estadoLower, 'activ')) {
        return [
            'key' => 'activos',
            'label' => 'Activo',
        ];
    }

    return [
        'key' => 'sin_estado',
        'label' => 'Sin estado',
    ];
}

function balance_formatear_monto($valor): float
{
    if ($valor === null || $valor === '') {
        return 0.0;
    }

    return round((float) $valor, 2);
}

function balance_rango_fechas_por_defecto(): array
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

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        balance_response([
            'ok' => false,
            'exito' => false,
            'mensaje' => 'Método no permitido.',
        ], 405);
    }

    $pdo = balance_get_pdo();

    /*
        Rango del balance:
        - Si el frontend envía ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD, se usa ese rango.
        - Si no se envía rango, se calcula automáticamente:
          * Enero a junio: 01/07 del año anterior al 30/06 del año actual.
          * Julio en adelante: 01/07 del año actual al día actual.
    */
    $rangoDefault = balance_rango_fechas_por_defecto();
    $fechaDesde = $_GET['desde'] ?? $rangoDefault['desde'];
    $fechaHasta = $_GET['hasta'] ?? $rangoDefault['hasta'];

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaDesde)) {
        balance_response([
            'ok' => false,
            'exito' => false,
            'mensaje' => 'La fecha desde no es válida.',
        ], 400);
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaHasta)) {
        balance_response([
            'ok' => false,
            'exito' => false,
            'mensaje' => 'La fecha hasta no es válida.',
        ], 400);
    }

    if ($fechaDesde > $fechaHasta) {
        balance_response([
            'ok' => false,
            'exito' => false,
            'mensaje' => 'La fecha desde no puede ser mayor que la fecha hasta.',
        ], 400);
    }

    $anioDesde = (int) substr($fechaDesde, 0, 4);
    $mesDesde = (int) substr($fechaDesde, 5, 2);
    $anioHasta = (int) substr($fechaHasta, 0, 4);
    $mesHasta = (int) substr($fechaHasta, 5, 2);

    $periodoInicioBalance = balance_periodo_bimestral_por_mes($mesDesde);
    $periodoFinBalance = balance_periodo_bimestral_por_mes($mesHasta);

    $sortInicioBalance = balance_sort_periodo($anioDesde, $periodoInicioBalance['desde']);
    $sortFinBalance = balance_sort_periodo($anioHasta, $periodoFinBalance['desde']);

    /*
        1) Buscar socios dados de baja.
    */
    $sqlBajas = "
        SELECT
            s.id_socio,
            s.nombre,
            s.activo,
            s.id_estado,
            s.fecha_baja,
            s.motivo,
            e.descripcion AS estado_descripcion,
            MONTH(s.fecha_baja) AS mes_baja,
            YEAR(s.fecha_baja) AS anio_baja
        FROM socios s
        LEFT JOIN estado e ON e.id_estado = s.id_estado
        WHERE s.activo = 0
          AND s.fecha_baja IS NOT NULL
          AND s.fecha_baja BETWEEN :desde AND :hasta
        ORDER BY
            YEAR(s.fecha_baja) ASC,
            MONTH(s.fecha_baja) ASC,
            s.fecha_baja ASC,
            e.descripcion ASC,
            s.nombre ASC
    ";

    $stmtBajas = $pdo->prepare($sqlBajas);
    $stmtBajas->execute([
        ':desde' => $fechaDesde,
        ':hasta' => $fechaHasta,
    ]);

    $rowsBajas = $stmtBajas->fetchAll(PDO::FETCH_ASSOC);

    $idsSocios = array_values(array_unique(array_map(
        fn ($row) => (int) $row['id_socio'],
        $rowsBajas
    )));

    /*
        2) Buscar pagos de esos socios.
           Se filtran después en PHP para respetar:
           - rango del balance
           - hasta el período de baja del socio
    */
    $pagosPorSocio = [];

    if (!empty($idsSocios)) {
        $placeholders = implode(',', array_fill(0, count($idsSocios), '?'));

        $sqlPagos = "
            SELECT
                p.id_pago,
                p.id_socio,
                p.id_periodo,
                p.anio_aplicado,
                p.fecha_pago,
                p.estado,
                p.monto,
                per.nombre AS periodo_nombre,
                per.meses AS periodo_meses
            FROM pagos p
            LEFT JOIN periodo per ON per.id_periodo = p.id_periodo
            WHERE p.id_socio IN ($placeholders)
              AND p.estado IN ('pagado', 'condonado')
            ORDER BY
                p.id_socio ASC,
                p.anio_aplicado ASC,
                p.id_periodo ASC,
                p.fecha_pago ASC,
                p.id_pago ASC
        ";

        $stmtPagos = $pdo->prepare($sqlPagos);
        $stmtPagos->execute($idsSocios);

        $rowsPagos = $stmtPagos->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rowsPagos as $pago) {
            $idSocio = (int) $pago['id_socio'];
            $idPeriodo = (int) $pago['id_periodo'];
            $anioAplicado = (int) ($pago['anio_aplicado'] ?? 0);

            if ($anioAplicado <= 0 && !empty($pago['fecha_pago'])) {
                $anioAplicado = (int) substr((string) $pago['fecha_pago'], 0, 4);
            }

            $periodoPago = balance_periodo_bimestral_por_id($idPeriodo);
            $sortPago = balance_sort_periodo($anioAplicado, $periodoPago['desde']);

            $periodoLabel = $periodoPago['label'];
            $periodoLabelConAnio = $periodoLabel . ' / ' . $anioAplicado;

            $pagosPorSocio[$idSocio][] = [
                'id_pago' => (int) $pago['id_pago'],
                'id_socio' => $idSocio,
                'id_periodo' => $idPeriodo,
                'anio_aplicado' => $anioAplicado,
                'fecha_pago' => $pago['fecha_pago'],
                'estado' => $pago['estado'],
                'monto' => balance_formatear_monto($pago['monto']),
                'periodo' => $periodoLabel,
                'periodo_label' => $periodoLabelConAnio,
                'periodo_nombre' => $pago['periodo_nombre'],
                'periodo_meses' => $pago['periodo_meses'],
                'periodo_desde' => $periodoPago['desde'],
                'periodo_hasta' => $periodoPago['hasta'],
                'sort_periodo' => $sortPago,
            ];
        }
    }

    $resumen = [
        'pasivos' => [
            'label' => 'Bajas pasivos',
            'cantidad' => 0,
            'periodos' => [],
            'pagos_cantidad' => 0,
            'pagos_monto_total' => 0,
        ],
        'activos' => [
            'label' => 'Bajas activos',
            'cantidad' => 0,
            'periodos' => [],
            'pagos_cantidad' => 0,
            'pagos_monto_total' => 0,
        ],
        'sin_estado' => [
            'label' => 'Bajas sin estado',
            'cantidad' => 0,
            'periodos' => [],
            'pagos_cantidad' => 0,
            'pagos_monto_total' => 0,
        ],
    ];

    $items = [];
    $totalPagos = 0;
    $totalMontoPagos = 0;

    foreach ($rowsBajas as $row) {
        $idSocio = (int) $row['id_socio'];
        $mesBaja = (int) ($row['mes_baja'] ?? 0);
        $anioBaja = (int) ($row['anio_baja'] ?? 0);

        $periodoBaja = balance_periodo_bimestral_por_mes($mesBaja);
        $sortPeriodoBaja = balance_sort_periodo($anioBaja, $periodoBaja['desde']);

        $estado = balance_normalizar_estado($row['estado_descripcion'] ?? null);
        $grupoKey = $estado['key'];

        $periodoBajaLabel = $periodoBaja['label'];
        $periodoBajaLabelConAnio = $periodoBajaLabel . ' / ' . $anioBaja;
        $periodoKey = $anioBaja . '-' . str_pad((string) $periodoBaja['desde'], 2, '0', STR_PAD_LEFT) . '-' . $periodoBajaLabel;

        if (!isset($resumen[$grupoKey]['periodos'][$periodoKey])) {
            $resumen[$grupoKey]['periodos'][$periodoKey] = [
                'periodo' => $periodoBajaLabel,
                'anio' => $anioBaja,
                'periodo_label' => $periodoBajaLabelConAnio,
                'periodo_desde' => $periodoBaja['desde'],
                'periodo_hasta' => $periodoBaja['hasta'],
                'cantidad' => 0,
                'pagos_cantidad' => 0,
                'pagos_monto_total' => 0,
            ];
        }

        /*
            Pagos válidos para el balance:
            - pertenecen al socio dado de baja
            - están dentro del rango económico del balance
            - no son posteriores al período de baja
        */
        $pagosSocio = [];
        $montoPagadoSocio = 0;

        foreach (($pagosPorSocio[$idSocio] ?? []) as $pago) {
            $sortPago = (int) ($pago['sort_periodo'] ?? 0);

            if ($sortPago <= 0) {
                continue;
            }

            if ($sortPago < $sortInicioBalance || $sortPago > $sortFinBalance) {
                continue;
            }

            if ($sortPeriodoBaja > 0 && $sortPago > $sortPeriodoBaja) {
                continue;
            }

            $pagosSocio[] = $pago;
            $montoPagadoSocio += (float) $pago['monto'];
        }

        usort($pagosSocio, function ($a, $b) {
            $cmp = ((int) $a['sort_periodo']) <=> ((int) $b['sort_periodo']);

            if ($cmp !== 0) {
                return $cmp;
            }

            return strcmp((string) $a['fecha_pago'], (string) $b['fecha_pago']);
        });

        $cantidadPagosSocio = count($pagosSocio);

        $resumen[$grupoKey]['cantidad']++;
        $resumen[$grupoKey]['periodos'][$periodoKey]['cantidad']++;

        $resumen[$grupoKey]['pagos_cantidad'] += $cantidadPagosSocio;
        $resumen[$grupoKey]['pagos_monto_total'] += $montoPagadoSocio;

        $resumen[$grupoKey]['periodos'][$periodoKey]['pagos_cantidad'] += $cantidadPagosSocio;
        $resumen[$grupoKey]['periodos'][$periodoKey]['pagos_monto_total'] += $montoPagadoSocio;

        $totalPagos += $cantidadPagosSocio;
        $totalMontoPagos += $montoPagadoSocio;

        $items[] = [
            'id_socio' => $idSocio,
            'nombre' => $row['nombre'],
            'activo' => (int) $row['activo'],
            'id_estado' => $row['id_estado'] !== null ? (int) $row['id_estado'] : null,
            'estado_descripcion' => $row['estado_descripcion'] ?: 'Sin estado',
            'grupo' => $grupoKey,
            'grupo_label' => $estado['label'],
            'fecha_baja' => $row['fecha_baja'],
            'mes_baja' => $mesBaja,
            'anio_baja' => $anioBaja,
            'periodo' => $periodoBajaLabel,
            'periodo_label' => $periodoBajaLabelConAnio,
            'periodo_desde' => $periodoBaja['desde'],
            'periodo_hasta' => $periodoBaja['hasta'],
            'motivo' => $row['motivo'] ?? null,
            'pagos' => $pagosSocio,
            'pagos_cantidad' => $cantidadPagosSocio,
            'pagos_monto_total' => round($montoPagadoSocio, 2),
        ];
    }

    foreach ($resumen as $grupoKey => $grupoData) {
        $periodos = array_values($grupoData['periodos']);

        usort($periodos, function ($a, $b) {
            $anioCmp = ((int) $a['anio']) <=> ((int) $b['anio']);

            if ($anioCmp !== 0) {
                return $anioCmp;
            }

            return ((int) $a['periodo_desde']) <=> ((int) $b['periodo_desde']);
        });

        foreach ($periodos as &$p) {
            $p['pagos_monto_total'] = round((float) $p['pagos_monto_total'], 2);
        }
        unset($p);

        $resumen[$grupoKey]['periodos'] = $periodos;
        $resumen[$grupoKey]['pagos_monto_total'] = round((float) $resumen[$grupoKey]['pagos_monto_total'], 2);
    }

    balance_response([
        'ok' => true,
        'exito' => true,
        'mensaje' => 'Bajas por período y pagos obtenidos correctamente.',
        'rango' => [
            'desde' => $fechaDesde,
            'hasta' => $fechaHasta,
        ],
        'totales' => [
            'total_bajas' => count($items),
            'activos' => $resumen['activos']['cantidad'],
            'pasivos' => $resumen['pasivos']['cantidad'],
            'sin_estado' => $resumen['sin_estado']['cantidad'],
            'pagos_detectados' => $totalPagos,
            'pagos_monto_total' => round($totalMontoPagos, 2),
        ],
        'resumen' => $resumen,
        'items' => $items,
    ]);

} catch (Throwable $e) {
    error_log('[BALANCE_ANUAL_PREVIEW] ' . $e->getMessage());

    balance_response([
        'ok' => false,
        'exito' => false,
        'mensaje' => 'Error al obtener las bajas por período y pagos.',
    ], 500);
}