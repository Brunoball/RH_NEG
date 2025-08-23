<?php
// modules/cuotas/estado_periodo_socio.php

require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Validar método
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
    exit;
}

$id_socio   = isset($_GET['id_socio'])   ? (int)$_GET['id_socio']   : 0;
$id_periodo = isset($_GET['id_periodo']) ? (int)$_GET['id_periodo'] : 0;

if ($id_socio <= 0 || $id_periodo <= 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'Parámetros inválidos']);
    exit;
}

try {
    // Si tu tabla tiene una columna "anulado", descomenta la condición correspondiente
    $sql = "SELECT estado
              FROM pagos
             WHERE id_socio = ? AND id_periodo = ?
             /* AND anulado = 0 */
             LIMIT 1";

    $st  = $pdo->prepare($sql);
    $st->execute([$id_socio, $id_periodo]);
    $row = $st->fetch(PDO::FETCH_ASSOC);

    if ($row && !empty($row['estado'])) {
        // Valores esperados: 'pagado' o 'condonado'
        $estado = strtolower($row['estado']) === 'condonado' ? 'condonado' : 'pagado';
        echo json_encode(['exito' => true, 'estado' => $estado]);
        exit;
    }

    echo json_encode(['exito' => true, 'estado' => 'pendiente']);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error al consultar estado']);
}
