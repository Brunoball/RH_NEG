<?php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $listas = [
        'categorias'       => [],
        'cobradores'       => [],
        'estados'          => [],
        'periodos'         => [],
        // NUEVO: categorías con montos (mensual y anual)
        'categorias_monto' => [],
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

    /* ===== NUEVO: Categoria + montos (mensual y anual) ===== */
    $stmt = $pdo->query("
        SELECT id_cat_monto, nombre_categoria, monto_mensual, monto_anual
        FROM categoria_monto
        ORDER BY nombre_categoria ASC
    ");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $listas['categorias_monto'][] = [
            'id_cat_monto'     => (int)$row['id_cat_monto'],
            'nombre_categoria' => $row['nombre_categoria'],
            'monto_mensual'    => (int)$row['monto_mensual'],
            'monto_anual'      => (int)$row['monto_anual'],
        ];
    }

    echo json_encode([
        'exito'  => true,
        'listas' => $listas,
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error en la base de datos: ' . $e->getMessage(),
    ]);
}
