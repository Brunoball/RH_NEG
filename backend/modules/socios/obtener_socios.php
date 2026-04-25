<?php
// backend/modules/socios/obtener_socios.php

declare(strict_types=1);

require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

/**
 * Obtiene los socios por estado de alta/baja (columna activo),
 * y además trae:
 * - familia: nombre de la familia si existe
 * - estado_descripcion: descripción del estado (ACTIVO / PASIVO)
 * - último contacto desde socios_contactos usando socios.id_ultimo_contacto
 *
 * Reset anual de colores/contacto:
 * - El historial completo queda en socios_contactos.
 * - Para la tabla principal, el último contacto solo se muestra como estado visual
 *   si pertenece al año actual.
 * - El 1 de enero, cualquier último contacto de años anteriores queda visualmente
 *   como SIN_GESTION, sin borrar el historial.
 */
function obtenerSociosPorEstado(PDO $pdo, int $estadoActivo): array
{
    $sql = "
        SELECT
            s.*,
            f.nombre_familia AS familia,
            e.descripcion AS estado_descripcion,

            sc.id_contacto AS contacto_id,

            sc.detalle_contacto AS ultimo_contacto_real,
            DATE(sc.fecha_contacto) AS ultimo_contacto_fecha_real,
            sc.estado_contacto AS ultimo_contacto_estado_real,

            CASE
                WHEN sc.fecha_contacto IS NOT NULL AND YEAR(sc.fecha_contacto) = YEAR(CURDATE())
                THEN sc.detalle_contacto
                ELSE NULL
            END AS ultimo_contacto,

            CASE
                WHEN sc.fecha_contacto IS NOT NULL AND YEAR(sc.fecha_contacto) = YEAR(CURDATE())
                THEN DATE(sc.fecha_contacto)
                ELSE NULL
            END AS ultimo_contacto_fecha,

            CASE
                WHEN sc.fecha_contacto IS NOT NULL AND YEAR(sc.fecha_contacto) = YEAR(CURDATE())
                THEN sc.estado_contacto
                ELSE 'SIN_GESTION'
            END AS ultimo_contacto_estado,

            CASE
                WHEN sc.fecha_contacto IS NOT NULL AND YEAR(sc.fecha_contacto) = YEAR(CURDATE())
                THEN sc.fecha_contacto
                ELSE NULL
            END AS ultimo_contacto_fecha_hora

        FROM socios s
        LEFT JOIN familias f
            ON f.id_familia = s.id_familia
        LEFT JOIN estado e
            ON e.id_estado = s.id_estado
        LEFT JOIN socios_contactos sc
            ON sc.id_contacto = s.id_ultimo_contacto

        WHERE s.activo = :activo
        ORDER BY s.id_socio ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':activo', $estadoActivo, PDO::PARAM_INT);
    $stmt->execute();

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // ?baja=1 => trae los dados de baja (activo = 0)
    // por defecto => trae los habilitados (activo = 1)
    $estadoActivo = (isset($_GET['baja']) && (string)$_GET['baja'] === '1') ? 0 : 1;

    $socios = obtenerSociosPorEstado($pdo, $estadoActivo);

    echo json_encode([
        'exito'  => true,
        'socios' => $socios,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al obtener los socios: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
