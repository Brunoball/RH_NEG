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
/* Nuevo: año a consultar. Si no llega, usamos el año actual */
$anio    = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)date('Y');

if ($idSocio <= 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID de socio no proporcionado']);
    exit;
}

const ID_CONTADO_ANUAL = 7;

try {
    // Pagos/condonaciones SOLO del año solicitado
    $stmtPagos = $pdo->prepare("
        SELECT id_periodo, estado, fecha_pago
          FROM pagos
         WHERE id_socio = ?
           AND YEAR(fecha_pago) = ?
    ");
    $stmtPagos->execute([$idSocio, $anio]);
    $rows = $stmtPagos->fetchAll(PDO::FETCH_ASSOC);

    $periodos = [];
    $tieneAnual = false;

    foreach ($rows as $r) {
        $pid = (int)$r['id_periodo'];
        if ($pid === ID_CONTADO_ANUAL) {
            $tieneAnual = true;
        }
        // Guardamos todos los períodos del año (pagado o condonado)
        $periodos[] = $pid;
    }

    // Si en ese año está pago/condonado el ANUAL, marcamos 1..6 también
    if ($tieneAnual) {
        $periodos = array_merge($periodos, [1,2,3,4,5,6]);
    }

    // Dejar únicos y ordenados
    $periodos = array_values(array_unique(array_map('intval', $periodos)));
    sort($periodos);

    // Fecha de ingreso (para filtrar disponibles en el modal)
    $stmtIngreso = $pdo->prepare("SELECT ingreso FROM socios WHERE id_socio = ? LIMIT 1");
    $stmtIngreso->execute([$idSocio]);
    $socio = $stmtIngreso->fetch(PDO::FETCH_ASSOC);

    if (!$socio) {
        echo json_encode(['exito' => false, 'mensaje' => 'Socio no encontrado']);
        exit;
    }

    echo json_encode([
        'exito'            => true,
        'anio'             => $anio,
        'periodos_pagados' => $periodos, // incluye condonados y propagación del anual del MISMO año
        'ingreso'          => $socio['ingreso']
    ]);
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error en la base de datos']);
}
