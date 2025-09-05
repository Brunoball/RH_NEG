<?php
// modules/socios/next_id_socio.php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

try {
    // Último ID cargado + 1 (independiente del AUTO_INCREMENT)
    $sql = "SELECT COALESCE(MAX(id_socio), 0) + 1 AS next_id FROM socios";
    $stmt = $pdo->query($sql);
    $row  = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row && isset($row['next_id'])) {
        echo json_encode(['exito' => true, 'next_id' => (int)$row['next_id']]);
    } else {
        echo json_encode(['exito' => false, 'mensaje' => 'No se pudo calcular el próximo ID']);
    }
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => $e->getMessage()]);
}
