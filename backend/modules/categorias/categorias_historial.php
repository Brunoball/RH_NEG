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

    // Trae historial ordenado del más reciente al más antiguo
    $st = $pdo->prepare(
        "SELECT id_historial, id_cat_monto, precio_viejo, precio_nuevo, fecha_cambio
           FROM rh_neg.precios_historicos
          WHERE id_cat_monto = :id
          ORDER BY fecha_cambio DESC, id_historial DESC"
    );
    $st->execute([':id' => $id]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['ok' => true, 'historial' => $rows], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'mensaje' => 'Error al obtener historial', 'error' => $e->getMessage()]);
}
