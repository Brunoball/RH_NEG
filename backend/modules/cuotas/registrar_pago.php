<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);

    $id_socio = $input['id_socio'] ?? null;
    $periodos = $input['periodos'] ?? [];

    if (!$id_socio || empty($periodos)) {
        echo json_encode(['exito' => false, 'mensaje' => 'Datos incompletos']);
        exit;
    }

    try {
        $pdo->beginTransaction();
        $fecha = date('Y-m-d');

        $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM pagos WHERE id_socio = ? AND id_periodo = ?");
        $insertStmt = $pdo->prepare("INSERT INTO pagos (id_socio, id_periodo, fecha_pago) VALUES (?, ?, ?)");

        foreach ($periodos as $id_periodo) {
            // Verificamos si ya existe
            $checkStmt->execute([$id_socio, $id_periodo]);
            if ($checkStmt->fetchColumn() > 0) {
                // Lo ignoramos si ya existe, NO cancelamos todo
                continue;
            }

            // Insertamos si no existe
            $insertStmt->execute([$id_socio, $id_periodo, $fecha]);
        }

        $pdo->commit();
        echo json_encode(['exito' => true, 'mensaje' => 'Pagos registrados correctamente']);
    } catch (PDOException $e) {
        $pdo->rollBack();
        echo json_encode(['exito' => false, 'mensaje' => 'Error al registrar pagos: ' . $e->getMessage()]);
    }
} else {
    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
}
