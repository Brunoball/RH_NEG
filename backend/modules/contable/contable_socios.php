<?php
/**
 * Devuelve pagos de socios agrupados por PERÍODO (campo per.nombre),
 * calculando el precio por pago:
 *  - $4000 por defecto
 *  - $3500 si el socio pagó exactamente 6 periodos en el mismo mes (descuento => $21000 en total)
 *
 * Salida:
 * {
 *   "exito": true,
 *   "datos": [
 *     { "nombre": "PERÍODO 1 Y 2", "pagos": [ { ... }, ... ] },
 *     ...
 *   ],
 *   "total_socios": 1234                 // NUEVO: socios activos (=1)
 * }
 */

require_once __DIR__ . '/../../config/db.php';

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    /* ===== Total de socios (activos) para el gráfico circular ===== */
    $stmtTot = $pdo->query("SELECT COUNT(*) AS c FROM socios WHERE activo = 1");
    $rowTot  = $stmtTot->fetch(PDO::FETCH_ASSOC);
    $totalSocios = (int)($rowTot['c'] ?? 0);

    /* ===== Pagos ===== */
    $sql = "
        SELECT
            p.id_pago,
            p.id_socio,
            p.id_periodo,
            p.fecha_pago,
            s.nombre            AS socio_nombre,
            s.id_cobrador       AS socio_id_cobrador,
            cb.nombre           AS cobrador_nombre,
            per.nombre          AS periodo_nombre
        FROM pagos p
        INNER JOIN socios s    ON s.id_socio   = p.id_socio
        INNER JOIN periodo per ON per.id_periodo = p.id_periodo
        LEFT JOIN cobrador cb  ON cb.id_cobrador = s.id_cobrador
        ORDER BY p.fecha_pago ASC, p.id_pago ASC
    ";
    $stmt = $pdo->query($sql);
    $pagos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    /* ===== Conteo para descuento (6 pagos en mismo mes por socio) ===== */
    $conteoPorSocioMes = []; // "<id_socio>#YYYY-MM" => count
    foreach ($pagos as $row) {
        $idSocio = (int)$row['id_socio'];
        $ym = substr($row['fecha_pago'], 0, 7); // YYYY-MM
        $key = $idSocio . '#' . $ym;
        if (!isset($conteoPorSocioMes[$key])) $conteoPorSocioMes[$key] = 0;
        $conteoPorSocioMes[$key]++;
    }

    /* ===== Armar salida por período ===== */
    $porPeriodo = []; // periodo_nombre => ['nombre' => periodo, 'pagos' => []]

    foreach ($pagos as $row) {
        $idSocio = (int)$row['id_socio'];
        $fecha   = $row['fecha_pago'];
        $ym      = substr($fecha, 0, 7);
        $keySM   = $idSocio . '#' . $ym;

        $precio = (isset($conteoPorSocioMes[$keySM]) && (int)$conteoPorSocioMes[$keySM] === 6) ? 3500 : 4000;

        // Partir nombre "Nombre ... Apellido" -> (Nombre, Apellido)
        $nombreCompleto = trim((string)$row['socio_nombre']);
        $apellido = '';
        $nombre   = $nombreCompleto;
        if ($nombreCompleto !== '') {
            $partes = preg_split('/\s+/', $nombreCompleto);
            if (count($partes) >= 2) {
                $apellido = array_pop($partes);
                $nombre   = implode(' ', $partes);
            }
        }

        $periodoNombre = (string)$row['periodo_nombre'];
        if (!isset($porPeriodo[$periodoNombre])) {
            $porPeriodo[$periodoNombre] = [
                'nombre' => $periodoNombre,
                'pagos'  => [],
            ];
        }

        $porPeriodo[$periodoNombre]['pagos'][] = [
            'ID_Socio'      => $idSocio,                   // <<--- NUEVO (para contar únicos)
            'Apellido'      => $apellido,
            'Nombre'        => $nombre,
            'Precio'        => (float)$precio,
            'Cobrador'      => $row['cobrador_nombre'] ?? '',
            'fechaPago'     => $row['fecha_pago'],
            'Mes_Pagado'    => $periodoNombre,
            'Nombre_Categoria' => null,
            'Medio_Pago'       => null,
        ];
    }

    $datos = array_values($porPeriodo);

    echo json_encode([
        'exito'        => true,
        'datos'        => $datos,
        'total_socios' => $totalSocios,   // <<--- NUEVO
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error en la base de datos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error inesperado: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
