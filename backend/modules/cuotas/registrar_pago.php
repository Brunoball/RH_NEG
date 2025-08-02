<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json');

function convertirMesesAPeriodo($mesCodigo) {
    // Convertimos el string (ej: "34") en número
    $meses = str_split($mesCodigo, 1);
    $id_periodo = null;

    foreach ($meses as $mes) {
        $mes = (int)$mes;
        if ($mes >= 1 && $mes <= 2) {
            $id_periodo = 1;
        } elseif ($mes >= 3 && $mes <= 4) {
            $id_periodo = 2;
        } elseif ($mes >= 5 && $mes <= 6) {
            $id_periodo = 3;
        } elseif ($mes >= 7 && $mes <= 8) {
            $id_periodo = 4;
        } elseif ($mes >= 9 && $mes <= 10) {
            $id_periodo = 5;
        } elseif ($mes >= 11 && $mes <= 12) {
            $id_periodo = 6;
        }
    }

    return $id_periodo;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);

    $id_socio = $input['id_socio'] ?? null;
    $periodosRaw = $input['periodos'] ?? [];

    if (!$id_socio || empty($periodosRaw)) {
        echo json_encode(['exito' => false, 'mensaje' => 'Datos incompletos']);
        exit;
    }

    try {
        $pdo->beginTransaction();
        $fecha = date('Y-m-d');

        $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM pagos WHERE id_socio = ? AND id_periodo = ?");
        $insertStmt = $pdo->prepare("INSERT INTO pagos (id_socio, id_periodo, fecha_pago) VALUES (?, ?, ?)");

        foreach ($periodosRaw as $codigoPeriodo) {
            // Traducir el código (ej: 34) al id_periodo real
            $id_periodo = convertirMesesAPeriodo($codigoPeriodo);

            if (!$id_periodo) {
                $pdo->rollBack();
                echo json_encode(['exito' => false, 'mensaje' => "⛔ Período inválido: $codigoPeriodo"]);
                exit;
            }

            // Verificar duplicado
            $checkStmt->execute([$id_socio, $id_periodo]);
            if ($checkStmt->fetchColumn() > 0) {
                $pdo->rollBack();
                echo json_encode([
                    'exito' => false,
                    'mensaje' => "⚠️ El pago del período $id_periodo ya fue registrado anteriormente."
                ]);
                exit;
            }

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
