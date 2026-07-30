<?php
// backend/modules/socios/cumple18_cierres_guardar.php

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';
require_once __DIR__ . '/_cumple18_cierres_common.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    cumple18AsegurarTabla($pdo);

    $data = cumple18LeerEntrada();
    $actor = cumple18ObtenerActor($data);

    $entradas = [];
    if (isset($data['cierres']) && is_array($data['cierres'])) {
        $entradas = $data['cierres'];
    } else {
        $entradas = [$data];
    }

    if (count($entradas) === 0) {
        cumple18Responder(422, [
            'exito' => false,
            'mensaje' => 'No se recibieron cierres para guardar.',
        ]);
    }

    if (count($entradas) > 5000) {
        cumple18Responder(422, [
            'exito' => false,
            'mensaje' => 'La cantidad de cierres excede el máximo permitido.',
        ]);
    }

    $normalizados = [];
    $idsSocios = [];

    foreach ($entradas as $entrada) {
        if (!is_array($entrada)) {
            continue;
        }

        $idSocio = (int)($entrada['id_socio'] ?? 0);
        $anio = (int)($entrada['anio'] ?? date('Y'));
        $rango = cumple18NormalizarRango((string)($entrada['rango'] ?? '18-23'));
        $edad = isset($entrada['edad']) ? (int)$entrada['edad'] : null;
        $fechaNacimiento = cumple18NormalizarFecha($entrada['fecha_nacimiento'] ?? null);
        $cerradoEn = cumple18NormalizarFechaHora($entrada['cerrado_en'] ?? null)
            ?? date('Y-m-d H:i:s');
        $origen = trim((string)($entrada['origen'] ?? $data['origen'] ?? 'SISTEMA'));
        $origen = $origen !== '' ? mb_substr($origen, 0, 30, 'UTF-8') : 'SISTEMA';

        if ($idSocio <= 0 || $anio < 2000 || $anio > 2200) {
            continue;
        }

        $normalizados[] = [
            'id_socio' => $idSocio,
            'anio' => $anio,
            'rango' => $rango,
            'edad' => ($edad !== null && $edad >= 0 && $edad <= 120) ? $edad : null,
            'fecha_nacimiento' => $fechaNacimiento,
            'cerrado_en' => $cerradoEn,
            'origen' => $origen,
        ];
        $idsSocios[$idSocio] = true;
    }

    if (count($normalizados) === 0) {
        cumple18Responder(422, [
            'exito' => false,
            'mensaje' => 'Los datos recibidos no contienen cierres válidos.',
        ]);
    }

    $placeholders = implode(',', array_fill(0, count($idsSocios), '?'));
    $stmtSocios = $pdo->prepare("SELECT id_socio FROM socios WHERE id_socio IN ($placeholders)");
    $stmtSocios->execute(array_keys($idsSocios));
    $existentes = array_fill_keys(array_map('intval', $stmtSocios->fetchAll(PDO::FETCH_COLUMN)), true);

    $stmtGuardar = $pdo->prepare("
        INSERT INTO socios_cumpleanios_cierres (
            id_socio,
            anio,
            rango,
            edad_al_cierre,
            fecha_nacimiento,
            cerrado_en,
            cerrado_por_usuario_id,
            cerrado_por_nombre,
            origen
        ) VALUES (
            :id_socio,
            :anio,
            :rango,
            :edad_al_cierre,
            :fecha_nacimiento,
            :cerrado_en,
            :cerrado_por_usuario_id,
            :cerrado_por_nombre,
            :origen
        )
        ON DUPLICATE KEY UPDATE
            edad_al_cierre = COALESCE(VALUES(edad_al_cierre), edad_al_cierre),
            fecha_nacimiento = COALESCE(VALUES(fecha_nacimiento), fecha_nacimiento),
            cerrado_en = LEAST(cerrado_en, VALUES(cerrado_en)),
            cerrado_por_usuario_id = COALESCE(cerrado_por_usuario_id, VALUES(cerrado_por_usuario_id)),
            cerrado_por_nombre = COALESCE(cerrado_por_nombre, VALUES(cerrado_por_nombre)),
            origen = CASE
                WHEN origen = 'SISTEMA' THEN origen
                ELSE VALUES(origen)
            END
    ");

    $pdo->beginTransaction();
    $guardados = [];
    $omitidos = [];

    foreach ($normalizados as $cierre) {
        if (!isset($existentes[$cierre['id_socio']])) {
            $omitidos[] = $cierre['id_socio'];
            continue;
        }

        $stmtGuardar->execute([
            ':id_socio' => $cierre['id_socio'],
            ':anio' => $cierre['anio'],
            ':rango' => $cierre['rango'],
            ':edad_al_cierre' => $cierre['edad'],
            ':fecha_nacimiento' => $cierre['fecha_nacimiento'],
            ':cerrado_en' => $cierre['cerrado_en'],
            ':cerrado_por_usuario_id' => $actor['id'],
            ':cerrado_por_nombre' => $actor['nombre'],
            ':origen' => $cierre['origen'],
        ]);

        $guardados[] = [
            ...$cierre,
            'key' => cumple18Clave($cierre['anio'], $cierre['rango'], $cierre['id_socio']),
        ];
    }

    $pdo->commit();

    cumple18Responder(200, [
        'exito' => true,
        'mensaje' => count($guardados) === 1
            ? 'Tarjeta cerrada correctamente.'
            : 'Cierres sincronizados correctamente.',
        'cierres' => $guardados,
        'omitidos' => array_values(array_unique($omitidos)),
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    cumple18Responder(500, [
        'exito' => false,
        'mensaje' => 'Error al guardar el cierre de cumpleaños: ' . $e->getMessage(),
    ]);
}
