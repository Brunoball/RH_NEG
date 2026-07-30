<?php
// backend/modules/socios/balance_anual/balance_anual_medios_pago.php

// Devuelve los medios de pago reales desde la tabla `medios_pago`.
// Estructura esperada: id_medio_pago, nombre.

declare(strict_types=1);

if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
}

function balance_medios_responder(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function balance_medios_pdo(): PDO
{
    if (function_exists('db')) {
        $pdo = db();
        if ($pdo instanceof PDO) {
            return $pdo;
        }
    }

    if (function_exists('getConnection')) {
        $pdo = getConnection();
        if ($pdo instanceof PDO) {
            return $pdo;
        }
    }

    global $pdo, $conn;

    if (isset($pdo) && $pdo instanceof PDO) {
        return $pdo;
    }

    if (isset($conn) && $conn instanceof PDO) {
        return $conn;
    }

    throw new RuntimeException('No se pudo obtener la conexión PDO.');
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        balance_medios_responder([
            'exito' => false,
            'ok' => false,
            'mensaje' => 'Método no permitido.',
        ], 405);
    }

    $pdo = balance_medios_pdo();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $pdo->query("\n        SELECT id_medio_pago, nombre\n        FROM medios_pago\n        ORDER BY nombre ASC\n    ");

    $medios = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $id = (int) ($row['id_medio_pago'] ?? 0);
        $nombre = trim((string) ($row['nombre'] ?? ''));

        if ($id <= 0 || $nombre === '') {
            continue;
        }

        $medios[] = [
            'id_medio_pago' => $id,
            'id' => $id,
            'nombre' => $nombre,
            'descripcion' => $nombre,
        ];
    }

    balance_medios_responder([
        'exito' => true,
        'ok' => true,
        'medios_pago' => $medios,
    ]);
} catch (Throwable $e) {
    error_log('[BALANCE MEDIOS PAGO] ' . $e->getMessage());

    balance_medios_responder([
        'exito' => false,
        'ok' => false,
        'mensaje' => 'Error al obtener los medios de pago: ' . $e->getMessage(),
    ], 500);
}
