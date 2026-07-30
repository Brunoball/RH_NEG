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


function balance_pago_insc_asegurar_fecha_pago_nullable(PDO $pdo): void
{
    $stmt = $pdo->query("SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                           FROM INFORMATION_SCHEMA.COLUMNS
                          WHERE TABLE_SCHEMA = DATABASE()
                            AND TABLE_NAME = 'pagos_inscripcion'
                            AND COLUMN_NAME = 'fecha_pago'
                          LIMIT 1");
    $columna = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;

    if (!$columna) {
        return;
    }

    $columnType = trim((string) ($columna['COLUMN_TYPE'] ?? 'date'));
    if ($columnType === '') {
        $columnType = 'date';
    }

    $esNullable = strtoupper((string) ($columna['IS_NULLABLE'] ?? '')) === 'YES';
    $default = $columna['COLUMN_DEFAULT'] ?? null;

    if ($esNullable && ($default === null || strtoupper((string) $default) === 'NULL')) {
        return;
    }

    // Si la fecha queda vacía, debe poder guardarse NULL. Si la columna está NOT NULL
    // o tiene DEFAULT CURRENT_DATE/CURRENT_TIMESTAMP, MySQL completa la fecha actual.
    $pdo->exec("ALTER TABLE pagos_inscripcion MODIFY fecha_pago {$columnType} NULL DEFAULT NULL");
}

function balance_pago_insc_asegurar_medio_pago_nullable(PDO $pdo): void
{
    $stmt = $pdo->query("SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
                           FROM INFORMATION_SCHEMA.COLUMNS
                          WHERE TABLE_SCHEMA = DATABASE()
                            AND TABLE_NAME = 'pagos_inscripcion'
                            AND COLUMN_NAME = 'id_medio_pago'
                          LIMIT 1");
    $columna = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;

    if (!$columna) {
        return;
    }

    $columnType = trim((string) ($columna['COLUMN_TYPE'] ?? 'int'));
    if ($columnType === '') {
        $columnType = 'int';
    }

    $esNullable = strtoupper((string) ($columna['IS_NULLABLE'] ?? '')) === 'YES';
    $default = $columna['COLUMN_DEFAULT'] ?? null;

    if ($esNullable && ($default === null || strtoupper((string) $default) === 'NULL')) {
        return;
    }

    // Si se edita solamente la fecha, debe poder guardarse id_medio_pago NULL.
    // Si la columna está NOT NULL y no tiene default, MySQL lanza el error 1364.
    $pdo->exec("ALTER TABLE pagos_inscripcion MODIFY id_medio_pago {$columnType} NULL DEFAULT NULL");
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

    $medioRecibido = array_key_exists('id_medio_pago', $body) && $body['id_medio_pago'] !== null && trim((string) $body['id_medio_pago']) !== '';
    $fechaRecibida = array_key_exists('fecha_pago', $body) && $body['fecha_pago'] !== null && trim((string) $body['fecha_pago']) !== '';

    $idMedioPago = $medioRecibido ? (int) $body['id_medio_pago'] : null;
    $fechaPago = $fechaRecibida ? balance_pago_insc_validar_fecha((string) $body['fecha_pago']) : null;
    $monto = isset($body['monto']) ? (float) $body['monto'] : 0.0;

    if ($idSocio <= 0) {
        balance_pago_insc_responder([
            'exito' => false,
            'ok' => false,
            'mensaje' => 'No se recibió un socio válido.',
        ], 422);
    }

    if (!$medioRecibido && !$fechaRecibida) {
        balance_pago_insc_responder([
            'exito' => false,
            'ok' => false,
            'mensaje' => 'Modificá al menos el medio de pago o la fecha de pago.',
        ], 422);
    }

    if ($medioRecibido && (!$idMedioPago || $idMedioPago <= 0)) {
        balance_pago_insc_responder([
            'exito' => false,
            'ok' => false,
            'mensaje' => 'Seleccioná un medio de pago válido.',
        ], 422);
    }

    if ($fechaRecibida && $fechaPago === null) {
        balance_pago_insc_responder([
            'exito' => false,
            'ok' => false,
            'mensaje' => 'Seleccioná una fecha de pago válida.',
        ], 422);
    }

    if ($medioRecibido) {
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

    if (!$fechaRecibida) {
        balance_pago_insc_asegurar_fecha_pago_nullable($pdo);
    }

    if (!$medioRecibido) {
        balance_pago_insc_asegurar_medio_pago_nullable($pdo);
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
        $sets = [];
        $params = [
            ':id_inscripcion' => $idInscripcion,
            ':id_socio' => $idSocio,
        ];

        if ($medioRecibido) {
            $sets[] = 'id_medio_pago = :id_medio_pago';
            $params[':id_medio_pago'] = $idMedioPago;
        }

        if ($fechaRecibida) {
            $sets[] = 'fecha_pago = :fecha_pago';
            $params[':fecha_pago'] = $fechaPago;
        }

        if (empty($sets)) {
            throw new RuntimeException('No hay datos para actualizar.');
        }

        $sqlUpdate = "
            UPDATE pagos_inscripcion
               SET " . implode(', ', $sets) . "
             WHERE id_inscripcion = :id_inscripcion
               AND id_socio = :id_socio
        ";
        $stmtUpdate = $pdo->prepare($sqlUpdate);
        $stmtUpdate->execute($params);

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

        // Importante: incluir siempre fecha_pago e id_medio_pago en el INSERT.
        // Si alguno no se envía, se guarda NULL explícitamente para que MySQL
        // no use defaults ni rechace el INSERT por columnas NOT NULL sin default.
        $campos = ['id_socio', 'monto', 'fecha_pago', 'id_medio_pago'];
        $valores = [':id_socio', ':monto', ':fecha_pago', ':id_medio_pago'];
        $params = [
            ':id_socio' => $idSocio,
            ':monto' => $monto,
            ':fecha_pago' => $fechaRecibida ? $fechaPago : null,
            ':id_medio_pago' => $medioRecibido ? $idMedioPago : null,
        ];

        $sqlInsert = 'INSERT INTO pagos_inscripcion (' . implode(', ', $campos) . ') VALUES (' . implode(', ', $valores) . ')';
        $stmtInsert = $pdo->prepare($sqlInsert);
        foreach ($params as $clave => $valor) {
            if ($valor === null) {
                $stmtInsert->bindValue($clave, null, PDO::PARAM_NULL);
            } else {
                $stmtInsert->bindValue($clave, $valor);
            }
        }
        $stmtInsert->execute();
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
            : (strpos($e->getMessage(), 'fecha_pago') !== false
                ? 'No se pudo guardar sin fecha porque la columna fecha_pago de pagos_inscripcion todavía está configurada como NOT NULL. Cambiala a NULL DEFAULT NULL o subí este backend con permisos para ajustar la columna.'
                : (strpos($e->getMessage(), 'id_medio_pago') !== false
                    ? 'No se pudo guardar sin medio de pago porque la columna id_medio_pago de pagos_inscripcion todavía está configurada como NOT NULL. Cambiala a NULL DEFAULT NULL o subí este backend con permisos para ajustar la columna.'
                    : 'Error interno al actualizar el pago de inscripción.')),
    ], 500);
}
