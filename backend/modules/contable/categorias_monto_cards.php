<?php
// backend/modules/contable/categorias_monto_cards.php
//
// Devuelve SOLO:
//   - nombre_categoria
//   - monto_mensual
//   - monto_mensual_fmt

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../../config/db.php'; // $pdo

    // Solo los campos necesarios
    $sql = "
        SELECT 
            nombre_categoria,
            monto_mensual
        FROM categoria_monto
        ORDER BY id_cat_monto ASC
    ";

    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $categorias = [];

    foreach ($rows as $row) {
        $nombre  = trim((string)$row['nombre_categoria']);
        $mensual = (int)$row['monto_mensual'];

        // Formato amigable
        $fmtMensual = number_format($mensual, 0, ',', '.');

        $categorias[] = [
            'nombre_categoria'  => $nombre,
            'monto_mensual'     => $mensual,
            'monto_mensual_fmt' => '$ ' . $fmtMensual
        ];
    }

    echo json_encode([
        'exito'      => true,
        'categorias' => $categorias,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
