<?php
// backend/modules/socios/dar_baja_socio.php

require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function normalizarFechaBaja(?string $fecha): ?string
{
    $fecha = trim((string)$fecha);

    if ($fecha === '') {
        return date('Y-m-d');
    }

    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        $dt = DateTime::createFromFormat('Y-m-d', $fecha);
        $err = DateTime::getLastErrors();

        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) {
            return $dt->format('Y-m-d');
        }
    }

    if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $fecha)) {
        $dt = DateTime::createFromFormat('d/m/Y', $fecha);
        $err = DateTime::getLastErrors();

        if ($dt && empty($err['warning_count']) && empty($err['error_count'])) {
            return $dt->format('Y-m-d');
        }
    }

    return null;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        $data = $_POST;
    }

    $id = isset($data['id_socio']) ? (int)$data['id_socio'] : 0;
    $motivo = isset($data['motivo']) ? trim((string)$data['motivo']) : '';
    $fechaBaja = normalizarFechaBaja(isset($data['fecha_baja']) ? (string)$data['fecha_baja'] : null);

    if ($id <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'ID de socio no proporcionado o inválido'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($motivo === '') {
        echo json_encode(['exito' => false, 'mensaje' => 'Debés ingresar un motivo para dar de baja'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($fechaBaja === null) {
        echo json_encode(['exito' => false, 'mensaje' => 'Fecha de baja inválida'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $motivo = mb_strtoupper($motivo, 'UTF-8');

    /*
        IMPORTANTE:
        - ingreso queda como fecha de ingreso / reingreso.
        - fecha_baja guarda la fecha real de baja.
        - ya no se pisa ingreso al dar de baja.
    */
    $sql = "UPDATE socios
            SET activo = 0,
                motivo = :motivo,
                fecha_baja = :fecha_baja
            WHERE id_socio = :id";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':motivo' => $motivo,
        ':fecha_baja' => $fechaBaja,
        ':id' => $id,
    ]);

    if ($stmt->rowCount() === 0) {
        $chk = $pdo->prepare("SELECT id_socio FROM socios WHERE id_socio = :id LIMIT 1");
        $chk->execute([':id' => $id]);

        if (!$chk->fetch(PDO::FETCH_ASSOC)) {
            http_response_code(404);
            echo json_encode(['exito' => false, 'mensaje' => 'El socio no existe'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    echo json_encode([
        'exito' => true,
        'mensaje' => 'Socio dado de baja correctamente',
        'fecha_baja' => $fechaBaja,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error al dar de baja: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
