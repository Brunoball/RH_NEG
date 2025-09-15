<?php
declare(strict_types=1);

require_once __DIR__ . '/_common.php';

$pdo = fam_pdo();

try {
    $sql = "
        SELECT
            f.id_familia,
            f.nombre_familia,
            f.observaciones,
            f.activo,

            -- solo la fecha, sin hora
            DATE(f.creado_en)     AS creado_en,
            DATE(f.actualizado_en) AS actualizado_en,

            -- opcional: fecha formateada DD/MM/YYYY
            DATE_FORMAT(f.creado_en, '%d/%m/%Y') AS fecha_alta,

            -- contadores
            (SELECT COUNT(*) FROM socios s WHERE s.id_familia = f.id_familia AND s.activo = 1) AS miembros_activos,
            (SELECT COUNT(*) FROM socios s WHERE s.id_familia = f.id_familia) AS miembros_totales
        FROM familias f
        ORDER BY f.nombre_familia ASC
    ";

    $st = $pdo->query($sql);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    fam_json(['exito' => true, 'familias' => $rows]);
} catch (Throwable $e) {
    fam_json(
        [
            'exito'   => false,
            'mensaje' => 'Error al listar familias',
            'error'   => $e->getMessage(), // quitar en producción si no querés exponer detalles
        ],
        500
    );
}
