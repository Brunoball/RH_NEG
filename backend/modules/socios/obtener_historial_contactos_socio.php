<?php
// backend/modules/socios/obtener_historial_contactos_socio.php

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

function responder(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $idSocio = (int)($_GET['id_socio'] ?? $_POST['id_socio'] ?? 0);

    if ($idSocio <= 0) {
        responder(422, [
            'exito' => false,
            'mensaje' => 'El id_socio es obligatorio.',
        ]);
    }

    $stmtSocio = $pdo->prepare("
        SELECT id_socio, nombre
        FROM socios
        WHERE id_socio = :id_socio
        LIMIT 1
    ");
    $stmtSocio->execute([':id_socio' => $idSocio]);
    $socio = $stmtSocio->fetch(PDO::FETCH_ASSOC);

    if (!$socio) {
        responder(404, [
            'exito' => false,
            'mensaje' => 'El socio indicado no existe.',
        ]);
    }

    $stmt = $pdo->prepare("
        SELECT
            id_contacto,
            id_socio,
            fecha_contacto,
            estado_contacto,
            detalle_contacto,
            created_at
        FROM socios_contactos
        WHERE id_socio = :id_socio
        ORDER BY fecha_contacto DESC, id_contacto DESC
    ");
    $stmt->execute([':id_socio' => $idSocio]);
    $historial = $stmt->fetchAll(PDO::FETCH_ASSOC);

    responder(200, [
        'exito' => true,
        'socio' => $socio,
        'historial' => $historial,
    ]);
} catch (Throwable $e) {
    responder(500, [
        'exito' => false,
        'mensaje' => 'Error al obtener el historial de contactos: ' . $e->getMessage(),
    ]);
}
