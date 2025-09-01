<?php
// modules/cuotas/estado_periodo_socio.php

require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: http://localhost:3000");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
    exit;
}

/**
 * Parámetros:
 * - id_socio   (int)  obligatorio
 * - id_periodo (int)  obligatorio
 * - anio       (int)  opcional (YYYY)
 * - codigo     (str)  opcional (P+AA+ID, ej 1251393 → P=1, AA=25, ID=1393)
 */
$id_socio   = isset($_GET['id_socio'])   ? (int)$_GET['id_socio']   : 0;
$id_periodo = isset($_GET['id_periodo']) ? (int)$_GET['id_periodo'] : 0;
$anio       = isset($_GET['anio'])       ? (int)$_GET['anio']       : 0;
$codigo     = isset($_GET['codigo'])     ? preg_replace('/\D/', '', $_GET['codigo']) : '';

if ($id_socio <= 0 || $id_periodo <= 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'Parámetros inválidos']);
    exit;
}

// Si no llega el año, intentar inferirlo desde "codigo" (P + AA + ID)
if ($anio <= 0 && $codigo !== '' && strlen($codigo) >= 3) {
    $aa   = substr($codigo, 1, 2);
    $anio = 2000 + (int)$aa; // 25 => 2025, etc.
}
if ($anio <= 0) {
    $anio = (int)date('Y');
}

try {
    // Buscar registro del PERÍODO puntual en ese AÑO
    $sql = "SELECT estado
              FROM pagos
             WHERE id_socio = ?
               AND id_periodo = ?
               AND YEAR(fecha_pago) = ?
             /* AND anulado = 0 */
             LIMIT 1";
    $st = $pdo->prepare($sql);
    $st->execute([$id_socio, $id_periodo, $anio]);
    $row = $st->fetch(PDO::FETCH_ASSOC);

    if ($row && !empty($row['estado'])) {
        $estado = strtolower($row['estado']) === 'condonado' ? 'condonado' : 'pagado';
        echo json_encode(['exito' => true, 'estado' => $estado, 'anio' => $anio]);
        exit;
    }

    // Si no hay registro puntual, verificar si existe CONTADO ANUAL (7) en el mismo AÑO
    $sqlAnual = "SELECT estado
                   FROM pagos
                  WHERE id_socio = ?
                    AND id_periodo = 7
                    AND YEAR(fecha_pago) = ?
                  /* AND anulado = 0 */
                  LIMIT 1";
    $st2 = $pdo->prepare($sqlAnual);
    $st2->execute([$id_socio, $anio]);
    $rowAnual = $st2->fetch(PDO::FETCH_ASSOC);

    if ($rowAnual && !empty($rowAnual['estado'])) {
        $estado = strtolower($rowAnual['estado']) === 'condonado' ? 'condonado' : 'pagado';
        echo json_encode([
            'exito'  => true,
            'estado' => $estado,
            'anio'   => $anio,
            'origen' => 'anual'
        ]);
        exit;
    }

    echo json_encode(['exito' => true, 'estado' => 'pendiente', 'anio' => $anio]);
} catch (Throwable $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error al consultar estado']);
}
