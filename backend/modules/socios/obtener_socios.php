<?php
// backend/modules/socios/obtener_socios.php

require_once(__DIR__ . '/../../config/db.php'); // conexión PDO
header('Content-Type: application/json');

// Función para obtener socios según estado activo
function obtenerSociosPorEstado($pdo, $estadoActivo) {
    $stmt = $pdo->prepare("SELECT * FROM socios WHERE activo = :activo ORDER BY id_socio ASC");
    $stmt->execute(['activo' => $estadoActivo]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

try {
    // Si se recibe ?baja=1, obtenemos los socios dados de baja (activo = 0)
    if (isset($_GET['baja']) && $_GET['baja'] == '1') {
        $socios = obtenerSociosPorEstado($pdo, 0);
    } else {
        // Por defecto, socios activos (activo = 1)
        $socios = obtenerSociosPorEstado($pdo, 1);
    }

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
