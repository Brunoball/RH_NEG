<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json');

/** Mapeo nombre mes (ES) -> número (1-12) */
function obtenerMesNumero($nombreMes) {
    static $meses = [
        'ENERO' => 1, 'FEBRERO' => 2, 'MARZO' => 3, 'ABRIL' => 4,
        'MAYO' => 5, 'JUNIO' => 6, 'JULIO' => 7, 'AGOSTO' => 8,
        'SEPTIEMBRE' => 9, 'OCTUBRE' => 10, 'NOVIEMBRE' => 11, 'DICIEMBRE' => 12
    ];
    $k = strtoupper(trim($nombreMes));
    return $meses[$k] ?? null;
}

/**
 * Dado el campo periodo.meses (p.ej. "JULIO - AGOSTO", "ENERO Y FEBRERO", "MAYO/JUNIO"),
 * devuelve [mesInicio, mesFin]. Si no puede parsear, intenta fallback por id_periodo bimestral 1..6.
 */
function obtenerRangoMeses($textoMeses, $idPeriodo = null) {
    $texto = strtoupper($textoMeses ?? '');
    // Extraer nombres de meses presentes en el string (robusto a " - ", " Y ", "/", etc)
    $encontrados = [];
    foreach (['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'] as $mes) {
        if (strpos($texto, $mes) !== false) $encontrados[] = $mes;
    }
    if (!empty($encontrados)) {
        $nums = array_map('obtenerMesNumero', $encontrados);
        $mesInicio = min($nums);
        $mesFin    = max($nums);
        return [$mesInicio, $mesFin];
    }

    // Fallback por id_periodo (1:1-2, 2:3-4, 3:5-6, 4:7-8, 5:9-10, 6:11-12)
    if ($idPeriodo !== null) {
        $map = [
            1 => [1, 2], 2 => [3, 4], 3 => [5, 6],
            4 => [7, 8], 5 => [9,10], 6 => [11,12]
        ];
        if (isset($map[$idPeriodo])) return $map[$idPeriodo];
    }

    // Último fallback: 1-12 (inclusivo) para no excluir por error de formato
    return [1, 12];
}

/**
 * Verifica si el socio ya estaba activo antes o durante el período:
 * elegible si fechaIngreso <= último día del mes FIN del período (año actual).
 */
function socioElegibleEnPeriodo($fechaIngreso, $mesFin, $anioPeriodo) {
    // Si no hay fecha de ingreso, asumir que puede pagar desde el inicio del año
    if (!$fechaIngreso) return true;

    try {
        $ingreso = new DateTime($fechaIngreso);
    } catch (Exception $e) {
        return true; // ante formato raro, no excluir
    }

    // Último día del mes FIN del período del año consultado
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
    $incluirInactivos  = ($verPagados || $verCondonados); // pestañas Pagados/Condonados

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
        $sociosSql .= "
            WHERE s.activo = 1
               OR EXISTS (
                    SELECT 1 FROM pagos p
                    WHERE p.id_socio = s.id_socio
                    " . ($idPeriodoFilter > 0 ? " AND p.id_periodo = :pp2 " : "") . "
               )
        ";
    } else {
        $sociosSql .= " WHERE s.activo = 1 ";
    }

    $sociosSql .= " ORDER BY s.nombre ASC ";

    $stmt = $pdo->prepare($sociosSql);
    if ($incluirInactivos && $idPeriodoFilter > 0) {
        $stmt->bindValue(':pp2', $idPeriodoFilter, PDO::PARAM_INT);
    }
    $stmt->execute();
    $socios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // =========================
    //   PERIODOS
    // =========================
    $periodosSql = "SELECT id_periodo, nombre, meses FROM periodo";
    if ($idPeriodoFilter > 0) $periodosSql .= " WHERE id_periodo = :p";
    $periodosSql .= " ORDER BY id_periodo ASC";
    $periodosStmt = $pdo->prepare($periodosSql);
    if ($idPeriodoFilter > 0) $periodosStmt->bindValue(':p', $idPeriodoFilter, PDO::PARAM_INT);
    $periodosStmt->execute();
    $periodos = $periodosStmt->fetchAll(PDO::FETCH_ASSOC);

    // =========================
    //   PAGOS
    // =========================
    $pagosSql = "SELECT id_socio, id_periodo, estado FROM pagos";
    if ($idPeriodoFilter > 0) $pagosSql .= " WHERE id_periodo = :pp";
    $pagosStmt = $pdo->prepare($pagosSql);
    if ($idPeriodoFilter > 0) $pagosStmt->bindValue(':pp', $idPeriodoFilter, PDO::PARAM_INT);
    $pagosStmt->execute();
    $pagos = $pagosStmt->fetchAll(PDO::FETCH_ASSOC);

    $pagosPorSocio = []; // [id_socio][id_periodo] => 'pagado'|'condonado'
    foreach ($pagos as $p) {
        $pagosPorSocio[(int)$p['id_socio']][(int)$p['id_periodo']] = $p['estado'] ?: 'pagado';
    }

    // =========================
    //   ARMADO DE CUOTAS
    // =========================
    $cuotas = [];
    foreach ($socios as $socio) {
        $id = (int)$socio['id_socio'];

        foreach ($periodos as $periodo) {
            $idPeriodo     = (int)$periodo['id_periodo'];
            $nombrePeriodo = $periodo['nombre'];
            [$mesInicio, $mesFin] = obtenerRangoMeses($periodo['meses'] ?? '', $idPeriodo);

            // ✔ Elegibilidad por ingreso: hasta el fin del período (no solo el primer mes)
            if (!socioElegibleEnPeriodo($socio['ingreso'] ?? null, $mesFin, $anioActual)) {
                continue;
            }

            // Estado de pago
            $estadoPago = 'deudor';
            if (isset($pagosPorSocio[$id][$idPeriodo])) {
                $estadoPago = ($pagosPorSocio[$id][$idPeriodo] === 'condonado') ? 'condonado' : 'pagado';
            }

            // Domicilio final
            $domicilioFinal = '';
            if (!empty($socio['domicilio_cobro'])) {
                $domicilioFinal = $socio['domicilio_cobro'];
            } elseif (!empty($socio['domicilio']) || !empty($socio['numero'])) {
                $domicilioFinal = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));
            }

            $cuotas[] = [
                'id_socio'    => $id,
                'nombre'      => $socio['nombre'],
                'domicilio'   => $domicilioFinal,
                'estado'      => $socio['estado'] ?? 'No definido',
                'medio_pago'  => $socio['cobrador'] ?? 'No definido',
                'mes'         => $nombrePeriodo,
                'id_periodo'  => $idPeriodo,
                'estado_pago' => $estadoPago, // 'deudor' | 'pagado' | 'condonado'
            ];
        }
    }

    echo json_encode(['exito' => true, 'cuotas' => $cuotas]);
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error al obtener cuotas: ' . $e->getMessage()]);
}
