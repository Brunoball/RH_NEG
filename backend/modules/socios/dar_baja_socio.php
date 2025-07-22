<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json');

// Leer datos recibidos
$data = json_decode(file_get_contents('php://input'), true);
$id = $data['id_socio'] ?? null;

// Validar ID
if (!$id) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID de socio no proporcionado']);
    exit;
}

try {
    // Marcar como inactivo (activo = 0)
    $stmt = $pdo->prepare('UPDATE socios SET activo = 0 WHERE id_socio = ?');
    $stmt->execute([$id]);

    echo json_encode(['exito' => true, 'mensaje' => 'Socio dado de baja correctamente']);
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error al dar de baja: ' . $e->getMessage()]);
}
