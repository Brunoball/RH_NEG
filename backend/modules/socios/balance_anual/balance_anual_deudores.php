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

/**
 * Carga el historial mensual de todas las categorías utilizadas por los socios.
 * Se hace en una sola consulta para evitar una consulta por socio y período.
 */
function balance_deudores_cargar_historial_mensual(PDO $pdo, array $idsCategorias): array
{
    $idsCategorias = array_values(array_unique(array_filter(array_map('intval', $idsCategorias))));

    if (empty($idsCategorias)) {
        return [];
    }

    $placeholders = implode(',', array_fill(0, count($idsCategorias), '?'));
    $sql = "
        SELECT
            id_historial,
            id_cat_monto,
            precio_viejo,
            precio_nuevo,
            fecha_cambio
        FROM precios_historicos
        WHERE tipo = 'mensual'
          AND id_cat_monto IN ($placeholders)
        ORDER BY id_cat_monto ASC, fecha_cambio ASC, id_historial ASC
    ";

    $stmt = $pdo->prepare($sql);

    foreach ($idsCategorias as $index => $idCategoria) {
        $stmt->bindValue($index + 1, $idCategoria, PDO::PARAM_INT);
    }

    $stmt->execute();

    $historial = [];

    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $fila) {
        $idCategoria = (int) ($fila['id_cat_monto'] ?? 0);

        if ($idCategoria <= 0) {
            continue;
        }

        $historial[$idCategoria][] = [
            'id_historial' => (int) ($fila['id_historial'] ?? 0),
            'fecha' => (string) ($fila['fecha_cambio'] ?? ''),
            'precio_viejo' => balance_deudores_formatear_monto($fila['precio_viejo'] ?? 0),
            'precio_nuevo' => balance_deudores_formatear_monto($fila['precio_nuevo'] ?? 0),
        ];
    }

    return $historial;
}

/**
 * Resuelve el monto vigente al cierre del período y devuelve trazabilidad.
 * Aplica exactamente la misma regla histórica usada por Cuotas y Detalle de Cobranza:
 * - antes del primer cambio, usa precio_viejo del primer registro;
 * - desde cada cambio, usa precio_nuevo del último cambio vigente;
 * - sin historial, usa el monto actual como fallback defensivo.
 */
function balance_deudores_resolver_monto_mensual_historico(
    ?int $idCategoria,
    string $fechaReferencia,
    $montoActual,
    array $historialPorCategoria
): array {
    $fallback = balance_deudores_formatear_monto($montoActual);

    $resultadoFallback = [
        'monto' => $fallback,
        'fuente' => 'CATEGORIA_MONTO_ACTUAL_SIN_HISTORIAL',
        'id_historial' => null,
        'fecha_cambio' => null,
        'precio_viejo' => null,
        'precio_nuevo' => null,
    ];

    if (!$idCategoria) {
        $resultadoFallback['fuente'] = 'CATEGORIA_MONTO_ACTUAL_SIN_CATEGORIA';
        return $resultadoFallback;
    }

    $cambios = $historialPorCategoria[$idCategoria] ?? [];

    if (empty($cambios)) {
        return $resultadoFallback;
    }

    $primerCambio = $cambios[0];

    if ($fechaReferencia < (string) $primerCambio['fecha']) {
        return [
            'monto' => balance_deudores_formatear_monto($primerCambio['precio_viejo'] ?? $fallback),
            'fuente' => 'PRECIO_VIEJO_ANTES_PRIMER_CAMBIO',
            'id_historial' => (int) ($primerCambio['id_historial'] ?? 0) ?: null,
            'fecha_cambio' => $primerCambio['fecha'] ?? null,
            'precio_viejo' => balance_deudores_formatear_monto($primerCambio['precio_viejo'] ?? 0),
            'precio_nuevo' => balance_deudores_formatear_monto($primerCambio['precio_nuevo'] ?? 0),
        ];
    }

    $cambioVigente = null;

    foreach ($cambios as $cambio) {
        if ((string) $cambio['fecha'] <= $fechaReferencia) {
            $cambioVigente = $cambio;
            continue;
        }

        break;
    }

    if ($cambioVigente === null) {
        return $resultadoFallback;
    }

    return [
        'monto' => balance_deudores_formatear_monto($cambioVigente['precio_nuevo'] ?? $fallback),
        'fuente' => 'PRECIO_NUEVO_ULTIMO_CAMBIO_VIGENTE',
        'id_historial' => (int) ($cambioVigente['id_historial'] ?? 0) ?: null,
        'fecha_cambio' => $cambioVigente['fecha'] ?? null,
        'precio_viejo' => balance_deudores_formatear_monto($cambioVigente['precio_viejo'] ?? 0),
        'precio_nuevo' => balance_deudores_formatear_monto($cambioVigente['precio_nuevo'] ?? 0),
    ];
}

/**
 * Wrapper numérico mantenido para compatibilidad y pruebas unitarias.
 */
function balance_deudores_monto_mensual_historico(
    ?int $idCategoria,
    string $fechaReferencia,
    $montoActual,
    array $historialPorCategoria
): float {
    $resolucion = balance_deudores_resolver_monto_mensual_historico(
        $idCategoria,
        $fechaReferencia,
        $montoActual,
        $historialPorCategoria
    );

    return balance_deudores_formatear_monto($resolucion['monto'] ?? 0);
}

/**
 * Detecta inconsistencias del historial sin alterar el cálculo.
 * Sirve para auditar cadenas manualmente modificadas en la base.
 */
function balance_deudores_auditar_historial(array $historialPorCategoria): array
{
    $advertencias = [];

    foreach ($historialPorCategoria as $idCategoria => $cambios) {
        $anterior = null;

        foreach ($cambios as $cambio) {
            $fecha = (string) ($cambio['fecha'] ?? '');
            $dt = DateTime::createFromFormat('Y-m-d', $fecha);

            if (!$dt || $dt->format('Y-m-d') !== $fecha) {
                $advertencias[] = [
                    'codigo' => 'FECHA_HISTORIAL_INVALIDA',
                    'id_cat_monto' => (int) $idCategoria,
                    'id_historial' => (int) ($cambio['id_historial'] ?? 0) ?: null,
                    'fecha_cambio' => $fecha,
                ];
            }

            if ($anterior !== null) {
                $precioAnterior = balance_deudores_formatear_monto($anterior['precio_nuevo'] ?? 0);
                $precioViejoActual = balance_deudores_formatear_monto($cambio['precio_viejo'] ?? 0);

                if (abs($precioAnterior - $precioViejoActual) > 0.009) {
                    $advertencias[] = [
                        'codigo' => 'CADENA_HISTORIAL_INCONSISTENTE',
                        'id_cat_monto' => (int) $idCategoria,
                        'id_historial_anterior' => (int) ($anterior['id_historial'] ?? 0) ?: null,
                        'id_historial_actual' => (int) ($cambio['id_historial'] ?? 0) ?: null,
                        'precio_nuevo_anterior' => $precioAnterior,
                        'precio_viejo_actual' => $precioViejoActual,
                    ];
                }
            }

            $anterior = $cambio;
        }
    }

    return $advertencias;
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
        - id_cat_monto identifica la categoría cuyo historial debe consultarse.
        - categoria_monto.monto_mensual queda únicamente como fallback si la
          categoría nunca tuvo registros en precios_historicos.
        - el monto mensual representa el valor completo del período bimestral.
          Ejemplo: PERÍODO 1 Y 2 = $5000, NO $10000.
    */
    $sqlSocios = "
        SELECT
            s.id_socio,
            s.nombre,
            s.dni,
            s.ingreso,
            s.fecha_baja,
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

    $paramsSocios = [];

    if (!$incluirInactivos) {
        // El balance debe usar el estado del socio a la fecha de cierre, no su
        // estado actual. Si fue dado de baja después de fecha_hasta, al cierre
        // todavía estaba activo y debe seguir formando parte de Deudores.
        $sqlSocios .= "
            WHERE s.activo = 1
               OR (
                    s.activo = 0
                    AND s.fecha_baja IS NOT NULL
                    AND s.fecha_baja > :fecha_cierre_balance
               )
        ";
        $paramsSocios[':fecha_cierre_balance'] = $hasta;
    }

    $sqlSocios .= " ORDER BY s.nombre ASC, s.id_socio ASC ";

    $stmtSocios = $pdo->prepare($sqlSocios);
    $stmtSocios->execute($paramsSocios);
    $socios = $stmtSocios->fetchAll(PDO::FETCH_ASSOC);

    // Historial mensual de las categorías involucradas, cargado una sola vez.
    $idsCategoriasMonto = [];

    foreach ($socios as $socio) {
        if (!empty($socio['id_cat_monto'])) {
            $idsCategoriasMonto[] = (int) $socio['id_cat_monto'];
        }
    }

    $historialMensual = balance_deudores_cargar_historial_mensual(
        $pdo,
        $idsCategoriasMonto
    );

    $advertenciasAuditoria = balance_deudores_auditar_historial($historialMensual);

    /*
        PAGOS:
        - pago directo del período cubre solamente ese período.
        - CONTADO ANUAL cubre todos los períodos del año aplicado.
        - si anio_aplicado viene 0, se toma YEAR(fecha_pago).
    */
    $pagosDirectos = [];
    $pagosAnuales = [];
    $clavesPagoVistas = [];
    $pagosDuplicados = [];

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
              AND fecha_pago <= ?
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

        // El balance es una foto al cierre indicado: los pagos posteriores a
        // fecha_hasta no pueden modificar retroactivamente la deuda. Se conservan
        // pagos anteriores a fecha_desde porque pueden ser anticipos válidos de
        // períodos incluidos en el informe.
        $paramsPagos = array_merge([$hasta], $aniosBalance, $aniosBalance);
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

            $clavePago = $idSocio . '-' . $anioAplicado . '-' . $idPeriodo;

            if (isset($clavesPagoVistas[$clavePago])) {
                if (!isset($pagosDuplicados[$clavePago])) {
                    $pagosDuplicados[$clavePago] = [
                        'id_socio' => $idSocio,
                        'anio_aplicado' => $anioAplicado,
                        'id_periodo' => $idPeriodo,
                        'ids_pago' => [$clavesPagoVistas[$clavePago]],
                    ];
                }

                $pagosDuplicados[$clavePago]['ids_pago'][] = (int) $pago['id_pago'];
            } else {
                $clavesPagoVistas[$clavePago] = (int) $pago['id_pago'];
            }

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
                MONTO HISTÓRICO EXACTO:
                Se toma el valor vigente al cierre del bimestre analizado,
                igual que en Cuotas y Detalle de Cobranza. El monto representa
                el período completo y NO se multiplica por dos.
            */
            $montoActualCategoria = balance_deudores_formatear_monto(
                $socio['monto_mensual'] ?? 0
            );
            $resolucionMonto = balance_deudores_resolver_monto_mensual_historico(
                $idCatMonto,
                $fechaFinPeriodo,
                $montoActualCategoria,
                $historialMensual
            );
            $montoPeriodo = balance_deudores_formatear_monto($resolucionMonto['monto'] ?? 0);
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
                'fecha_baja' => $socio['fecha_baja'] ?? null,
                'activo' => isset($socio['activo']) ? (int) $socio['activo'] : null,

                'id_estado' => isset($socio['id_estado']) ? (int) $socio['id_estado'] : null,
                'estado_descripcion' => $socio['estado_descripcion'] ?? null,
                'grupo' => $grupo,
                'grupo_label' => $grupoLabel,

                'id_categoria' => isset($socio['id_categoria']) ? (int) $socio['id_categoria'] : null,
                'categoria_descripcion' => $socio['categoria_descripcion'] ?? null,

                'id_cat_monto' => $idCatMonto,
                'cat_monto_nombre' => $socio['cat_monto_nombre'] ?? null,

                // Monto histórico vigente para este período.
                'monto_periodo' => $montoPeriodo,
                'monto_adeudado' => $montoAdeudado,
                'monto_historico' => $montoPeriodo,
                'monto_actual_categoria' => $montoActualCategoria,
                'fecha_referencia_monto' => $fechaFinPeriodo,
                'monto_fuente' => $resolucionMonto['fuente'] ?? null,
                'monto_historial_id' => $resolucionMonto['id_historial'] ?? null,
                'monto_fecha_cambio' => $resolucionMonto['fecha_cambio'] ?? null,
                'monto_precio_viejo' => $resolucionMonto['precio_viejo'] ?? null,
                'monto_precio_nuevo' => $resolucionMonto['precio_nuevo'] ?? null,

                // Alias viejos para no romper el frontend si quedó alguna referencia anterior
                'monto_estimado' => $montoAdeudado,

                'domicilio' => $domicilio,
                'domicilio_cobro' => $socio['domicilio_cobro'] ?? null,
                'telefono_movil' => $socio['telefono_movil'] ?? null,
                'telefono_fijo' => $socio['telefono_fijo'] ?? null,
                'cobrador' => $socio['cobrador'] ?? null,

                'motivo_deuda' => 'Sin pago registrado hasta la fecha de cierre del informe para el período ni contado anual del año.',
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

    // Controles contables: todas las vistas del mismo balance deben cerrar exactamente.
    $montoControlItems = balance_deudores_formatear_monto(array_sum(array_map(
        static fn (array $item): float => balance_deudores_formatear_monto($item['monto_adeudado'] ?? 0),
        $items
    )));

    $montoControlPeriodos = balance_deudores_formatear_monto(array_sum(array_map(
        static fn (array $periodo): float => balance_deudores_formatear_monto($periodo['monto_total_adeudado'] ?? 0),
        $periodosBalance
    )));

    $montoControlResumen = balance_deudores_formatear_monto(
        (float) $resumen['activos']['monto_total_adeudado']
        + (float) $resumen['pasivos']['monto_total_adeudado']
        + (float) $resumen['sin_estado']['monto_total_adeudado']
    );

    $cantidadControlPeriodos = array_sum(array_map(
        static fn (array $periodo): int => (int) ($periodo['deudores_cantidad'] ?? 0),
        $periodosBalance
    ));

    $cantidadControlResumen =
        (int) $resumen['activos']['cantidad']
        + (int) $resumen['pasivos']['cantidad']
        + (int) $resumen['sin_estado']['cantidad'];

    $totalMontoAdeudado = balance_deudores_formatear_monto($totalMontoAdeudado);

    $controlMontosOk =
        abs($montoControlItems - $montoControlPeriodos) <= 0.009
        && abs($montoControlItems - $montoControlResumen) <= 0.009
        && abs($montoControlItems - $totalMontoAdeudado) <= 0.009;

    $controlCantidadesOk =
        count($items) === $cantidadControlPeriodos
        && count($items) === $cantidadControlResumen;

    if (!$controlMontosOk || !$controlCantidadesOk) {
        throw new RuntimeException('El balance no cerró sus controles internos de sumas y cantidades.');
    }

    $auditoriaCalculo = [
        'control_ok' => true,
        'monto_detalle' => $montoControlItems,
        'monto_periodos' => $montoControlPeriodos,
        'monto_resumen_estados' => $montoControlResumen,
        'monto_total_general' => $totalMontoAdeudado,
        'cantidad_detalle' => count($items),
        'cantidad_periodos' => $cantidadControlPeriodos,
        'cantidad_resumen_estados' => $cantidadControlResumen,
        'pagos_duplicados_detectados' => count($pagosDuplicados),
        'fecha_corte_pagos' => $hasta,
        'regla_fecha_pagos' => 'SE CONSIDERAN PAGOS CON fecha_pago MENOR O IGUAL A fecha_hasta. LOS PAGOS POSTERIORES NO REDUCEN RETROACTIVAMENTE LA DEUDA.',
        'regla_anticipos' => 'LOS PAGOS ANTERIORES A fecha_desde SE CONSERVAN SI CUBREN UN PERÍODO INCLUIDO EN EL BALANCE.',
        'regla_vigencia_socios' => 'SE USA EL ESTADO DEL SOCIO A fecha_hasta: UNA BAJA POSTERIOR AL CIERRE NO LO EXCLUYE RETROACTIVAMENTE.',
        'regla_historica' => 'PRECIO VIGENTE AL ÚLTIMO DÍA DEL BIMESTRE',
    ];

    if (!empty($pagosDuplicados)) {
        $advertenciasAuditoria[] = [
            'codigo' => 'PAGOS_DUPLICADOS_MISMO_SOCIO_ANIO_PERIODO',
            'cantidad_claves' => count($pagosDuplicados),
            'detalle' => array_values($pagosDuplicados),
            'impacto_calculo' => 'SIN DOBLE IMPACTO: se toma un único estado de pago por socio, año y período.',
        ];
    }

    balance_deudores_responder([
        'ok' => true,
        'exito' => true,
        'mensaje' => 'Deudores por período del balance obtenidos correctamente.',
        'desde' => $desde,
        'hasta' => $hasta,
        'incluye_contado_anual' => true,
        'criterio_fecha_pagos' => 'Se consideran pagos registrados hasta la fecha hasta inclusive. Los pagos posteriores quedan fuera; los anticipos anteriores a fecha desde siguen cubriendo el período que corresponda.',
        'criterio_vigencia_socios' => 'Se incluyen socios activos al cierre del informe. Una baja registrada después de fecha hasta no los excluye retroactivamente.',
        'criterio_monto' => 'El monto adeudado usa precios_historicos según la fecha de cierre de cada período. categoria_monto.monto_mensual se usa sólo si la categoría no tiene historial. No se multiplica por cantidad de meses.',
        'totales' => [
            'total_deudores' => count($items),
            'periodos_cantidad' => count($periodosBalance),
            'activos' => (int) $resumen['activos']['cantidad'],
            'pasivos' => (int) $resumen['pasivos']['cantidad'],
            'sin_estado' => (int) $resumen['sin_estado']['cantidad'],

            // Campo correcto nuevo
            'monto_total_adeudado' => $totalMontoAdeudado,

            // Alias viejo para compatibilidad
            'monto_total_estimado' => $totalMontoAdeudado,
        ],
        'auditoria_calculo' => $auditoriaCalculo,
        'advertencias_auditoria' => $advertenciasAuditoria,
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