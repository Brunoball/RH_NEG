<?php
// backend/modules/socios/cumple18_cierres_listar.php

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

    $anio = (int)($_GET['anio'] ?? date('Y'));
    $rango = cumple18NormalizarRango((string)($_GET['rango'] ?? '18-23'));

    if ($anio < 2000 || $anio > 2200) {
        cumple18Responder(422, [
            'exito' => false,
            'mensaje' => 'El año indicado no es válido.',
        ]);
    }

    $recuperados = cumple18RecuperarDesdeContactos($pdo, $anio, $rango);

    $stmt = $pdo->prepare("
        SELECT
            c.id_cierre,
            c.id_socio,
            c.anio,
            c.rango,
            c.edad_al_cierre,
            c.fecha_nacimiento,
            c.cerrado_en,
            c.cerrado_por_usuario_id,
            c.cerrado_por_nombre,
            c.origen,
            s.nombre
        FROM socios_cumpleanios_cierres c
        INNER JOIN socios s ON s.id_socio = c.id_socio
        WHERE c.anio = :anio
          AND c.rango = :rango
        ORDER BY c.cerrado_en DESC, c.id_cierre DESC
    ");
    $stmt->execute([
        ':anio' => $anio,
        ':rango' => $rango,
    ]);

    $cierres = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($cierres as &$cierre) {
        $cierre['key'] = cumple18Clave(
            (int)$cierre['anio'],
            (string)$cierre['rango'],
            (int)$cierre['id_socio']
        );
    }
    unset($cierre);

    cumple18Responder(200, [
        'exito' => true,
        'anio' => $anio,
        'rango' => $rango,
        'cierres' => $cierres,
        'recuperados_desde_contactos' => $recuperados,
    ]);
} catch (Throwable $e) {
    cumple18Responder(500, [
        'exito' => false,
        'mensaje' => 'Error al obtener los cierres de cumpleaños: ' . $e->getMessage(),
    ]);
}
