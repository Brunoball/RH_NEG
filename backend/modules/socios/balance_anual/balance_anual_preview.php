<?php
// backend/modules/socios/balance_anual/balance_anual_preview.php

declare(strict_types=1);

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

require_once __DIR__ . '/../../../config/db.php';

function balance_response(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function balance_get_pdo(): PDO
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

    if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
        return $GLOBALS['pdo'];
    }

    if (isset($GLOBALS['conn']) && $GLOBALS['conn'] instanceof PDO) {
        return $GLOBALS['conn'];
    }

    throw new RuntimeException('No se pudo obtener la conexión PDO.');
}

function balance_validar_fecha(?string $fecha, string $fallback): string
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

function balance_periodo_bimestral_por_mes(int $mes): array
{
    if ($mes < 1 || $mes > 12) {
        return ['desde' => null, 'hasta' => null, 'label' => 'Sin período'];
    }

    $desde = $mes % 2 === 1 ? $mes : $mes - 1;

    return [
        'desde' => $desde,
        'hasta' => $desde + 1,
        'label' => $desde . '/' . ($desde + 1),
    ];
}

function balance_periodo_bimestral_por_id(int $idPeriodo): array
{
    $map = [
        1 => ['desde' => 1, 'hasta' => 2, 'label' => '1/2'],
        2 => ['desde' => 3, 'hasta' => 4, 'label' => '3/4'],
        3 => ['desde' => 5, 'hasta' => 6, 'label' => '5/6'],
        4 => ['desde' => 7, 'hasta' => 8, 'label' => '7/8'],
        5 => ['desde' => 9, 'hasta' => 10, 'label' => '9/10'],
        6 => ['desde' => 11, 'hasta' => 12, 'label' => '11/12'],
        7 => ['desde' => 1, 'hasta' => 12, 'label' => 'Contado anual'],
    ];

    return $map[$idPeriodo] ?? [
        'desde' => null,
        'hasta' => null,
        'label' => 'Período ' . $idPeriodo,
    ];
}

function balance_sort_periodo(int $anio, ?int $mesDesde): int
{
    if ($anio <= 0 || !$mesDesde) {
        return 0;
    }

    return ($anio * 100) + $mesDesde;
}

function balance_normalizar_estado(?string $estado): array
{
    $estadoLower = mb_strtolower(trim((string) $estado), 'UTF-8');

    if (str_contains($estadoLower, 'pasiv')) {
        return ['key' => 'pasivos', 'label' => 'Pasivo'];
    }

    if (str_contains($estadoLower, 'activ')) {
        return ['key' => 'activos', 'label' => 'Activo'];
    }

    return ['key' => 'sin_estado', 'label' => 'Sin estado'];
}

function balance_monto($valor): float
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

    // Período anual predeterminado: 1 de julio a 30 de junio.
    $anioCierre = $anioActual;
    $anioInicio = $anioActual - 1;

    return [
        'desde' => $anioInicio . '-07-01',
        'hasta' => $anioCierre . '-06-30',
    ];
}

function balance_fecha_periodo(int $anio, int $mes, bool $ultimoDia = false): string
{
    $dt = DateTime::createFromFormat('!Y-n-j', $anio . '-' . $mes . '-1');

    if (!$dt) {
        return sprintf('%04d-%02d-01', $anio, $mes);
    }

    if ($ultimoDia) {
        $dt->modify('last day of this month');
    }

    return $dt->format('Y-m-d');
}

function balance_rangos_se_superponen(string $inicioA, string $finA, string $inicioB, string $finB): bool
{
    return $finA >= $inicioB && $inicioA <= $finB;
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
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $rangoDefault = balance_rango_fechas_por_defecto();
    $fechaDesde = balance_validar_fecha($_GET['desde'] ?? null, $rangoDefault['desde']);
    $fechaHasta = balance_validar_fecha($_GET['hasta'] ?? null, $rangoDefault['hasta']);

    if ($fechaDesde > $fechaHasta) {
        throw new InvalidArgumentException('La fecha desde no puede ser mayor que la fecha hasta.');
    }

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
        ORDER BY s.fecha_baja ASC, e.descripcion ASC, s.nombre ASC, s.id_socio ASC
    ";

    $stmtBajas = $pdo->prepare($sqlBajas);
    $stmtBajas->execute([':desde' => $fechaDesde, ':hasta' => $fechaHasta]);
    $rowsBajas = $stmtBajas->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $idsSocios = array_values(array_unique(array_map(
        static fn (array $row): int => (int) $row['id_socio'],
        $rowsBajas
    )));

    $pagosPorSocio = [];
    $pagosDuplicados = [];
    $clavesVistas = [];
    $advertencias = [];

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
                p.fecha_pago DESC,
                p.id_pago DESC
        ";

        $stmtPagos = $pdo->prepare($sqlPagos);
        $stmtPagos->execute($idsSocios);

        while ($pago = $stmtPagos->fetch(PDO::FETCH_ASSOC)) {
            $idSocio = (int) $pago['id_socio'];
            $idPeriodo = (int) $pago['id_periodo'];
            $anioAplicado = (int) ($pago['anio_aplicado'] ?? 0);

            if ($anioAplicado <= 0 && !empty($pago['fecha_pago'])) {
                $anioAplicado = (int) substr((string) $pago['fecha_pago'], 0, 4);
            }

            $periodoPago = balance_periodo_bimestral_por_id($idPeriodo);

            if ($anioAplicado <= 0 || $periodoPago['desde'] === null || $periodoPago['hasta'] === null) {
                $advertencias[] = [
                    'codigo' => 'PAGO_SIN_PERIODO_VALIDO',
                    'id_pago' => (int) $pago['id_pago'],
                    'id_socio' => $idSocio,
                ];
                continue;
            }

            $clave = $idSocio . '-' . $anioAplicado . '-' . $idPeriodo;

            if (isset($clavesVistas[$clave])) {
                if (!isset($pagosDuplicados[$clave])) {
                    $pagosDuplicados[$clave] = [
                        'id_socio' => $idSocio,
                        'anio_aplicado' => $anioAplicado,
                        'id_periodo' => $idPeriodo,
                        'ids_pago' => [$clavesVistas[$clave]],
                    ];
                }

                $pagosDuplicados[$clave]['ids_pago'][] = (int) $pago['id_pago'];
                continue;
            }

            // La consulta viene ordenada por fecha/id descendente: se conserva el registro más reciente.
            $clavesVistas[$clave] = (int) $pago['id_pago'];

            $esAnual = $idPeriodo === 7;
            $fechaCoberturaDesde = balance_fecha_periodo($anioAplicado, (int) $periodoPago['desde']);
            $fechaCoberturaHasta = balance_fecha_periodo($anioAplicado, (int) $periodoPago['hasta'], true);
            $estadoPago = strtolower(trim((string) ($pago['estado'] ?? 'pagado')));
            $estadoPago = $estadoPago === 'condonado' ? 'condonado' : 'pagado';

            $pagosPorSocio[$idSocio][] = [
                'id_pago' => (int) $pago['id_pago'],
                'id_socio' => $idSocio,
                'id_periodo' => $idPeriodo,
                'anio_aplicado' => $anioAplicado,
                'fecha_pago' => $pago['fecha_pago'] ?? null,
                'estado' => $estadoPago,
                'monto' => $estadoPago === 'pagado' ? balance_monto($pago['monto'] ?? 0) : 0.0,
                'monto_registrado' => balance_monto($pago['monto'] ?? 0),
                'periodo' => $periodoPago['label'],
                'periodo_label' => $periodoPago['label'] . ' / ' . $anioAplicado,
                'periodo_nombre' => $pago['periodo_nombre'],
                'periodo_meses' => $pago['periodo_meses'],
                'periodo_desde' => $periodoPago['desde'],
                'periodo_hasta' => $periodoPago['hasta'],
                'sort_periodo' => balance_sort_periodo($anioAplicado, (int) $periodoPago['desde']),
                'es_contado_anual' => $esAnual,
                'fecha_cobertura_desde' => $fechaCoberturaDesde,
                'fecha_cobertura_hasta' => $fechaCoberturaHasta,
            ];
        }
    }

    if (!empty($pagosDuplicados)) {
        $advertencias[] = [
            'codigo' => 'PAGOS_DUPLICADOS_MISMO_SOCIO_ANIO_PERIODO',
            'cantidad_claves' => count($pagosDuplicados),
            'detalle' => array_values($pagosDuplicados),
            'impacto_calculo' => 'SIN DOBLE IMPACTO: se conserva un único registro por socio, año y período.',
        ];
    }

    $resumen = [];

    foreach (['pasivos' => 'Bajas pasivos', 'activos' => 'Bajas activos', 'sin_estado' => 'Bajas sin estado'] as $key => $label) {
        $resumen[$key] = [
            'label' => $label,
            'cantidad' => 0,
            'periodos' => [],
            'pagos_cantidad' => 0,
            'condonaciones_cantidad' => 0,
            'periodos_cubiertos_cantidad' => 0,
            'pagos_monto_total' => 0,
        ];
    }

    $items = [];
    $totalPagos = 0;
    $totalCondonaciones = 0;
    $totalPeriodosCubiertos = 0;
    $totalMontoPagos = 0.0;

    foreach ($rowsBajas as $row) {
        $idSocio = (int) $row['id_socio'];
        $mesBaja = (int) ($row['mes_baja'] ?? 0);
        $anioBaja = (int) ($row['anio_baja'] ?? 0);
        $fechaBaja = (string) $row['fecha_baja'];
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
                'condonaciones_cantidad' => 0,
                'periodos_cubiertos_cantidad' => 0,
                'pagos_monto_total' => 0,
            ];
        }

        $pagosSocio = [];
        $montoPagadoSocio = 0.0;
        $pagosRealesSocio = 0;
        $condonacionesSocio = 0;

        foreach ($pagosPorSocio[$idSocio] ?? [] as $pago) {
            $coberturaDesde = (string) ($pago['fecha_cobertura_desde'] ?? '');
            $coberturaHasta = (string) ($pago['fecha_cobertura_hasta'] ?? '');

            if ($coberturaDesde === '' || $coberturaHasta === '') {
                continue;
            }

            // El período económico debe intersectar el rango solicitado.
            if (!balance_rangos_se_superponen($coberturaDesde, $coberturaHasta, $fechaDesde, $fechaHasta)) {
                continue;
            }

            if (!empty($pago['es_contado_anual'])) {
                // El contado anual cubre enero-diciembre del año aplicado. No se lo ubica
                // artificialmente sólo en enero para decidir si entra en un balance julio-junio.
                if ((int) $pago['anio_aplicado'] > $anioBaja) {
                    continue;
                }
            } elseif ((int) $pago['sort_periodo'] > $sortPeriodoBaja) {
                // Para bimestres se conserva la regla existente: hasta el bimestre de baja.
                continue;
            }

            $pagosSocio[] = $pago;

            if (($pago['estado'] ?? '') === 'condonado') {
                $condonacionesSocio++;
            } else {
                $pagosRealesSocio++;
                $montoPagadoSocio += (float) ($pago['monto'] ?? 0);
            }

            if (!empty($pago['fecha_pago']) && (string) $pago['fecha_pago'] > $fechaBaja) {
                $advertencias[] = [
                    'codigo' => 'PAGO_REGISTRADO_DESPUES_DE_LA_BAJA',
                    'id_pago' => (int) $pago['id_pago'],
                    'id_socio' => $idSocio,
                    'fecha_pago' => $pago['fecha_pago'],
                    'fecha_baja' => $fechaBaja,
                    'impacto_calculo' => 'Se incluye porque cubre un período no posterior a la baja.',
                ];
            }
        }

        usort($pagosSocio, static function (array $a, array $b): int {
            $cmp = ((int) $a['anio_aplicado']) <=> ((int) $b['anio_aplicado']);
            if ($cmp !== 0) {
                return $cmp;
            }

            $cmp = ((int) $a['periodo_desde']) <=> ((int) $b['periodo_desde']);
            if ($cmp !== 0) {
                return $cmp;
            }

            return strcmp((string) $a['fecha_pago'], (string) $b['fecha_pago']);
        });

        $montoPagadoSocio = balance_monto($montoPagadoSocio);
        $periodosCubiertosSocio = count($pagosSocio);

        $resumen[$grupoKey]['cantidad']++;
        $resumen[$grupoKey]['periodos'][$periodoKey]['cantidad']++;
        $resumen[$grupoKey]['pagos_cantidad'] += $pagosRealesSocio;
        $resumen[$grupoKey]['condonaciones_cantidad'] += $condonacionesSocio;
        $resumen[$grupoKey]['periodos_cubiertos_cantidad'] += $periodosCubiertosSocio;
        $resumen[$grupoKey]['pagos_monto_total'] += $montoPagadoSocio;
        $resumen[$grupoKey]['periodos'][$periodoKey]['pagos_cantidad'] += $pagosRealesSocio;
        $resumen[$grupoKey]['periodos'][$periodoKey]['condonaciones_cantidad'] += $condonacionesSocio;
        $resumen[$grupoKey]['periodos'][$periodoKey]['periodos_cubiertos_cantidad'] += $periodosCubiertosSocio;
        $resumen[$grupoKey]['periodos'][$periodoKey]['pagos_monto_total'] += $montoPagadoSocio;

        $totalPagos += $pagosRealesSocio;
        $totalCondonaciones += $condonacionesSocio;
        $totalPeriodosCubiertos += $periodosCubiertosSocio;
        $totalMontoPagos += $montoPagadoSocio;

        $items[] = [
            'id_socio' => $idSocio,
            'nombre' => $row['nombre'],
            'activo' => (int) $row['activo'],
            'id_estado' => $row['id_estado'] !== null ? (int) $row['id_estado'] : null,
            'estado_descripcion' => $row['estado_descripcion'] ?: 'Sin estado',
            'grupo' => $grupoKey,
            'grupo_label' => $estado['label'],
            'fecha_baja' => $fechaBaja,
            'mes_baja' => $mesBaja,
            'anio_baja' => $anioBaja,
            'periodo' => $periodoBajaLabel,
            'periodo_label' => $periodoBajaLabelConAnio,
            'periodo_desde' => $periodoBaja['desde'],
            'periodo_hasta' => $periodoBaja['hasta'],
            'motivo' => $row['motivo'] ?? null,
            'pagos' => $pagosSocio,
            'pagos_cantidad' => $pagosRealesSocio,
            'condonaciones_cantidad' => $condonacionesSocio,
            'periodos_cubiertos_cantidad' => $periodosCubiertosSocio,
            'pagos_monto_total' => $montoPagadoSocio,
        ];
    }

    foreach ($resumen as $grupoKey => $grupoData) {
        $periodos = array_values($grupoData['periodos']);

        usort($periodos, static function (array $a, array $b): int {
            $cmp = ((int) $a['anio']) <=> ((int) $b['anio']);
            return $cmp !== 0 ? $cmp : ((int) $a['periodo_desde']) <=> ((int) $b['periodo_desde']);
        });

        foreach ($periodos as &$periodo) {
            $periodo['pagos_monto_total'] = balance_monto($periodo['pagos_monto_total'] ?? 0);
        }
        unset($periodo);

        $resumen[$grupoKey]['periodos'] = $periodos;
        $resumen[$grupoKey]['pagos_monto_total'] = balance_monto($grupoData['pagos_monto_total'] ?? 0);
    }

    $totalMontoPagos = balance_monto($totalMontoPagos);
    $montoItems = balance_monto(array_sum(array_map(
        static fn (array $item): float => balance_monto($item['pagos_monto_total'] ?? 0),
        $items
    )));
    $montoResumen = balance_monto(
        (float) $resumen['activos']['pagos_monto_total']
        + (float) $resumen['pasivos']['pagos_monto_total']
        + (float) $resumen['sin_estado']['pagos_monto_total']
    );
    $cantidadBajasResumen = (int) $resumen['activos']['cantidad']
        + (int) $resumen['pasivos']['cantidad']
        + (int) $resumen['sin_estado']['cantidad'];
    $pagosResumen = (int) $resumen['activos']['pagos_cantidad']
        + (int) $resumen['pasivos']['pagos_cantidad']
        + (int) $resumen['sin_estado']['pagos_cantidad'];
    $condonacionesResumen = (int) $resumen['activos']['condonaciones_cantidad']
        + (int) $resumen['pasivos']['condonaciones_cantidad']
        + (int) $resumen['sin_estado']['condonaciones_cantidad'];

    if (count($items) !== $cantidadBajasResumen) {
        throw new RuntimeException('El balance de bajas no cerró el control de cantidades de socios.');
    }

    if ($totalPagos !== $pagosResumen || $totalCondonaciones !== $condonacionesResumen) {
        throw new RuntimeException('El balance de bajas no cerró el control de pagos y condonaciones.');
    }

    if (abs($totalMontoPagos - $montoItems) > 0.009 || abs($totalMontoPagos - $montoResumen) > 0.009) {
        throw new RuntimeException('El balance de bajas no cerró el control de montos.');
    }

    balance_response([
        'ok' => true,
        'exito' => true,
        'mensaje' => 'Bajas por período y pagos obtenidos correctamente.',
        'rango' => ['desde' => $fechaDesde, 'hasta' => $fechaHasta],
        'criterio' => 'Se muestran las bajas actuales cuya fecha_baja cae dentro del rango. Los pagos se toman una sola vez por socio/año/período. Los bimestres deben intersectar el rango y no ser posteriores al bimestre de baja. El contado anual entra si su año intersecta el rango, por lo que funciona correctamente en balances julio-junio.',
        'criterio_monto' => 'pagos_monto_total suma únicamente filas con estado pagado. Las condonaciones cubren el período pero se informan por separado y no se suman como dinero cobrado.',
        'totales' => [
            'total_bajas' => count($items),
            'activos' => (int) $resumen['activos']['cantidad'],
            'pasivos' => (int) $resumen['pasivos']['cantidad'],
            'sin_estado' => (int) $resumen['sin_estado']['cantidad'],
            'pagos_detectados' => $totalPagos,
            'condonaciones_detectadas' => $totalCondonaciones,
            'periodos_cubiertos_detectados' => $totalPeriodosCubiertos,
            'pagos_monto_total' => $totalMontoPagos,
        ],
        'auditoria_calculo' => [
            'control_ok' => true,
            'cantidad_bajas_detalle' => count($items),
            'cantidad_bajas_resumen' => $cantidadBajasResumen,
            'pagos_detalle' => $totalPagos,
            'pagos_resumen' => $pagosResumen,
            'condonaciones_detalle' => $totalCondonaciones,
            'condonaciones_resumen' => $condonacionesResumen,
            'monto_detalle' => $montoItems,
            'monto_resumen' => $montoResumen,
            'monto_total_general' => $totalMontoPagos,
            'duplicados_detectados' => count($pagosDuplicados),
        ],
        'advertencias_auditoria' => $advertencias,
        'resumen' => $resumen,
        'items' => $items,
    ]);
} catch (InvalidArgumentException $e) {
    balance_response([
        'ok' => false,
        'exito' => false,
        'mensaje' => $e->getMessage(),
    ], 400);
} catch (Throwable $e) {
    error_log('[BALANCE_ANUAL_PREVIEW] ' . $e->getMessage());

    balance_response([
        'ok' => false,
        'exito' => false,
        'mensaje' => 'Error al obtener las bajas por período y pagos.',
    ], 500);
}
