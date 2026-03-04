<?php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$idSocio = isset($_GET['id_socio']) ? (int)$_GET['id_socio'] : 0;
/* Año a consultar. Si no llega, usamos el año actual */
$anio    = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)date('Y');

if ($idSocio <= 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID de socio no proporcionado']);
    exit;
}

const ID_CONTADO_ANUAL = 7;

try {
    // =========================================================
    // Helper: detectar si existe la columna anio_aplicado en pagos
    // =========================================================
    $tieneAnioAplicado = false;
    try {
        $chk = $pdo->query("SHOW COLUMNS FROM pagos LIKE 'anio_aplicado'");
        $tieneAnioAplicado = ($chk && $chk->fetch(PDO::FETCH_ASSOC)) ? true : false;
    } catch (Exception $e) {
        $tieneAnioAplicado = false;
    }

    // =========================
    // 1) PAGOS DE CUOTAS (por año)
    // =========================
    if ($tieneAnioAplicado) {
        // ✅ CORRECTO: se usa el año "lógico" del pago
        $stmtPagos = $pdo->prepare("
            SELECT id_periodo, estado, fecha_pago
              FROM pagos
             WHERE id_socio = ?
               AND anio_aplicado = ?
             ORDER BY fecha_pago DESC, id_pago DESC
        ");
        $stmtPagos->execute([$idSocio, $anio]);
    } else {
        // ⚠️ Fallback viejo por si esa DB no tiene anio_aplicado
        $stmtPagos = $pdo->prepare("
            SELECT id_periodo, estado, fecha_pago
              FROM pagos
             WHERE id_socio = ?
               AND YEAR(fecha_pago) = ?
             ORDER BY fecha_pago DESC, id_pago DESC
        ");
        $stmtPagos->execute([$idSocio, $anio]);
    }

    $rows = $stmtPagos->fetchAll(PDO::FETCH_ASSOC);

    // Mapa: id_periodo => estado ('pagado' | 'condonado')
    $estadosPorPeriodo = [];
    $estadoAnual = null;

    foreach ($rows as $r) {
        $pid = (int)($r['id_periodo'] ?? 0);
        if ($pid <= 0) continue;

        $estado = strtolower(trim((string)($r['estado'] ?? '')));
        if ($estado !== 'condonado' && $estado !== 'pagado') {
            $estado = 'pagado';
        }

        // Quedarnos con el más reciente por período (por el ORDER BY DESC)
        if (!isset($estadosPorPeriodo[$pid])) {
            $estadosPorPeriodo[$pid] = $estado;
        }

        if ($pid === ID_CONTADO_ANUAL && $estadoAnual === null) {
            $estadoAnual = $estado;
        }
    }

    // Si ese año tiene Contado Anual, propagamos su estado a 1..6 si no existen
    if ($estadoAnual !== null) {
        for ($m = 1; $m <= 6; $m++) {
            if (!isset($estadosPorPeriodo[$m])) {
                $estadosPorPeriodo[$m] = $estadoAnual;
            }
        }
    }

    // IDs únicos ordenados (compat con frontend)
    $periodosIds = array_map('intval', array_keys($estadosPorPeriodo));
    sort($periodosIds);

    // =========================
    // 2) DATOS DEL SOCIO (ingreso)
    // =========================
    $stmtIngreso = $pdo->prepare("SELECT ingreso FROM socios WHERE id_socio = ? LIMIT 1");
    $stmtIngreso->execute([$idSocio]);
    $socio = $stmtIngreso->fetch(PDO::FETCH_ASSOC);

    if (!$socio) {
        echo json_encode(['exito' => false, 'mensaje' => 'Socio no encontrado']);
        exit;
    }

    // =========================
    // 3) INSCRIPCIÓN (se paga una sola vez, SIN filtrar por año)
    // =========================
    $inscripcionPagada = false;
    $inscripcion = null;

    // Si la tabla no existe, no rompemos el endpoint
    try {
        $stmtIns = $pdo->prepare("
            SELECT monto, fecha_pago, id_medio_pago
              FROM pagos_inscripcion
             WHERE id_socio = ?
             ORDER BY fecha_pago DESC, id_inscripcion DESC
             LIMIT 1
        ");
        $stmtIns->execute([$idSocio]);
        $ins = $stmtIns->fetch(PDO::FETCH_ASSOC);

        if ($ins) {
            $inscripcionPagada = true;
            $inscripcion = [
                'monto' => (int)($ins['monto'] ?? 0),
                'fecha_pago' => $ins['fecha_pago'] ?? null,
                'id_medio_pago' => isset($ins['id_medio_pago']) ? (int)$ins['id_medio_pago'] : null,
            ];
        }
    } catch (Exception $e) {
        // tabla no existe o error menor -> no cortamos
        $inscripcionPagada = false;
        $inscripcion = null;
    }

    echo json_encode([
        'exito'               => true,
        'anio'                => $anio,

        // CUOTAS
        'periodos_pagados'    => $periodosIds,
        'estados_por_periodo' => $estadosPorPeriodo,
        'ingreso'             => $socio['ingreso'],

        // INSCRIPCIÓN
        'inscripcion_pagada'  => $inscripcionPagada,
        'inscripcion'         => $inscripcion
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error en la base de datos'], JSON_UNESCAPED_UNICODE);
}