<?php
// backend/modules/socios/obtener_socios.php

require_once(__DIR__ . '/../../config/db.php'); // conexión PDO
header('Content-Type: application/json; charset=utf-8');

/**
 * Obtiene los socios por estado (activo 1 o 0),
 * incluyendo, si existe, el nombre de la familia (apellido/grupo) desde la tabla familias.
 */
function obtenerSociosPorEstado(PDO $pdo, int $estadoActivo) {
    // Notas:
    // - LEFT JOIN para incluir socios sin familia (id_familia NULL)
    // - Exponemos `familia` como el nombre_familia (apellido del grupo)
    $sql = "
        SELECT
            s.*,
            f.nombre_familia AS familia
        FROM socios s
        LEFT JOIN familias f
            ON f.id_familia = s.id_familia
        WHERE s.activo = :activo
        ORDER BY s.id_socio ASC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':activo' => $estadoActivo]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

try {
    // Si se recibe ?baja=1, obtenemos los socios dados de baja (activo = 0)
    $estado = (isset($_GET['baja']) && $_GET['baja'] == '1') ? 0 : 1;
    $socios = obtenerSociosPorEstado($pdo, $estado);

    echo json_encode([
        'exito' => true,
        'socios' => $socios
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Error al obtener los socios: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
