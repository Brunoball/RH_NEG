<?php
require_once(__DIR__ . '/../../config/db.php');

header('Content-Type: application/json');

try {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id_socio'] ?? null;

    if (!$id) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado']);
        exit;
    }

    $stmt = $pdo->prepare("UPDATE socios SET activo = 1 WHERE id_socio = ?");
    $stmt->execute([$id]);

    echo json_encode(['exito' => true]);
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()]);
}
