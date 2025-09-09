<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json');

/**
 * cuotas.php
 * - Si viene ?listar_anios=1 => devuelve años distintos existentes en pagos (orden desc).
 * - Si viene ?anio=YYYY, el resto de la lógica filtra por ese año.
 * - La propagación del pago ANUAL (id_periodo=7) respeta el año.
 */

const ID_CONTADO_ANUAL = 7;

/* ======= NUEVO: endpoint para listar años con pagos ======= */
if (isset($_GET['listar_anios'])) {
    try {
        $stmt = $pdo->query("SELECT DISTINCT YEAR(fecha_pago) AS anio FROM pagos WHERE fecha_pago IS NOT NULL ORDER BY anio DESC");
        $rows = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $anios = array_values(array_map('intval', $rows ?: []));
        if (empty($anios)) {
            $anios = [(int)date('Y')];
        }
        echo json_encode(['exito' => true, 'anios' => $anios], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Throwable $e) {
        echo json_encode(['exito' => false, 'mensaje' => 'No se pudieron obtener los años']);
        exit;
    }
}

function obtenerMesNumero($nombreMes) {
    static $meses = [
        'ENERO'=>1,'FEBRERO'=>2,'MARZO'=>3,'ABRIL'=>4,'MAYO'=>5,'JUNIO'=>6,
        'JULIO'=>7,'AGOSTO'=>8,'SEPTIEMBRE'=>9,'OCTUBRE'=>10,'NOVIEMBRE'=>11,'DICIEMBRE'=>12
    ];
    $k = strtoupper(trim($nombreMes));
    return $meses[$k] ?? null;
}

function obtenerRangoMeses($textoMeses, $idPeriodo = null) {
    $texto = strtoupper($textoMeses ?? '');
    $encontrados = [];
    foreach (['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'] as $mes) {
        if (strpos($texto, $mes) !== false) $encontrados[] = $mes;
    }
    if (!empty($encontrados)) {
        $nums = array_map('obtenerMesNumero', $encontrados);
        return [min($nums), max($nums)];
    }
    if ($idPeriodo !== null) {
        $map = [1=>[1,2],2=>[3,4],3=>[5,6],4=>[7,8],5=>[9,10],6=>[11,12]];
        if (isset($map[$idPeriodo])) return $map[$idPeriodo];
    }
    return [1,12];
}

function socioElegibleEnPeriodo($fechaIngreso, $mesFin, $anioPeriodo) {
    if (!$fechaIngreso) return true;
    try { $ingreso = new DateTime($fechaIngreso); } catch (Exception $e) { return true; }
    $finPeriodo = DateTime::createFromFormat('Y-n-j', $anioPeriodo . '-' . $mesFin . '-1');
    if ($finPeriodo === false) return true;
    $finPeriodo->modify('last day of this month');
    return $ingreso <= $finPeriodo;
}

try {
    $anioFiltro        = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)date('Y');
    $idPeriodoFilter   = isset($_GET['id_periodo']) ? (int)$_GET['id_periodo'] : 0;
    $verPagados        = isset($_GET['pagados']);
    $verCondonados     = isset($_GET['condonados']);

    $incluirInactivos  = ($verPagados || $verCondonados);

    // ===== SOCIOS =====
    // ⬇️ NUEVO: traemos la categoría de monto del socio + sus valores
    $sociosSql = "
        SELECT 
            s.id_socio, s.nombre, s.domicilio, s.numero, s.domicilio_cobro,
            s.ingreso, c.nombre AS cobrador, e.descripcion AS estado, s.activo,
            s.id_cat_monto,
            cm.monto_mensual AS monto_mensual_cat,
            cm.monto_anual   AS monto_anual_cat
        FROM socios s
        LEFT JOIN cobrador c ON s.id_cobrador = c.id_cobrador
        LEFT JOIN estado   e ON s.id_estado   = e.id_estado
        LEFT JOIN categoria_monto cm ON cm.id_cat_monto = s.id_cat_monto
    ";
    if ($incluirInactivos) {
        if ($idPeriodoFilter > 0) {
            $sociosSql .= "
                WHERE s.activo = 1
                   OR EXISTS (
                        SELECT 1 FROM pagos p
                         WHERE p.id_socio = s.id_socio
                           AND p.id_periodo IN (:pp2, :anual2)
                           AND YEAR(p.fecha_pago) = :anio2
                   )
            ";
        } else {
            $sociosSql .= " WHERE s.activo = 1 ";
        }
    } else {
        $sociosSql .= " WHERE s.activo = 1 ";
    }
    $sociosSql .= " ORDER BY s.nombre ASC ";
    $stmt = $pdo->prepare($sociosSql);
    if ($incluirInactivos && $idPeriodoFilter > 0) {
        $stmt->bindValue(':pp2', $idPeriodoFilter, PDO::PARAM_INT);
        $stmt->bindValue(':anual2', ID_CONTADO_ANUAL, PDO::PARAM_INT);
        $stmt->bindValue(':anio2', $anioFiltro, PDO::PARAM_INT);
    }
    $stmt->execute();
    $socios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ===== PERIODOS =====
    $periodosStmt = $pdo->query("SELECT id_periodo, nombre, meses FROM periodo ORDER BY id_periodo ASC");
    $periodos = $periodosStmt->fetchAll(PDO::FETCH_ASSOC);

    // ===== PAGOS (FILTRADOS POR AÑO) =====
    if ($idPeriodoFilter > 0 && $idPeriodoFilter !== ID_CONTADO_ANUAL) {
        $pagosStmt = $pdo->prepare("
            SELECT id_socio, id_periodo, estado, fecha_pago
              FROM pagos
             WHERE id_periodo IN (:pp, :anual)
               AND YEAR(fecha_pago) = :anio
        ");
        $pagosStmt->bindValue(':pp', $idPeriodoFilter, PDO::PARAM_INT);
        $pagosStmt->bindValue(':anual', ID_CONTADO_ANUAL, PDO::PARAM_INT);
        $pagosStmt->bindValue(':anio', $anioFiltro, PDO::PARAM_INT);
        $pagosStmt->execute();
    } else {
        $pagosStmt = $pdo->prepare("
            SELECT id_socio, id_periodo, estado, fecha_pago
              FROM pagos
             WHERE YEAR(fecha_pago) = :anio
        ");
        $pagosStmt->bindValue(':anio', $anioFiltro, PDO::PARAM_INT);
        $pagosStmt->execute();
    }
    $pagos = $pagosStmt->fetchAll(PDO::FETCH_ASSOC);

    $pagoDirecto = []; // [id_socio][id_periodo] => estado
    $pagoAnual   = []; // [id_socio] => estado (para id 7)
    foreach ($pagos as $p) {
        $sid = (int)$p['id_socio'];
        $pid = (int)$p['id_periodo'];
        $est = $p['estado'] ?: 'pagado';
        if ($pid === ID_CONTADO_ANUAL) {
            $pagoAnual[$sid] = $est;
        } else {
            $pagoDirecto[$sid][$pid] = $est;
        }
    }

    // ===== ARMADO DE CUOTAS =====
    $cuotas = [];

    // -- Caso CONTADO ANUAL
    if ($idPeriodoFilter === ID_CONTADO_ANUAL) {
        $nombreAnual = 'CONTADO ANUAL';
        foreach ($periodos as $pp) {
            if ((int)$pp['id_periodo'] === ID_CONTADO_ANUAL) {
                $nombreAnual = $pp['nombre'] ?: 'CONTADO ANUAL';
                break;
            }
        }

        foreach ($socios as $socio) {
            $idSocio = (int)$socio['id_socio'];

            if (!socioElegibleEnPeriodo($socio['ingreso'] ?? null, 12, $anioFiltro)) continue;

            $estadoPago = 'deudor';
            $origenAnual = false;
            if (isset($pagoAnual[$idSocio])) {
                $estadoPago  = ($pagoAnual[$idSocio] === 'condonado') ? 'condonado' : 'pagado';
                $origenAnual = true;
            }

            if ($verPagados && $estadoPago !== 'pagado') continue;
            if ($verCondonados && $estadoPago !== 'condonado') continue;

            $domicilioFinal = '';
            if (!empty($socio['domicilio_cobro']))       $domicilioFinal = $socio['domicilio_cobro'];
            elseif (!empty($socio['domicilio']) || !empty($socio['numero']))
                $domicilioFinal = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));

            $cuotas[] = [
                'id_socio'    => $idSocio,
                'nombre'      => $socio['nombre'],
                'domicilio'   => $domicilioFinal,
                'estado'      => $socio['estado'] ?? 'No definido',
                'medio_pago'  => $socio['cobrador'] ?? 'No definido',
                'mes'         => $nombreAnual,
                'id_periodo'  => ID_CONTADO_ANUAL,
                'estado_pago' => $estadoPago,
                'origen_anual'=> $origenAnual,

                // ⬇️ NUEVO: montos por categoría
                'monto_mensual' => (int)($socio['monto_mensual_cat'] ?? 0),
                'monto_anual'   => (int)($socio['monto_anual_cat'] ?? 0),
            ];
        }

        echo json_encode(['exito' => true, 'cuotas' => $cuotas], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -- Períodos 1..6 (propaga anual del mismo año)
    $periodos16 = array_values(array_filter($periodos, fn($p) => (int)$p['id_periodo'] !== ID_CONTADO_ANUAL));

    foreach ($socios as $socio) {
        $idSocio = (int)$socio['id_socio'];
        $tieneAnual = isset($pagoAnual[$idSocio]);

        foreach ($periodos16 as $periodo) {
            $idPeriodo     = (int)$periodo['id_periodo'];
            $nombrePeriodo = $periodo['nombre'];

            if ($idPeriodoFilter > 0 && $idPeriodo !== $idPeriodoFilter) continue;

            [, $mesFin] = obtenerRangoMeses($periodo['meses'] ?? '', $idPeriodo);
            if (!socioElegibleEnPeriodo($socio['ingreso'] ?? null, $mesFin, $anioFiltro)) continue;

            $estadoPago  = 'deudor';
            $origenAnual = false;
            if (isset($pagoDirecto[$idSocio][$idPeriodo])) {
                $estadoPago  = ($pagoDirecto[$idSocio][$idPeriodo] === 'condonado') ? 'condonado' : 'pagado';
            } elseif ($tieneAnual) {
                $estadoPago  = ($pagoAnual[$idSocio] === 'condonado') ? 'condonado' : 'pagado';
                $origenAnual = true;
            }

            if ($verPagados && $estadoPago !== 'pagado') continue;
            if ($verCondonados && $estadoPago !== 'condonado') continue;

            $domicilioFinal = '';
            if (!empty($socio['domicilio_cobro']))       $domicilioFinal = $socio['domicilio_cobro'];
            elseif (!empty($socio['domicilio']) || !empty($socio['numero']))
                $domicilioFinal = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));

            $cuotas[] = [
                'id_socio'    => $idSocio,
                'nombre'      => $socio['nombre'],
                'domicilio'   => $domicilioFinal,
                'estado'      => $socio['estado'] ?? 'No definido',
                'medio_pago'  => $socio['cobrador'] ?? 'No definido',
                'mes'         => $nombrePeriodo,
                'id_periodo'  => $idPeriodo,
                'estado_pago' => $estadoPago,
                'origen_anual'=> $origenAnual,

                // ⬇️ NUEVO: montos por categoría
                'monto_mensual' => (int)($socio['monto_mensual_cat'] ?? 0),
                'monto_anual'   => (int)($socio['monto_anual_cat'] ?? 0),
            ];
        }
    }

    echo json_encode(['exito' => true, 'cuotas' => $cuotas], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error al obtener cuotas: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error inesperado: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
