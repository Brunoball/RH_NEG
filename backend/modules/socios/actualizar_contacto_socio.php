<?php
// backend/modules/socios/actualizar_contacto_socio.php

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

function leerEntrada(): array
{
    $raw = file_get_contents('php://input');

    if ($raw) {
        $json = json_decode($raw, true);
        if (is_array($json)) {
            return $json;
        }
    }

    return $_POST ?: [];
}

function normalizarFechaContacto(?string $fecha): ?string
{
    $fecha = trim((string)$fecha);

    if ($fecha === '') {
        return null;
    }

    $formatos = ['Y-m-d', 'Y-m-d H:i:s'];

    foreach ($formatos as $formato) {
        $dt = DateTime::createFromFormat($formato, $fecha);
        if ($dt instanceof DateTime) {
            return $dt->format('Y-m-d');
        }
    }

    return null;
}

function aMayusculas(?string $texto): string
{
    return mb_strtoupper(trim((string)$texto), 'UTF-8');
}

function normalizarEstadoContacto(?string $estado): string
{
    $estado = aMayusculas((string)$estado);

    if ($estado === 'VOLVER_A_LLAMAR') {
        return 'PENDIENTE';
    }

    if ($estado === 'TELEFONO_INVALIDO') {
        return 'NO_CONTACTADO';
    }

    if ($estado === 'CONTACTADO' || $estado === 'PENDIENTE' || $estado === 'NO_CONTACTADO') {
        return $estado;
    }

    if ($estado === '' || $estado === 'SIN_GESTION') {
        return 'SIN_GESTION';
    }

    return $estado;
}

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $data = leerEntrada();

    $idSocio = (int)($data['id_socio'] ?? 0);

    $fechaInput = (string)($data['ultimo_contacto_fecha'] ?? '');
    $estado     = normalizarEstadoContacto((string)($data['ultimo_contacto_estado'] ?? ''));
    $detalle    = aMayusculas((string)($data['ultimo_contacto'] ?? ''));

    if ($fechaInput === '' && isset($data['fecha_contacto'])) {
        $fechaInput = (string)$data['fecha_contacto'];
    }
    if ($estado === '' && isset($data['estado_contacto'])) {
        $estado = normalizarEstadoContacto((string)$data['estado_contacto']);
    }
    if ($detalle === '' && isset($data['detalle_contacto'])) {
        $detalle = aMayusculas((string)$data['detalle_contacto']);
    }

    if ($idSocio <= 0) {
        responder(422, [
            'exito' => false,
            'mensaje' => 'El id_socio es obligatorio.',
        ]);
    }

    $fechaContacto = normalizarFechaContacto($fechaInput);
    if ($fechaContacto === null) {
        responder(422, [
            'exito' => false,
            'mensaje' => 'La fecha del contacto no es válida.',
        ]);
    }

    $estadosPermitidos = [
        'CONTACTADO',
        'PENDIENTE',
        'NO_CONTACTADO',
        'SIN_GESTION',
    ];

    if (!in_array($estado, $estadosPermitidos, true)) {
        responder(422, [
            'exito' => false,
            'mensaje' => 'El estado del contacto no es válido.',
        ]);
    }

    $stmtExiste = $pdo->prepare("
        SELECT id_socio, nombre
        FROM socios
        WHERE id_socio = :id_socio
        LIMIT 1
    ");
    $stmtExiste->execute([':id_socio' => $idSocio]);
    $socioBase = $stmtExiste->fetch(PDO::FETCH_ASSOC);

    if (!$socioBase) {
        responder(404, [
            'exito' => false,
            'mensaje' => 'El socio indicado no existe.',
        ]);
    }

    $pdo->beginTransaction();

    $stmtInsert = $pdo->prepare("
        INSERT INTO socios_contactos (
            id_socio,
            fecha_contacto,
            estado_contacto,
            detalle_contacto
        ) VALUES (
            :id_socio,
            :fecha_contacto,
            :estado_contacto,
            :detalle_contacto
        )
    ");

    $stmtInsert->execute([
        ':id_socio'         => $idSocio,
        ':fecha_contacto'   => $fechaContacto,
        ':estado_contacto'  => $estado,
        ':detalle_contacto' => ($detalle !== '' ? $detalle : null),
    ]);

    $idUltimoContacto = (int)$pdo->lastInsertId();

    $stmtUpdateSocio = $pdo->prepare("
        UPDATE socios
        SET id_ultimo_contacto = :id_ultimo_contacto
        WHERE id_socio = :id_socio
        LIMIT 1
    ");

    $stmtUpdateSocio->execute([
        ':id_ultimo_contacto' => $idUltimoContacto,
        ':id_socio'           => $idSocio,
    ]);

    $pdo->commit();

    $stmtOut = $pdo->prepare("
        SELECT
            s.id_socio,
            s.nombre,
            s.id_ultimo_contacto,
            sc.id_contacto,
            sc.detalle_contacto AS ultimo_contacto,
            sc.fecha_contacto AS ultimo_contacto_fecha,
            sc.estado_contacto AS ultimo_contacto_estado,
            sc.fecha_contacto
        FROM socios s
        LEFT JOIN socios_contactos sc
            ON sc.id_contacto = s.id_ultimo_contacto
        WHERE s.id_socio = :id_socio
        LIMIT 1
    ");
    $stmtOut->execute([':id_socio' => $idSocio]);
    $socio = $stmtOut->fetch(PDO::FETCH_ASSOC);

    $stmtContacto = $pdo->prepare("
        SELECT
            id_contacto,
            id_socio,
            fecha_contacto,
            estado_contacto,
            detalle_contacto,
            created_at
        FROM socios_contactos
        WHERE id_contacto = :id_contacto
        LIMIT 1
    ");
    $stmtContacto->execute([':id_contacto' => $idUltimoContacto]);
    $contacto = $stmtContacto->fetch(PDO::FETCH_ASSOC);

    responder(200, [
        'exito' => true,
        'mensaje' => 'Contacto registrado correctamente.',
        'socio' => $socio,
        'contacto' => $contacto,
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    responder(500, [
        'exito' => false,
        'mensaje' => 'Error al guardar el contacto: ' . $e->getMessage(),
    ]);
}
