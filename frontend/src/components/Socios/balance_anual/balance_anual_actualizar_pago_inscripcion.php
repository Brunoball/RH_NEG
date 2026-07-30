<?php
// backend/modules/socios/balance_anual/balance_anual_actualizar_pago_inscripcion.php

declare(strict_types=1);

function balance_pago_insc_responder(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function balance_pago_insc_pdo(): PDO
{
    global $pdo;

    if (!isset($pdo) || !$pdo instanceof PDO) {
        throw new RuntimeException('No hay conexión PDO disponible.');
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    return $pdo;
}

function balance_pago_insc_body(): array
{
    $raw = file_get_contents('php://input');
    $json = json_decode($raw ?: '', true);

    if (is_array($json)) {
        return $json;
    }

    return $_POST;
}

function balance_pago_insc_validar_fecha(?string $fecha): ?string
{
    $fecha = trim((string) $fecha);
    if ($fecha === '') {
        return null;
    }

    $dt = DateTime::createFromFormat('Y-m-d', $fecha);
    $errors = DateTime::getLastErrors();

    if (!$dt || ($errors !== false && (($errors['warning_count'] ?? 0) > 0 || ($errors['error_count'] ?? 0) > 0))) {
        return null;
    }

    return $dt->format('Y-m-d');
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        balance_pago_insc_responder([
            'exito' => false,
            'ok' => false,
            'mensaje' => 'Método no permitido.',
        ], 405);
    }

    $pdo = balance_pago_insc_pdo();
    $body = balance_pago_insc_body();

    $idSocio = isset($body['id_socio']) ? (int) $body['id_socio'] : 0;
    $idInscripcion = isset($body['id_inscripcion']) && $body['id_inscripcion'] !== null && $body['id_inscripcion'] !== ''
        ? (int) $body['id_inscripcion']
        : 0;
    $idMedioPago = isset($body['id_medio_pago']) && $body['id_medio_pago'] !== null && $body['id_medio_pago'] !== ''
        ? (int) $body['id_medio_pago']
        : null;
    $fechaPagoRaw = $body['fecha_pago'] ?? null;
    $fechaPago = balance_pago_insc_validar_fecha($fechaPagoRaw);
    $monto = isset($body['monto']) ? (float) $body['monto'] : 0.0;

    if ($idSocio <= 0) {
        balance_pago_insc_responder([
            'exito' => false,
            'ok' => false,
            'mensaje' => 'No se recibió un socio válido.',
        ], 422);
    }

    if ($idMedioPago !== null && $idMedioPago <= 0) {
        balance_pago_insc_responder([
            'exito' => false,
            'ok' => false,
            'mensaje' => 'Seleccioná un medio de pago válido.',
        ], 422);
    }

    if ($fechaPagoRaw !== null && trim((string) $fechaPagoRaw) !== '' && $fechaPago === null) {
        balance_pago_insc_responder([
            'exito' => false,
            'ok' => false,
            'mensaje' => 'Seleccioná una fecha de pago válida.',
        ], 422);
    }

    if ($idMedioPago !== null) {
        $stmtMedio = $pdo->prepare('SELECT id_medio_pago FROM medios_pago WHERE id_medio_pago = :id LIMIT 1');
        $stmtMedio->execute([':id' => $idMedioPago]);
        if (!$stmtMedio->fetchColumn()) {
            balance_pago_insc_responder([
                'exito' => false,
                'ok' => false,
                'mensaje' => 'El medio de pago seleccionado no existe.',
            ], 422);
        }
    }

    $pdo->beginTransaction();

    if ($idInscripcion <= 0) {
        $stmtBuscar = $pdo->prepare('SELECT id_inscripcion, monto FROM pagos_inscripcion WHERE id_socio = :id_socio ORDER BY id_inscripcion ASC LIMIT 1');
        $stmtBuscar->execute([':id_socio' => $idSocio]);
        $pagoExistente = $stmtBuscar->fetch(PDO::FETCH_ASSOC);

        if ($pagoExistente) {
            $idInscripcion = (int) $pagoExistente['id_inscripcion'];
            if ($monto <= 0) {
                $monto = (float) ($pagoExistente['monto'] ?? 0);
            }
        }
    }

    if ($idInscripcion > 0) {
        $stmtUpdate = $pdo->prepare("\n            UPDATE pagos_inscripcion\n               SET id_medio_pago = :id_medio_pago,\n                   fecha_pago = :fecha_pago\n             WHERE id_inscripcion = :id_inscripcion\n               AND id_socio = :id_socio\n        ");
        $stmtUpdate->execute([
            ':id_medio_pago' => $idMedioPago,
            ':fecha_pago' => $fechaPago,
            ':id_inscripcion' => $idInscripcion,
            ':id_socio' => $idSocio,
        ]);

        if ($stmtUpdate->rowCount() === 0) {
            $stmtExiste = $pdo->prepare('SELECT id_inscripcion FROM pagos_inscripcion WHERE id_inscripcion = :id AND id_socio = :id_socio LIMIT 1');
            $stmtExiste->execute([':id' => $idInscripcion, ':id_socio' => $idSocio]);
            if (!$stmtExiste->fetchColumn()) {
                throw new RuntimeException('No se encontró el pago de inscripción indicado.');
            }
        }
    } else {
        if ($monto < 0) {
            $monto = 0.0;
        }

        $stmtInsert = $pdo->prepare("\n            INSERT INTO pagos_inscripcion (id_socio, monto, fecha_pago, id_medio_pago)\n            VALUES (:id_socio, :monto, :fecha_pago, :id_medio_pago)\n        ");
        $stmtInsert->execute([
            ':id_socio' => $idSocio,
            ':monto' => $monto,
            ':fecha_pago' => $fechaPago,
            ':id_medio_pago' => $idMedioPago,
        ]);
        $idInscripcion = (int) $pdo->lastInsertId();
    }

    $pdo->commit();

    balance_pago_insc_responder([
        'exito' => true,
        'ok' => true,
        'mensaje' => 'Pago de inscripción actualizado correctamente.',
        'id_inscripcion' => $idInscripcion,
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('[BALANCE ACTUALIZAR PAGO INSCRIPCION] ' . $e->getMessage());

    balance_pago_insc_responder([
        'exito' => false,
        'ok' => false,
        'mensaje' => $e instanceof RuntimeException
            ? $e->getMessage()
            : 'Error interno al actualizar el pago de inscripción.',
    ], 500);
}
