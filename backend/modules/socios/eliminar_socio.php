<?php
// CORS específico del módulo
header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../config/db.php';

try {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!isset($data['id_socio']) || !is_numeric($data['id_socio'])) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID inválido']);
        exit;
    }

    $id = intval($data['id_socio']);
    $stmt = $pdo->prepare("DELETE FROM socios WHERE id_socio = ?");
    $stmt->execute([$id]);

    echo json_encode(['exito' => true, 'mensaje' => 'Socio eliminado correctamente']);
} catch (Exception $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()]);
}
