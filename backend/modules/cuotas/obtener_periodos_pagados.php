<?php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

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
    // =========================
    // 1) PAGOS DE CUOTAS (por año)
    // =========================
    $stmtPagos = $pdo->prepare("
        SELECT id_periodo, estado, fecha_pago
          FROM pagos
         WHERE id_socio = ?
           AND YEAR(fecha_pago) = ?
         ORDER BY fecha_pago DESC, id_pago DESC
    ");
    $stmtPagos->execute([$idSocio, $anio]);
    $rows = $stmtPagos->fetchAll(PDO::FETCH_ASSOC);

    // Mapa: id_periodo => estado ('pagado' | 'condonado')
    $estadosPorPeriodo = [];
    $estadoAnual = null;

    foreach ($rows as $r) {
        $pid = (int)$r['id_periodo'];
        $estado = strtolower(trim($r['estado'] ?? ''));
        if (!isset($estadosPorPeriodo[$pid])) {
            $estadosPorPeriodo[$pid] = $estado ?: 'pagado';
        }
        if ($pid === ID_CONTADO_ANUAL && $estadoAnual === null) {
            $estadoAnual = $estado ?: 'pagado';
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

    // IDs únicos ordenados (por compatibilidad con el frontend viejo)
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
    $stmtIns = $pdo->prepare("
        SELECT monto, fecha_pago, id_medio_pago
          FROM pagos_inscripcion
         WHERE id_socio = ?
         ORDER BY fecha_pago DESC, id_inscripcion DESC
         LIMIT 1
    ");
    $stmtIns->execute([$idSocio]);
    $ins = $stmtIns->fetch(PDO::FETCH_ASSOC);

    $inscripcionPagada = $ins ? true : false;
    $inscripcion = null;

    if ($ins) {
        $inscripcion = [
            'monto' => (int)$ins['monto'],
            'fecha_pago' => $ins['fecha_pago'],
            'id_medio_pago' => isset($ins['id_medio_pago']) ? (int)$ins['id_medio_pago'] : null,
        ];
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
    ]);
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error en la base de datos']);
}
