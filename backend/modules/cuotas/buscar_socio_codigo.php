<?php
require_once(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json');

$id_socio = $_GET['id_socio'] ?? '';
$id_periodo = $_GET['id_periodo'] ?? '';

if (!$id_socio || !$id_periodo) {
    echo json_encode([
        'exito' => false,
        'mensaje' => 'Faltan datos del código (socio o período)'
    ]);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT 
            s.id_socio,
            s.nombre,
            s.domicilio,
            s.telefono_movil AS telefono,
            cat.descripcion AS categoria
        FROM socios s
        JOIN categoria cat ON s.id_categoria = cat.id_categoria
        WHERE s.id_socio = :id_socio
          AND s.activo = 1
        LIMIT 1
    ");
    $stmt->bindParam(':id_socio', $id_socio, PDO::PARAM_INT);
    $stmt->execute();
    $socio = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($socio) {
        $socio['monto'] = 4000; // ✅ monto fijo desde el backend
        echo json_encode(['exito' => true, 'socio' => $socio]);
    } else {
        echo json_encode(['exito' => false, 'mensaje' => 'No se encontró ningún socio activo con ese ID']);
    }
} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error SQL: ' . $e->getMessage()]);
}
