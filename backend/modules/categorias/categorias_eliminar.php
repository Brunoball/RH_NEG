<?php
require_once(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $id = $input['idCategoria'] ?? $input['id_cat_monto'] ?? null;

    if (!is_numeric($id)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'mensaje' => 'ID inválido.']);
        exit;
    }

    $st = $pdo->prepare("DELETE FROM rh_neg.categoria_monto WHERE id_cat_monto = :id");
    $st->execute([':id' => $id]);

    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'mensaje' => 'Error al eliminar categoría', 'error' => $e->getMessage()]);
}
