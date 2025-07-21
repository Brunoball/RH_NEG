<?php
require_once __DIR__ . '/../../config/db.php';


try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $listas = [
        'categorias' => [],
        'cobradores' => [],
        'estados' => [],
        'periodos' => []
    ];

    $stmt = $pdo->query("SELECT id_categoria, descripcion FROM rh_neg.categoria ORDER BY descripcion");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $listas['categorias'][] = [
            'id' => $row['id_categoria'],
            'descripcion' => $row['descripcion']
        ];
    }

    $stmt = $pdo->query("SELECT id_cobrador, nombre FROM rh_neg.cobrador ORDER BY nombre");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $listas['cobradores'][] = [
            'id' => $row['id_cobrador'],
            'nombre' => $row['nombre']
        ];
    }

    $stmt = $pdo->query("SELECT id_estado, descripcion FROM rh_neg.estado ORDER BY descripcion");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $listas['estados'][] = [
            'id' => $row['id_estado'],
            'descripcion' => $row['descripcion']
        ];
    }

    $stmt = $pdo->query("SELECT id_periodo_adeudado, descripcion FROM rh_neg.periodo ORDER BY id_periodo_adeudado DESC");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $listas['periodos'][] = [
            'id' => $row['id_periodo_adeudado'],
            'descripcion' => $row['descripcion']
        ];
    }

    echo json_encode([
        'exito' => true,
        'listas' => $listas
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error en la base de datos: ' . $e->getMessage()
    ]);
}
