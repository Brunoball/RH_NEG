<?php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json');

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    /* ===== Distintos años con pagos (solo estado 'pagado') ===== */
    $yearsStmt = $pdo->query("
        SELECT DISTINCT YEAR(fecha_pago) AS y
          FROM pagos
         WHERE estado = 'pagado'
         ORDER BY y ASC
    ");
    $aniosDisponibles = array_map('intval', $yearsStmt->fetchAll(PDO::FETCH_COLUMN));

    /* ===== Año solicitado ===== */
    $anioParam = isset($_GET['anio']) ? (int)$_GET['anio'] : 0;
    if ($anioParam > 0) {
        $anioAplicado = $anioParam;
    } else {
        // Si no llega año, por defecto tomar el último disponible (si hay)
        $anioAplicado = !empty($aniosDisponibles) ? max($aniosDisponibles) : 0;
    }

    /* ===== Total de socios (activos) ===== */
    $stmtTot = $pdo->query("SELECT COUNT(*) AS c FROM socios WHERE activo = 1");
    $rowTot  = $stmtTot->fetch(PDO::FETCH_ASSOC);
    $totalSocios = (int)($rowTot['c'] ?? 0);

    /* ===== Si no hay años disponibles, devolver vacío ===== */
    if ($anioAplicado === 0) {
        echo json_encode([
            'exito'         => true,
            'datos'         => [],
            'total_socios'  => $totalSocios,
            'anios'         => $aniosDisponibles,
            'anio_aplicado' => 0,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    /* ===== Pagos (SOLO 'pagado' del año aplicado) ===== */
    $sql = "
        SELECT
            p.id_pago,
            p.id_socio,
            p.id_periodo,
            p.fecha_pago,
            p.estado,
            s.nombre            AS socio_nombre,
            s.id_cobrador       AS socio_id_cobrador,
            cb.nombre           AS cobrador_nombre,
            per.nombre          AS periodo_nombre
        FROM pagos p
        INNER JOIN socios s    ON s.id_socio      = p.id_socio
        INNER JOIN periodo per ON per.id_periodo  = p.id_periodo
        LEFT JOIN cobrador cb  ON cb.id_cobrador  = s.id_cobrador
        WHERE p.estado = 'pagado'
          AND YEAR(p.fecha_pago) = :anio
        ORDER BY p.fecha_pago ASC, p.id_pago ASC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':anio', $anioAplicado, PDO::PARAM_INT);
    $stmt->execute();
    $pagos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    /* ===== Grouping por socio+mes (YYYY-MM) ===== */
    $groups = [];
    foreach ($pagos as $row) {
        $idSocio = (int)$row['id_socio'];
        $fecha   = (string)$row['fecha_pago'];
        if ($fecha === '' || strlen($fecha) < 7) continue;
        $ym      = substr($fecha, 0, 7);
        $key     = $idSocio . '#' . $ym;

        if (!isset($groups[$key])) {
            $groups[$key] = [
                'id_socio'     => $idSocio,
                'ym'           => $ym,
                'rows'         => [],
                'periodos_set' => [],
                'has_anual'    => false,
                'socio_nombre' => (string)($row['socio_nombre'] ?? ''),
                'cobradores'   => [],
                'fechas'       => [],
            ];
        }

        $groups[$key]['rows'][] = $row;
        $groups[$key]['fechas'][] = $fecha;
        $cb = trim((string)($row['cobrador_nombre'] ?? ''));
        if ($cb !== '') $groups[$key]['cobradores'][] = $cb;

        $idPeriodo = (int)$row['id_periodo'];
        if ($idPeriodo === 7) {
            $groups[$key]['has_anual'] = true;
        } else {
            if ($idPeriodo >= 1 && $idPeriodo <= 6) {
                $groups[$key]['periodos_set'][$idPeriodo] = true;
            }
        }
    }

    $modoCobrador = function(array $lista) {
        if (empty($lista)) return '';
        $counts = [];
        foreach ($lista as $c) {
            $counts[$c] = ($counts[$c] ?? 0) + 1;
        }
        arsort($counts);
        return array_key_first($counts);
    };

    /* ===== Construcción de salida por período ===== */
    $porPeriodo = []; // 'PERÍODO X' / 'CONTADO ANUAL' => ['nombre' => ..., 'pagos' => []]

    foreach ($groups as $g) {
        $idSocio      = $g['id_socio'];
        $socioNombre  = trim($g['socio_nombre']);
        $apellido     = '';
        $nombre       = $socioNombre;
        if ($socioNombre !== '') {
            $partes = preg_split('/\s+/', $socioNombre);
            if (count($partes) >= 2) {
                $apellido = array_pop($partes);
                $nombre   = implode(' ', $partes);
            }
        }

        $fechaRepresentativa = '';
        if ($g['has_anual']) {
            foreach ($g['rows'] as $r) {
                if ((int)$r['id_periodo'] === 7) {
                    $fechaRepresentativa = (string)$r['fecha_pago'];
                    break;
                }
            }
        }
        if ($fechaRepresentativa === '') {
            $fechas = $g['fechas'];
            rsort($fechas);
            $fechaRepresentativa = $fechas[0] ?? null;
        }

        $cobradorNombre = $modoCobrador($g['cobradores']);
        $tieneSeisPeriodos = (count($g['periodos_set']) === 6);

        if ($g['has_anual'] || $tieneSeisPeriodos) {
            $periodoNombre = 'CONTADO ANUAL';
            if (!isset($porPeriodo[$periodoNombre])) {
                $porPeriodo[$periodoNombre] = ['nombre' => $periodoNombre, 'pagos' => []];
            }
            $porPeriodo[$periodoNombre]['pagos'][] = [
                'ID_Socio'         => $idSocio,
                'Apellido'         => $apellido,
                'Nombre'           => $nombre,
                'Precio'           => 21000.0,
                'Cobrador'         => $cobradorNombre,
                'fechaPago'        => $fechaRepresentativa,
                'Mes_Pagado'       => $periodoNombre,
                'Nombre_Categoria' => null,
                'Medio_Pago'       => null,
            ];
            continue;
        }

        foreach ($g['rows'] as $r) {
            $periodoNombre = (string)$r['periodo_nombre'];
            if (!isset($porPeriodo[$periodoNombre])) {
                $porPeriodo[$periodoNombre] = ['nombre' => $periodoNombre, 'pagos' => []];
            }
            $porPeriodo[$periodoNombre]['pagos'][] = [
                'ID_Socio'         => $idSocio,
                'Apellido'         => $apellido,
                'Nombre'           => $nombre,
                'Precio'           => 4000.0,
                'Cobrador'         => $cobradorNombre !== '' ? $cobradorNombre : (string)($r['cobrador_nombre'] ?? ''),
                'fechaPago'        => (string)($r['fecha_pago'] ?? $fechaRepresentativa),
                'Mes_Pagado'       => $periodoNombre,
                'Nombre_Categoria' => null,
                'Medio_Pago'       => null,
            ];
        }
    }

    $datos = array_values($porPeriodo);

    echo json_encode([
        'exito'         => true,
        'datos'         => $datos,
        'total_socios'  => $totalSocios,
        'anios'         => $aniosDisponibles,
        'anio_aplicado' => $anioAplicado
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
