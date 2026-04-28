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
 * - edad_actual: edad calculada desde nacimiento
 * - último contacto desde socios.id_ultimo_contacto.
 *
 * Si por algún motivo socios.id_ultimo_contacto está vacío pero existe historial,
 * toma como respaldo el último registro de socios_contactos para ese socio.
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

            CASE
                WHEN s.nacimiento IS NOT NULL
                THEN TIMESTAMPDIFF(YEAR, s.nacimiento, CURDATE())
                ELSE NULL
            END AS edad_actual,

            COALESCE(sc_guardado.id_contacto, sc_auto.id_contacto) AS contacto_id,

            COALESCE(sc_guardado.detalle_contacto, sc_auto.detalle_contacto) AS ultimo_contacto_real,
            DATE(COALESCE(sc_guardado.fecha_contacto, sc_auto.fecha_contacto)) AS ultimo_contacto_fecha_real,
            COALESCE(sc_guardado.estado_contacto, sc_auto.estado_contacto) AS ultimo_contacto_estado_real,

            CASE
                WHEN COALESCE(sc_guardado.fecha_contacto, sc_auto.fecha_contacto) IS NOT NULL
                 AND YEAR(COALESCE(sc_guardado.fecha_contacto, sc_auto.fecha_contacto)) = YEAR(CURDATE())
                THEN COALESCE(sc_guardado.detalle_contacto, sc_auto.detalle_contacto)
                ELSE NULL
            END AS ultimo_contacto,

            CASE
                WHEN COALESCE(sc_guardado.fecha_contacto, sc_auto.fecha_contacto) IS NOT NULL
                 AND YEAR(COALESCE(sc_guardado.fecha_contacto, sc_auto.fecha_contacto)) = YEAR(CURDATE())
                THEN DATE(COALESCE(sc_guardado.fecha_contacto, sc_auto.fecha_contacto))
                ELSE NULL
            END AS ultimo_contacto_fecha,

            CASE
                WHEN COALESCE(sc_guardado.fecha_contacto, sc_auto.fecha_contacto) IS NOT NULL
                 AND YEAR(COALESCE(sc_guardado.fecha_contacto, sc_auto.fecha_contacto)) = YEAR(CURDATE())
                THEN COALESCE(sc_guardado.estado_contacto, sc_auto.estado_contacto)
                ELSE 'SIN_GESTION'
            END AS ultimo_contacto_estado,

            CASE
                WHEN COALESCE(sc_guardado.fecha_contacto, sc_auto.fecha_contacto) IS NOT NULL
                 AND YEAR(COALESCE(sc_guardado.fecha_contacto, sc_auto.fecha_contacto)) = YEAR(CURDATE())
                THEN COALESCE(sc_guardado.fecha_contacto, sc_auto.fecha_contacto)
                ELSE NULL
            END AS ultimo_contacto_fecha_hora

        FROM socios s
        LEFT JOIN familias f
            ON f.id_familia = s.id_familia
        LEFT JOIN estado e
            ON e.id_estado = s.id_estado
        LEFT JOIN socios_contactos sc_guardado
            ON sc_guardado.id_contacto = s.id_ultimo_contacto
        LEFT JOIN (
            SELECT id_socio, MAX(id_contacto) AS id_contacto
            FROM socios_contactos
            GROUP BY id_socio
        ) ult_sc
            ON ult_sc.id_socio = s.id_socio
        LEFT JOIN socios_contactos sc_auto
            ON sc_auto.id_contacto = ult_sc.id_contacto

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
