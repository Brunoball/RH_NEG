<?php
// backend/modules/socios/obtener_socios.php

require_once(__DIR__ . '/../../config/db.php'); // conexión PDO

try {
    $stmt = $pdo->query("SELECT * FROM socios ORDER BY id_socio ASC");
    $socios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'exito' => true,
        'socios' => $socios
    ]);
} catch (PDOException $e) {
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al obtener los socios: ' . $e->getMessage()
    ]);
}
