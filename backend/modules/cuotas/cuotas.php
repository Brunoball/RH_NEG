<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json');

// ===== CONFIG =====
const ID_CONTADO_ANUAL = 7;

/** Mapeo nombre mes (ES) -> número (1-12) */
function obtenerMesNumero($nombreMes) {
    static $meses = [
        'ENERO'=>1,'FEBRERO'=>2,'MARZO'=>3,'ABRIL'=>4,'MAYO'=>5,'JUNIO'=>6,
        'JULIO'=>7,'AGOSTO'=>8,'SEPTIEMBRE'=>9,'OCTUBRE'=>10,'NOVIEMBRE'=>11,'DICIEMBRE'=>12
    ];
    $k = strtoupper(trim($nombreMes));
    return $meses[$k] ?? null;
}

/**
 * Dado periodo.meses (p.ej. "JULIO - AGOSTO", "ENERO Y FEBRERO", "MAYO/JUNIO"),
 * devuelve [mesInicio, mesFin]. Si no puede parsear, fallback por id_periodo bimestral 1..6.
 */
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
        $map = [
            1 => [1, 2], 2 => [3, 4], 3 => [5, 6],
            4 => [7, 8], 5 => [9,10], 6 => [11,12]
        ];
        if (isset($map[$idPeriodo])) return $map[$idPeriodo];
    }
    return [1, 12];
}

/** Elegible si fechaIngreso <= último día del mes FIN del período (año actual). */
function socioElegibleEnPeriodo($fechaIngreso, $mesFin, $anioPeriodo) {
    if (!$fechaIngreso) return true;
    try { $ingreso = new DateTime($fechaIngreso); } catch (Exception $e) { return true; }
    $finPeriodo = DateTime::createFromFormat('Y-n-j', $anioPeriodo . '-' . $mesFin . '-1');
    if ($finPeriodo === false) return true;
    $finPeriodo->modify('last day of this month');
    return $ingreso <= $finPeriodo;
}

try {
    $anioActual        = (int)date('Y');
    $idPeriodoFilter   = isset($_GET['id_periodo']) ? (int)$_GET['id_periodo'] : 0;
    $verPagados        = isset($_GET['pagados']);
    $verCondonados     = isset($_GET['condonados']);

    // Incluir inactivos solo en pestañas Pagados/Condonados
    $incluirInactivos  = ($verPagados || $verCondonados);

    // =========================
    //   SOCIOS
    // =========================
    $sociosSql = "
        SELECT 
            s.id_socio,
            s.nombre,
            s.domicilio,
            s.numero,
            s.domicilio_cobro,
            s.ingreso,
            c.nombre AS cobrador,
            e.descripcion AS estado,
            s.activo
        FROM socios s
        LEFT JOIN cobrador c ON s.id_cobrador = c.id_cobrador
        LEFT JOIN estado   e ON s.id_estado   = e.id_estado
    ";

    if ($incluirInactivos) {
        if ($idPeriodoFilter > 0) {
            // Si filtra período, incluí inactivos que tengan pago de ese período o ANUAL
            $sociosSql .= "
                WHERE s.activo = 1
                   OR EXISTS (
                        SELECT 1 FROM pagos p
                         WHERE p.id_socio = s.id_socio
                           AND p.id_periodo IN (:pp2, :anual2)
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
    }
    $stmt->execute();
    $socios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // =========================
    //   PERIODOS
    // =========================
    $periodosStmt = $pdo->query("SELECT id_periodo, nombre, meses FROM periodo ORDER BY id_periodo ASC");
    $periodos = $periodosStmt->fetchAll(PDO::FETCH_ASSOC);

    // =========================
    //   PAGOS
    // =========================
    // Siempre precisamos 7 para propagar
    if ($idPeriodoFilter > 0 && $idPeriodoFilter !== ID_CONTADO_ANUAL) {
        $pagosStmt = $pdo->prepare("
            SELECT id_socio, id_periodo, estado
              FROM pagos
             WHERE id_periodo IN (:pp, :anual)
        ");
        $pagosStmt->bindValue(':pp', $idPeriodoFilter, PDO::PARAM_INT);
        $pagosStmt->bindValue(':anual', ID_CONTADO_ANUAL, PDO::PARAM_INT);
        $pagosStmt->execute();
    } else {
        $pagosStmt = $pdo->query("SELECT id_socio, id_periodo, estado FROM pagos");
    }
    $pagos = $pagosStmt->fetchAll(PDO::FETCH_ASSOC);

    $pagoDirecto = []; // [id_socio][id_periodo(1..6)] => 'pagado'|'condonado'
    $pagoAnual   = []; // [id_socio] => 'pagado'|'condonado' (7)
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

    // =========================
    //   ARMADO DE CUOTAS
    // =========================
    $cuotas = [];

    // ----- Caso especial: filtro por CONTADO ANUAL (7) -----
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

            // Elegibilidad anual: hasta diciembre
            if (!socioElegibleEnPeriodo($socio['ingreso'] ?? null, 12, $anioActual)) {
                continue;
            }

            $estadoPago = 'deudor';
            $origenAnual = false;
            if (isset($pagoAnual[$idSocio])) {
                $estadoPago  = ($pagoAnual[$idSocio] === 'condonado') ? 'condonado' : 'pagado';
                $origenAnual = true; // viene de un registro anual
            }

            if ($verPagados && $estadoPago !== 'pagado') continue;
            if ($verCondonados && $estadoPago !== 'condonado') continue;

            $domicilioFinal = '';
            if (!empty($socio['domicilio_cobro'])) {
                $domicilioFinal = $socio['domicilio_cobro'];
            } elseif (!empty($socio['domicilio']) || !empty($socio['numero'])) {
                $domicilioFinal = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));
            }

            $cuotas[] = [
                'id_socio'     => $idSocio,
                'nombre'       => $socio['nombre'],
                'domicilio'    => $domicilioFinal,
                'estado'       => $socio['estado'] ?? 'No definido',
                'medio_pago'   => $socio['cobrador'] ?? 'No definido',
                'mes'          => $nombreAnual,
                'id_periodo'   => ID_CONTADO_ANUAL,
                'estado_pago'  => $estadoPago,
                'origen_anual' => $origenAnual, // <- agregado
            ];
        }

        echo json_encode(['exito' => true, 'cuotas' => $cuotas], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ----- Caso normal: períodos 1..6 (propaga anual si no hay pago directo) -----
    $periodos16 = array_values(array_filter($periodos, function($p){
        return (int)$p['id_periodo'] !== ID_CONTADO_ANUAL;
    }));

    foreach ($socios as $socio) {
        $idSocio = (int)$socio['id_socio'];
        $tieneAnual = isset($pagoAnual[$idSocio]);

        foreach ($periodos16 as $periodo) {
            $idPeriodo     = (int)$periodo['id_periodo'];
            $nombrePeriodo = $periodo['nombre'];

            if ($idPeriodoFilter > 0 && $idPeriodo !== $idPeriodoFilter) continue;

            [$mesInicio, $mesFin] = obtenerRangoMeses($periodo['meses'] ?? '', $idPeriodo);
            if (!socioElegibleEnPeriodo($socio['ingreso'] ?? null, $mesFin, $anioActual)) {
                continue;
            }

            $estadoPago  = 'deudor';
            $origenAnual = false;
            if (isset($pagoDirecto[$idSocio][$idPeriodo])) {
                $estadoPago  = ($pagoDirecto[$idSocio][$idPeriodo] === 'condonado') ? 'condonado' : 'pagado';
                $origenAnual = false; // directo
            } elseif ($tieneAnual) {
                $estadoPago  = ($pagoAnual[$idSocio] === 'condonado') ? 'condonado' : 'pagado';
                $origenAnual = true; // proviene de anual
            }

            if ($verPagados && $estadoPago !== 'pagado') continue;
            if ($verCondonados && $estadoPago !== 'condonado') continue;

            $domicilioFinal = '';
            if (!empty($socio['domicilio_cobro'])) {
                $domicilioFinal = $socio['domicilio_cobro'];
            } elseif (!empty($socio['domicilio']) || !empty($socio['numero'])) {
                $domicilioFinal = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));
            }

            $cuotas[] = [
                'id_socio'     => $idSocio,
                'nombre'       => $socio['nombre'],
                'domicilio'    => $domicilioFinal,
                'estado'       => $socio['estado'] ?? 'No definido',
                'medio_pago'   => $socio['cobrador'] ?? 'No definido',
                'mes'          => $nombrePeriodo,
                'id_periodo'   => $idPeriodo,
                'estado_pago'  => $estadoPago,
                'origen_anual' => $origenAnual, // <- agregado
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
