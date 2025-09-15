<?php
require_once(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

try {
    $sql = "SELECT
                id_cat_monto     AS idCategoria,
                nombre_categoria AS nombre,
                monto_mensual    AS montoMensual,
                monto_anual      AS montoAnual,
                fecha_creacion
            FROM categoria_monto
            ORDER BY nombre_categoria ASC";
    $st = $pdo->query($sql);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['ok' => true, 'categorias' => $rows], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'mensaje' => 'No se pudieron listar las categorías',
        // Descomenta esta línea si querés ver el error exacto en debug:
        // 'error' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
