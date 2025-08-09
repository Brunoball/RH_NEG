<?php
require_once(__DIR__ . '/../../config/db.php');

header('Content-Type: application/json; charset=utf-8');

try {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = isset($data['id_socio']) ? (int)$data['id_socio'] : 0;

    if ($id <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID no proporcionado o inválido']);
        exit;
    }

    // Activo = 1, motivo a NULL y fecha de alta (hoy) en ingreso
    $sql = "UPDATE socios
            SET activo = 1,
                motivo = NULL,
                ingreso = CURDATE()
            WHERE id_socio = :id";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $id]);

    echo json_encode(['exito' => true, 'mensaje' => 'Socio dado de alta correctamente']);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()]);
}
