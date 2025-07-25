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

        // Preparar la consulta de verificación
        $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM pagos WHERE id_socio = ? AND id_periodo = ?");

        // Preparar la consulta de inserción
        $insertStmt = $pdo->prepare("INSERT INTO pagos (id_socio, id_periodo, fecha_pago) VALUES (?, ?, ?)");

        foreach ($periodos as $id_periodo) {
            // Verificar si ya existe el pago
            $checkStmt->execute([$id_socio, $id_periodo]);
            $yaExiste = $checkStmt->fetchColumn();

            if ($yaExiste > 0) {
                $pdo->rollBack();
                echo json_encode([
                    'exito' => false,
                    'mensaje' => "⚠️ El pago del período $id_periodo ya fue registrado anteriormente."
                ]);
                exit;
            }

            // Si no existe, lo insertamos
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
