<?php
// backend/modules/socios/balance_anual/balance_anual_deudores.php

declare(strict_types=1);

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
}

require_once __DIR__ . '/../../../config/db.php';

const BALANCE_ID_CONTADO_ANUAL = 7;

function balance_deudores_responder(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function balance_deudores_pdo(): PDO
{
    if (function_exists('db')) {
        $pdo = db();
        if ($pdo instanceof PDO) {
            return $pdo;
        }
    }

    if (function_exists('getConnection')) {
        $pdo = getConnection();
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

function balance_deudores_validar_fecha(?string $fecha, string $fallback): string
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

function balance_deudores_rango_fechas_por_defecto(): array
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

function balance_deudores_periodo_info(int $idPeriodo): array
{
    $map = [
        1 => [
            'desde' => 1,
            'hasta' => 2,
            'nombre' => 'PERÍODO 1 Y 2',
            'meses' => 'ENERO - FEBRERO',
        ],
        2 => [
            'desde' => 3,
            'hasta' => 4,
            'nombre' => 'PERÍODO 3 Y 4',
            'meses' => 'MARZO - ABRIL',
        ],
        3 => [
            'desde' => 5,
            'hasta' => 6,
            'nombre' => 'PERÍODO 5 Y 6',
            'meses' => 'MAYO - JUNIO',
        ],
        4 => [
            'desde' => 7,
            'hasta' => 8,
            'nombre' => 'PERÍODO 7 Y 8',
            'meses' => 'JULIO - AGOSTO',
        ],
        5 => [
            'desde' => 9,
            'hasta' => 10,
            'nombre' => 'PERÍODO 9 Y 10',
            'meses' => 'SEPTIEMBRE - OCTUBRE',
        ],
        6 => [
            'desde' => 11,
            'hasta' => 12,
            'nombre' => 'PERÍODO 11 Y 12',
            'meses' => 'NOVIEMBRE - DICIEMBRE',
        ],
    ];

    return $map[$idPeriodo] ?? [
        'desde' => null,
        'hasta' => null,
        'nombre' => 'PERÍODO ' . $idPeriodo,
        'meses' => '',
    ];
}

function balance_deudores_fecha_periodo(int $anio, int $mes, bool $ultimoDia = false): string
{
    $dt = DateTime::createFromFormat('Y-n-j', $anio . '-' . $mes . '-1');

    if (!$dt) {
        return sprintf('%04d-%02d-01', $anio, $mes);
    }

    if ($ultimoDia) {
        $dt->modify('last day of this month');
    }

    return $dt->format('Y-m-d');
}

function balance_deudores_armar_periodos_balance(string $desde, string $hasta): array
{
    $anioDesde = (int) substr($desde, 0, 4);
    $anioHasta = (int) substr($hasta, 0, 4);

    $periodos = [];

    for ($anio = $anioDesde; $anio <= $anioHasta; $anio++) {
        for ($idPeriodo = 1; $idPeriodo <= 6; $idPeriodo++) {
            $info = balance_deudores_periodo_info($idPeriodo);

            $fechaInicio = balance_deudores_fecha_periodo($anio, (int) $info['desde'], false);
            $fechaFin = balance_deudores_fecha_periodo($anio, (int) $info['hasta'], true);

            if ($fechaFin < $desde || $fechaInicio > $hasta) {
                continue;
            }

            $periodos[] = [
                'key' => $anio . '-' . $idPeriodo,
                'id_periodo' => $idPeriodo,
                'anio' => $anio,
                'periodo_nombre' => $info['nombre'],
                'periodo_meses' => $info['meses'],
                'periodo_label' => $info['nombre'] . ' / ' . $anio,
                'mes_desde' => $info['desde'],
                'mes_hasta' => $info['hasta'],
                'fecha_inicio' => $fechaInicio,
                'fecha_fin' => $fechaFin,
                'deudores_cantidad' => 0,
                'activos_cantidad' => 0,
                'pasivos_cantidad' => 0,
                'sin_estado_cantidad' => 0,

                // Campo correcto nuevo
                'monto_total_adeudado' => 0,

                // Alias para no romper frontend viejo si quedó algo usando "estimado"
                'monto_total_estimado' => 0,

                'deudores' => [],
            ];
        }
    }

    usort($periodos, static function (array $a, array $b): int {
        $cmp = ((int) $a['anio']) <=> ((int) $b['anio']);

        if ($cmp !== 0) {
            return $cmp;
        }

        return ((int) $a['id_periodo']) <=> ((int) $b['id_periodo']);
    });

    return $periodos;
}

function balance_deudores_grupo_estado(?int $idEstado, ?string $descripcion): string
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

function balance_deudores_grupo_label(string $grupo): string
{
    return match ($grupo) {
        'activos' => 'ACTIVO',
        'pasivos' => 'PASIVO',
        default => 'SIN ESTADO',
    };
}

function balance_deudores_socio_elegible(?string $fechaIngreso, string $fechaFinPeriodo): bool
{
    $fechaIngreso = trim((string) $fechaIngreso);

    if ($fechaIngreso === '' || $fechaIngreso === '0000-00-00') {
        return true;
    }

    $dtIngreso = DateTime::createFromFormat('Y-m-d', $fechaIngreso);

    if (!$dtIngreso || $dtIngreso->format('Y-m-d') !== $fechaIngreso) {
        return true;
    }

    $dtFin = DateTime::createFromFormat('Y-m-d', $fechaFinPeriodo);

    if (!$dtFin) {
        return true;
    }

    return $dtIngreso <= $dtFin;
}

function balance_deudores_formatear_monto($valor): float
{
    if ($valor === null || $valor === '') {
        return 0.0;
    }

    return round((float) $valor, 2);
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        balance_deudores_responder([
            'ok' => false,
            'exito' => false,
            'mensaje' => 'Método no permitido.',
        ], 405);
    }

    $pdo = balance_deudores_pdo();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $rangoDefault = balance_deudores_rango_fechas_por_defecto();

    $desde = balance_deudores_validar_fecha(
        $_GET['desde'] ?? null,
        $rangoDefault['desde']
    );

    $hasta = balance_deudores_validar_fecha(
        $_GET['hasta'] ?? null,
        $rangoDefault['hasta']
    );

    if ($desde > $hasta) {
        throw new InvalidArgumentException('La fecha desde no puede ser mayor a la fecha hasta.');
    }

    $incluirInactivos = isset($_GET['incluir_inactivos']) && (string) $_GET['incluir_inactivos'] === '1';

    $periodosBalance = balance_deudores_armar_periodos_balance($desde, $hasta);

    if (empty($periodosBalance)) {
        balance_deudores_responder([
            'ok' => true,
            'exito' => true,
            'mensaje' => 'No hay períodos dentro del rango seleccionado.',
            'desde' => $desde,
            'hasta' => $hasta,
            'totales' => [
                'total_deudores' => 0,
                'periodos_cantidad' => 0,
                'activos' => 0,
                'pasivos' => 0,
                'sin_estado' => 0,
                'monto_total_adeudado' => 0,
                'monto_total_estimado' => 0,
            ],
            'resumen' => [
                'activos' => [
                    'cantidad' => 0,
                    'monto_total_adeudado' => 0,
                    'monto_total_estimado' => 0,
                ],
                'pasivos' => [
                    'cantidad' => 0,
                    'monto_total_adeudado' => 0,
                    'monto_total_estimado' => 0,
                ],
                'sin_estado' => [
                    'cantidad' => 0,
                    'monto_total_adeudado' => 0,
                    'monto_total_estimado' => 0,
                ],
            ],
            'periodos' => [],
            'items' => [],
        ]);
    }

    $aniosBalance = array_values(array_unique(array_map(
        static fn (array $p): int => (int) $p['anio'],
        $periodosBalance
    )));

    /*
        SOCIOS:
        - s.activo = 1 por defecto para no meter bajas en deudores.
        - id_estado separa ACTIVO / PASIVO.
        - id_cat_monto se usa para traer el monto exacto desde categoria_monto.
        - monto_mensual representa el valor del período completo.
          Ejemplo: PERÍODO 1 Y 2 = $5000, NO $10000.
    */
    $sqlSocios = "
        SELECT
            s.id_socio,
            s.nombre,
            s.dni,
            s.ingreso,
            s.activo,
            s.id_estado,
            e.descripcion AS estado_descripcion,

            s.id_categoria,
            cat.descripcion AS categoria_descripcion,

            s.id_cat_monto,
            cm.nombre_categoria AS cat_monto_nombre,
            cm.monto_mensual,
            cm.monto_anual,

            s.domicilio,
            s.numero,
            s.domicilio_cobro,
            s.telefono_movil,
            s.telefono_fijo,

            c.nombre AS cobrador
        FROM socios s
        LEFT JOIN estado e 
            ON e.id_estado = s.id_estado
        LEFT JOIN categoria cat 
            ON cat.id_categoria = s.id_categoria
        LEFT JOIN categoria_monto cm 
            ON cm.id_cat_monto = s.id_cat_monto
        LEFT JOIN cobrador c 
            ON c.id_cobrador = s.id_cobrador
    ";

    if (!$incluirInactivos) {
        $sqlSocios .= " WHERE s.activo = 1 ";
    }

    $sqlSocios .= " ORDER BY s.nombre ASC, s.id_socio ASC ";

    $stmtSocios = $pdo->prepare($sqlSocios);
    $stmtSocios->execute();
    $socios = $stmtSocios->fetchAll(PDO::FETCH_ASSOC);

    /*
        PAGOS:
        - pago directo del período cubre solamente ese período.
        - CONTADO ANUAL cubre todos los períodos del año aplicado.
        - si anio_aplicado viene 0, se toma YEAR(fecha_pago).
    */
    $pagosDirectos = [];
    $pagosAnuales = [];

    if (!empty($socios) && !empty($aniosBalance)) {
        $placeholdersAnios = implode(',', array_fill(0, count($aniosBalance), '?'));

        $sqlPagos = "
            SELECT
                id_pago,
                id_socio,
                id_periodo,
                anio_aplicado,
                fecha_pago,
                estado,
                monto
            FROM pagos
            WHERE estado IN ('pagado', 'condonado')
              AND (
                    anio_aplicado IN ($placeholdersAnios)
                    OR (
                        anio_aplicado = 0
                        AND fecha_pago IS NOT NULL
                        AND YEAR(fecha_pago) IN ($placeholdersAnios)
                    )
              )
            ORDER BY 
                id_socio ASC,
                anio_aplicado ASC,
                id_periodo ASC,
                fecha_pago DESC,
                id_pago DESC
        ";

        $paramsPagos = array_merge($aniosBalance, $aniosBalance);
        $stmtPagos = $pdo->prepare($sqlPagos);
        $stmtPagos->execute($paramsPagos);

        while ($pago = $stmtPagos->fetch(PDO::FETCH_ASSOC)) {
            $idSocio = (int) $pago['id_socio'];
            $idPeriodo = (int) $pago['id_periodo'];
            $anioAplicado = (int) ($pago['anio_aplicado'] ?? 0);

            if ($anioAplicado <= 0 && !empty($pago['fecha_pago'])) {
                $anioAplicado = (int) substr((string) $pago['fecha_pago'], 0, 4);
            }

            if ($anioAplicado <= 0) {
                continue;
            }

            $estadoPago = strtolower(trim((string) ($pago['estado'] ?? 'pagado')));
            $estadoPago = $estadoPago === 'condonado' ? 'condonado' : 'pagado';

            $pagoNormalizado = [
                'id_pago' => (int) $pago['id_pago'],
                'id_socio' => $idSocio,
                'id_periodo' => $idPeriodo,
                'anio_aplicado' => $anioAplicado,
                'fecha_pago' => $pago['fecha_pago'] ?? null,
                'estado' => $estadoPago,
                'monto' => balance_deudores_formatear_monto($pago['monto'] ?? 0),
            ];

            if ($idPeriodo === BALANCE_ID_CONTADO_ANUAL) {
                if (!isset($pagosAnuales[$idSocio][$anioAplicado])) {
                    $pagosAnuales[$idSocio][$anioAplicado] = $pagoNormalizado;
                }
            } else {
                if (!isset($pagosDirectos[$idSocio][$anioAplicado][$idPeriodo])) {
                    $pagosDirectos[$idSocio][$anioAplicado][$idPeriodo] = $pagoNormalizado;
                }
            }
        }
    }

    $resumen = [
        'activos' => [
            'cantidad' => 0,
            'monto_total_adeudado' => 0,
            'monto_total_estimado' => 0,
        ],
        'pasivos' => [
            'cantidad' => 0,
            'monto_total_adeudado' => 0,
            'monto_total_estimado' => 0,
        ],
        'sin_estado' => [
            'cantidad' => 0,
            'monto_total_adeudado' => 0,
            'monto_total_estimado' => 0,
        ],
    ];

    $items = [];
    $totalMontoAdeudado = 0;

    foreach ($periodosBalance as &$periodoBalance) {
        $idPeriodo = (int) $periodoBalance['id_periodo'];
        $anioPeriodo = (int) $periodoBalance['anio'];
        $fechaFinPeriodo = (string) $periodoBalance['fecha_fin'];

        foreach ($socios as $socio) {
            $idSocio = (int) $socio['id_socio'];

            if (!balance_deudores_socio_elegible($socio['ingreso'] ?? null, $fechaFinPeriodo)) {
                continue;
            }

            $pagoDirecto = $pagosDirectos[$idSocio][$anioPeriodo][$idPeriodo] ?? null;
            $pagoAnual = $pagosAnuales[$idSocio][$anioPeriodo] ?? null;

            if ($pagoDirecto !== null || $pagoAnual !== null) {
                continue;
            }

            $grupo = balance_deudores_grupo_estado(
                isset($socio['id_estado']) ? (int) $socio['id_estado'] : null,
                $socio['estado_descripcion'] ?? null
            );

            $grupoLabel = balance_deudores_grupo_label($grupo);

            $idCatMonto = !empty($socio['id_cat_monto'])
                ? (int) $socio['id_cat_monto']
                : null;

            /*
                MONTO EXACTO:
                Se obtiene directo desde categoria_monto.monto_mensual.
                Ese monto representa el valor completo del período bimestral.
                NO se multiplica por 2.
            */
            $montoPeriodo = balance_deudores_formatear_monto($socio['monto_mensual'] ?? 0);
            $montoAdeudado = $montoPeriodo;

            $domicilio = trim(
                trim((string) ($socio['domicilio'] ?? '')) . ' ' . trim((string) ($socio['numero'] ?? ''))
            );

            $item = [
                'periodo_key' => $periodoBalance['key'],
                'id_periodo' => $idPeriodo,
                'anio' => $anioPeriodo,
                'periodo_nombre' => $periodoBalance['periodo_nombre'],
                'periodo_meses' => $periodoBalance['periodo_meses'],
                'periodo_label' => $periodoBalance['periodo_label'],
                'fecha_inicio_periodo' => $periodoBalance['fecha_inicio'],
                'fecha_fin_periodo' => $periodoBalance['fecha_fin'],

                'id_socio' => $idSocio,
                'nombre' => $socio['nombre'] ?? '',
                'dni' => $socio['dni'] ?? null,
                'ingreso' => $socio['ingreso'] ?? null,
                'activo' => isset($socio['activo']) ? (int) $socio['activo'] : null,

                'id_estado' => isset($socio['id_estado']) ? (int) $socio['id_estado'] : null,
                'estado_descripcion' => $socio['estado_descripcion'] ?? null,
                'grupo' => $grupo,
                'grupo_label' => $grupoLabel,

                'id_categoria' => isset($socio['id_categoria']) ? (int) $socio['id_categoria'] : null,
                'categoria_descripcion' => $socio['categoria_descripcion'] ?? null,

                'id_cat_monto' => $idCatMonto,
                'cat_monto_nombre' => $socio['cat_monto_nombre'] ?? null,

                // Campos correctos nuevos
                'monto_periodo' => $montoPeriodo,
                'monto_adeudado' => $montoAdeudado,

                // Alias viejos para no romper el frontend si quedó alguna referencia anterior
                'monto_estimado' => $montoAdeudado,

                'domicilio' => $domicilio,
                'domicilio_cobro' => $socio['domicilio_cobro'] ?? null,
                'telefono_movil' => $socio['telefono_movil'] ?? null,
                'telefono_fijo' => $socio['telefono_fijo'] ?? null,
                'cobrador' => $socio['cobrador'] ?? null,

                'motivo_deuda' => 'Sin pago registrado para el período ni contado anual del año.',
            ];

            $periodoBalance['deudores'][] = $item;
            $periodoBalance['deudores_cantidad']++;

            $periodoBalance['monto_total_adeudado'] += $montoAdeudado;
            $periodoBalance['monto_total_estimado'] += $montoAdeudado;

            if ($grupo === 'activos') {
                $periodoBalance['activos_cantidad']++;
            } elseif ($grupo === 'pasivos') {
                $periodoBalance['pasivos_cantidad']++;
            } else {
                $periodoBalance['sin_estado_cantidad']++;
            }

            $resumen[$grupo]['cantidad']++;
            $resumen[$grupo]['monto_total_adeudado'] += $montoAdeudado;
            $resumen[$grupo]['monto_total_estimado'] += $montoAdeudado;

            $items[] = $item;
            $totalMontoAdeudado += $montoAdeudado;
        }

        $periodoBalance['monto_total_adeudado'] = balance_deudores_formatear_monto(
            $periodoBalance['monto_total_adeudado']
        );

        $periodoBalance['monto_total_estimado'] = balance_deudores_formatear_monto(
            $periodoBalance['monto_total_estimado']
        );
    }

    unset($periodoBalance);

    foreach ($resumen as $grupo => $data) {
        $resumen[$grupo]['monto_total_adeudado'] = balance_deudores_formatear_monto(
            $data['monto_total_adeudado']
        );

        $resumen[$grupo]['monto_total_estimado'] = balance_deudores_formatear_monto(
            $data['monto_total_estimado']
        );
    }

    balance_deudores_responder([
        'ok' => true,
        'exito' => true,
        'mensaje' => 'Deudores por período del balance obtenidos correctamente.',
        'desde' => $desde,
        'hasta' => $hasta,
        'incluye_contado_anual' => true,
        'criterio_monto' => 'El monto adeudado sale de categoria_monto.monto_mensual según socios.id_cat_monto. No se multiplica por cantidad de meses.',
        'totales' => [
            'total_deudores' => count($items),
            'periodos_cantidad' => count($periodosBalance),
            'activos' => (int) $resumen['activos']['cantidad'],
            'pasivos' => (int) $resumen['pasivos']['cantidad'],
            'sin_estado' => (int) $resumen['sin_estado']['cantidad'],

            // Campo correcto nuevo
            'monto_total_adeudado' => balance_deudores_formatear_monto($totalMontoAdeudado),

            // Alias viejo para compatibilidad
            'monto_total_estimado' => balance_deudores_formatear_monto($totalMontoAdeudado),
        ],
        'resumen' => $resumen,
        'periodos' => array_values($periodosBalance),
        'items' => $items,
    ]);
} catch (InvalidArgumentException $e) {
    balance_deudores_responder([
        'ok' => false,
        'exito' => false,
        'mensaje' => $e->getMessage(),
    ], 400);
} catch (Throwable $e) {
    error_log('[BALANCE_ANUAL_DEUDORES] ' . $e->getMessage());

    balance_deudores_responder([
        'ok' => false,
        'exito' => false,
        'mensaje' => 'Error interno al obtener los deudores del balance.',
    ], 500);
}