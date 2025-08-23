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

if ($idSocio <= 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID de socio no proporcionado']);
    exit;
}

try {
    // Todos los períodos ya registrados (pagados o condonados)
    $stmtPagos = $pdo->prepare("SELECT id_periodo FROM pagos WHERE id_socio = ?");
    $stmtPagos->execute([$idSocio]);
    $periodos = array_map('intval', $stmtPagos->fetchAll(PDO::FETCH_COLUMN));

    // Fecha de ingreso
    $stmtIngreso = $pdo->prepare("SELECT ingreso FROM socios WHERE id_socio = ? LIMIT 1");
    $stmtIngreso->execute([$idSocio]);
    $socio = $stmtIngreso->fetch(PDO::FETCH_ASSOC);

    if (!$socio) {
        echo json_encode(['exito' => false, 'mensaje' => 'Socio no encontrado']);
        exit;
    }

    echo json_encode([
        'exito' => true,
        'periodos_pagados' => $periodos, // incluye condonados también
        'ingreso' => $socio['ingreso']
    ]);
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error en la base de datos']);
}
