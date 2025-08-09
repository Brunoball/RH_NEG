<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

// CORS (ajusta si corresponde)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    $id     = isset($data['id_socio']) ? (int)$data['id_socio'] : 0;
    $motivo = isset($data['motivo']) ? trim((string)$data['motivo']) : '';

    if ($id <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID de socio no proporcionado o inválido']);
        exit;
    }

    if ($motivo === '') {
        echo json_encode(['exito' => false, 'mensaje' => 'Debés ingresar un motivo para dar de baja']);
        exit;
    }

    // Convertir a mayúsculas antes de guardar
    $motivo = mb_strtoupper($motivo, 'UTF-8');

    // Marcar inactivo, guardar motivo y registrar fecha de baja en 'ingreso' (hoy)
    $sql = "UPDATE socios
            SET activo = 0,
                motivo = :motivo,
                ingreso = CURDATE()
            WHERE id_socio = :id";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':motivo' => $motivo,
        ':id'     => $id
    ]);

    echo json_encode(['exito' => true, 'mensaje' => 'Socio dado de baja correctamente']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error al dar de baja: ' . $e->getMessage()]);
}
