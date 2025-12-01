<?php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');
// 🔴 Evitar cache del lado del cliente/proxy/CDN
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $listas = [
        'categorias'       => [],
        'cobradores'       => [],
        'estados'          => [],
        'periodos'         => [],
        'categorias_monto' => [],
        'medios_pago'      => [],   // 👈 NUEVA LISTA
    ];

    /* ===== Categorías (id + descripción) ===== */
    $stmt = $pdo->query("SELECT id_categoria, descripcion FROM categoria ORDER BY descripcion");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $listas['categorias'][] = [
            'id'          => (int)$row['id_categoria'],
            'descripcion' => $row['descripcion'],
        ];
    }

    /* ===== Cobradores ===== */
    $stmt = $pdo->query("SELECT id_cobrador, nombre FROM cobrador ORDER BY nombre");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $listas['cobradores'][] = [
            'id'     => (int)$row['id_cobrador'],
            'nombre' => $row['nombre'],
        ];
    }

    /* ===== Estados ===== */
    $stmt = $pdo->query("SELECT id_estado, descripcion FROM estado ORDER BY descripcion");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $listas['estados'][] = [
            'id'          => (int)$row['id_estado'],
            'descripcion' => $row['descripcion'],
        ];
    }

    /* ===== Períodos ===== */
    $stmt = $pdo->query("SELECT id_periodo, nombre FROM periodo ORDER BY id_periodo ASC");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $listas['periodos'][] = [
            'id'     => (int)$row['id_periodo'],
            'nombre' => $row['nombre'],
        ];
    }

    /* ===== Categoria + monto mensual solamente ===== */
    $stmt = $pdo->query("
        SELECT id_cat_monto, nombre_categoria, monto_mensual
        FROM categoria_monto
        ORDER BY nombre_categoria ASC
    ");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $listas['categorias_monto'][] = [
            'id_cat_monto'     => (int)$row['id_cat_monto'],
            'nombre_categoria' => $row['nombre_categoria'],
            'monto_mensual'    => (int)$row['monto_mensual'],
        ];
    }

    /* ===== Medios de pago (TRANSFERENCIA / EFECTIVO) ===== */
    $stmt = $pdo->query("SELECT id_medio_pago, nombre FROM medios_pago ORDER BY nombre");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $listas['medios_pago'][] = [
            'id'     => (int)$row['id_medio_pago'],
            'nombre' => $row['nombre'],
        ];
    }

    echo json_encode([
        'exito'  => true,
        'listas' => $listas,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error en la base de datos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
