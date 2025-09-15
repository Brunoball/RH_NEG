<?php
// backend/modules/contable/contable.php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    // Asegurar excepciones en PDO
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    /* ========= Helpers de categoría y precios ========= */

    // Categoría por defecto (por si algún socio no tiene asignada)
    function catDefaultId(PDO $pdo): ?int {
        $id = $pdo->query("
            SELECT id_cat_monto
            FROM categoria_monto
            ORDER BY id_cat_monto ASC
            LIMIT 1
        ")->fetchColumn();
        return $id !== false ? (int)$id : null;
    }

    // Cache simple de info de categoría
    function getCatInfo(PDO $pdo, int $catId, array &$cache): ?array {
        if (isset($cache[$catId])) return $cache[$catId];

        $st = $pdo->prepare("
            SELECT id_cat_monto, nombre_categoria, monto_mensual, monto_anual
            FROM categoria_monto
            WHERE id_cat_monto = :id
            LIMIT 1
        ");
        $st->execute([':id' => $catId]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;

        $cache[$catId] = [
            'id'        => (int)$row['id_cat_monto'],
            'nombre'    => (string)$row['nombre_categoria'],
            'm_mensual' => (int)$row['monto_mensual'],
            'm_anual'   => (int)$row['monto_anual'],
        ];
        return $cache[$catId];
    }

    /**
     * Precio vigente para el MES de $fecha ($fecha en formato YYYY-MM-DD o YYYY-MM)
     *   $tipo = 'M' (mensual) o 'A' (anual)
     *
     * REGLA POR MES:
     *  1) Si hay cambios en ese mismo YYYY-MM -> usar el último precio_nuevo de ese mes.
     *  2) Si no hay cambios ese mes pero existe un cambio POSTERIOR a ese mes -> usar precio_viejo de ese primer cambio posterior.
     *  3) Si no existe cambio posterior -> usar el valor actual en categoria_monto.
     *
     * Soporta 'M'/'A' y 'mensual'/'anual' en precios_historicos.
     */
    function precioVigente(PDO $pdo, int $catId, string $tipo, string $fecha, array &$cache): int {
        // Normalizar mes objetivo
        $ym = substr(trim($fecha), 0, 7); // YYYY-MM
        if (!preg_match('/^\d{4}-\d{2}$/', $ym)) {
            // fallback: intentar de la fecha completa
            $ym = date('Y-m', strtotime($fecha));
        }

        $t = strtoupper($tipo) === 'A' ? 'A' : 'M';
        $key = $t . '|' . $catId . '|' . $ym;
        if (isset($cache[$key])) return $cache[$key];

        $tChar = $t;                               // 'M' / 'A'
        $tWord = ($t === 'A') ? 'anual' : 'mensual';

        // 1) ¿Hay cambios dentro del MISMO MES? -> usar el ÚLTIMO precio_nuevo de ese mes
        $sqlMes = "
            SELECT precio_nuevo
            FROM precios_historicos
            WHERE id_cat_monto = :id
              AND (tipo = :tchar OR tipo = :tword)
              AND DATE_FORMAT(fecha_cambio, '%Y-%m') = :ym
            ORDER BY fecha_cambio DESC
            LIMIT 1
        ";
        $stMes = $pdo->prepare($sqlMes);
        $stMes->execute([
            ':id'    => $catId,
            ':tchar' => $tChar,
            ':tword' => $tWord,
            ':ym'    => $ym,
        ]);
        $nuevoEnMes = $stMes->fetchColumn();
        if ($nuevoEnMes !== false) {
            return $cache[$key] = (int)$nuevoEnMes;
        }

        // 2) No hubo cambio en ese mes -> buscar PRIMER cambio POSTERIOR al mes
        $sqlPosterior = "
            SELECT precio_viejo
            FROM precios_historicos
            WHERE id_cat_monto = :id
              AND (tipo = :tchar OR tipo = :tword)
              AND DATE_FORMAT(fecha_cambio, '%Y-%m') > :ym
            ORDER BY fecha_cambio ASC
            LIMIT 1
        ";
        $stPos = $pdo->prepare($sqlPosterior);
        $stPos->execute([
            ':id'    => $catId,
            ':tchar' => $tChar,
            ':tword' => $tWord,
            ':ym'    => $ym,
        ]);
        $precioViejoAntesDePosterior = $stPos->fetchColumn();
        if ($precioViejoAntesDePosterior !== false) {
            // Estamos antes del primer cambio posterior → rige el precio viejo
            return $cache[$key] = (int)$precioViejoAntesDePosterior;
        }

        // 3) No hay cambio posterior → rige el valor actual de la categoría
        if ($t === 'M') {
            $q = $pdo->prepare("SELECT monto_mensual FROM categoria_monto WHERE id_cat_monto = :id");
        } else {
            $q = $pdo->prepare("SELECT monto_anual FROM categoria_monto WHERE id_cat_monto = :id");
        }
        $q->execute([':id' => $catId]);
        $val = (int)($q->fetchColumn() ?: 0);
        return $cache[$key] = $val;
    }

    /* ========= Años con pagos (para combos) ========= */
    $yearsStmt = $pdo->query("
        SELECT DISTINCT YEAR(fecha_pago) AS y
        FROM pagos
        WHERE estado = 'pagado'
        ORDER BY y ASC
    ");
    $aniosDisponibles = array_map('intval', $yearsStmt->fetchAll(PDO::FETCH_COLUMN));

    /* ========= Año aplicado ========= */
    $anioParam    = isset($_GET['anio']) ? (int)$_GET['anio'] : 0;
    $anioAplicado = $anioParam > 0 ? $anioParam : (!empty($aniosDisponibles) ? max($aniosDisponibles) : 0);

    /* ========= Total de socios (activos) ========= */
    $stmtTot     = $pdo->query("SELECT COUNT(*) AS c FROM socios WHERE activo = 1");
    $rowTot      = $stmtTot->fetch(PDO::FETCH_ASSOC);
    $totalSocios = (int)($rowTot['c'] ?? 0);

    // Si todavía no tenés pagos (p. ej., DB nueva), devolvemos estructura vacía
    if ($anioAplicado === 0) {
        echo json_encode([
            'exito'         => true,
            'datos'         => [],
            'condonados'    => [],
            'total_socios'  => $totalSocios,
            'anios'         => $aniosDisponibles,
            'anio_aplicado' => 0,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    /* ========= Pagos pagados del año ========= */
    $sql = "
        SELECT
            p.id_pago,
            p.id_socio,
            p.id_periodo,
            p.fecha_pago,
            p.estado,
            s.nombre        AS socio_nombre,
            s.id_cobrador   AS socio_id_cobrador,
            s.id_cat_monto  AS socio_id_cat_monto,
            cb.nombre       AS cobrador_nombre,
            per.nombre      AS periodo_nombre
        FROM pagos p
        INNER JOIN socios   s   ON s.id_socio     = p.id_socio
        INNER JOIN periodo  per ON per.id_periodo = p.id_periodo
        LEFT  JOIN cobrador cb  ON cb.id_cobrador = s.id_cobrador
        WHERE p.estado = 'pagado'
          AND YEAR(p.fecha_pago) = :anio
        ORDER BY p.fecha_pago ASC, p.id_pago ASC
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':anio', $anioAplicado, PDO::PARAM_INT);
    $stmt->execute();
    $pagos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    /* ========= Pagos condonados del año (para el pie del modal) ========= */
    $sqlCond = "
        SELECT
            p.id_pago,
            p.id_socio,
            p.id_periodo,
            p.fecha_pago,
            p.estado,
            s.nombre        AS socio_nombre,
            s.id_cobrador   AS socio_id_cobrador,
            s.id_cat_monto  AS socio_id_cat_monto,
            cb.nombre       AS cobrador_nombre,
            per.nombre      AS periodo_nombre
        FROM pagos p
        INNER JOIN socios   s   ON s.id_socio     = p.id_socio
        INNER JOIN periodo  per ON per.id_periodo = p.id_periodo
        LEFT  JOIN cobrador cb  ON cb.id_cobrador = s.id_cobrador
        WHERE p.estado = 'condonado'
          AND YEAR(p.fecha_pago) = :anio
        ORDER BY p.fecha_pago ASC, p.id_pago ASC
    ";
    $stmtCond = $pdo->prepare($sqlCond);
    $stmtCond->bindValue(':anio', $anioAplicado, PDO::PARAM_INT);
    $stmtCond->execute();
    $condonadosRaw = $stmtCond->fetchAll(PDO::FETCH_ASSOC);

    /* ========= Agrupación y construcción de salida ========= */

    // Caches
    $precioCache  = [];   // por (tipo|cat|YYYY-MM)
    $catInfoCache = [];   // por id_cat_monto

    // Fallback de categoría
    $fallbackCat = catDefaultId($pdo) ?? 0;

    // Agrupar por socio + YYYY-MM para detectar anual (id_periodo=7 o 6 bimestres)
    $groups = [];
    foreach ($pagos as $row) {
        $idSocio = (int)$row['id_socio'];
        $fecha   = (string)$row['fecha_pago'];
        if ($fecha === '' || strlen($fecha) < 7) continue;

        $ym  = substr($fecha, 0, 7);
        $key = $idSocio . '#' . $ym;

        $catIdSocio = (int)($row['socio_id_cat_monto'] ?? 0);
        if ($catIdSocio <= 0) $catIdSocio = $fallbackCat;

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
                'cat_id'       => $catIdSocio,
            ];
        }

        $groups[$key]['rows'][]   = $row;
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

    // Moda de cobrador (nombre más repetido)
    $modoCobrador = function(array $lista) {
        if (empty($lista)) return '';
        $counts = [];
        foreach ($lista as $c) $counts[$c] = ($counts[$c] ?? 0) + 1;
        arsort($counts);
        return array_key_first($counts);
    };

    $porPeriodo = [];

    foreach ($groups as $g) {
        $idSocio     = $g['id_socio'];
        $socioNombre = trim($g['socio_nombre']);
        $catId       = (int)$g['cat_id'];

        // Info de categoría
        $catInfo   = $catId ? getCatInfo($pdo, $catId, $catInfoCache) : null;
        $catNombre = $catInfo['nombre']    ?? null;
        $baseM     = (int)($catInfo['m_mensual'] ?? 0);
        $baseA     = (int)($catInfo['m_anual']   ?? 0);

        // Fecha representativa (si hay anual, tomo la de ese registro)
        $fechaRep = '';
        if ($g['has_anual']) {
            foreach ($g['rows'] as $r) {
                if ((int)$r['id_periodo'] === 7) {
                    $fechaRep = (string)$r['fecha_pago'];
                    break;
                }
            }
        }
        if ($fechaRep === '') {
            $fechas = $g['fechas'];
            rsort($fechas);
            $fechaRep = $fechas[0] ?? null;
        }

        $cobradorNombre    = $modoCobrador($g['cobradores']);
        $tieneSeisPeriodos = (count($g['periodos_set']) === 6);

        // ==== Caso "CONTADO ANUAL"
        if ($g['has_anual'] || $tieneSeisPeriodos) {
            $periodoNombre = 'CONTADO ANUAL';
            $precioAnual   = $catId ? precioVigente($pdo, $catId, 'A', $fechaRep, $precioCache) : 0;

            if (!isset($porPeriodo[$periodoNombre])) {
                $porPeriodo[$periodoNombre] = ['nombre' => $periodoNombre, 'pagos' => []];
            }
            $porPeriodo[$periodoNombre]['pagos'][] = [
                'ID_Socio'         => $idSocio,
                'Socio'            => $socioNombre,
                'Precio'           => (float)$precioAnual,
                'Tipo_Precio'      => 'A',
                'Categoria_Id'     => $catId,
                'Nombre_Categoria' => $catNombre,
                'Monto_Base_M'     => (float)$baseM,
                'Monto_Base_A'     => (float)$baseA,
                'Cobrador'         => $cobradorNombre,
                'fechaPago'        => $fechaRep,
                'Mes_Pagado'       => $periodoNombre,
                'Estado'           => 'pagado',
            ];
            continue;
        }

        // ==== Periodos normales (precio mensual según MES de la fecha)
        foreach ($g['rows'] as $r) {
            $periodoNombre = (string)$r['periodo_nombre'];
            $fechaFila     = (string)($r['fecha_pago'] ?? $fechaRep);
            $precioMensual = $catId ? precioVigente($pdo, $catId, 'M', $fechaFila, $precioCache) : 0;

            if (!isset($porPeriodo[$periodoNombre])) {
                $porPeriodo[$periodoNombre] = ['nombre' => $periodoNombre, 'pagos' => []];
            }
            $porPeriodo[$periodoNombre]['pagos'][] = [
                'ID_Socio'         => $idSocio,
                'Socio'            => $socioNombre,
                'Precio'           => (float)$precioMensual,
                'Tipo_Precio'      => 'M',
                'Categoria_Id'     => $catId,
                'Nombre_Categoria' => $catNombre,
                'Monto_Base_M'     => (float)$baseM,
                'Monto_Base_A'     => (float)$baseA,
                'Cobrador'         => $cobradorNombre !== '' ? $cobradorNombre : (string)($r['cobrador_nombre'] ?? ''),
                'fechaPago'        => $fechaFila,
                'Mes_Pagado'       => $periodoNombre,
                'Estado'           => 'pagado',
            ];
        }
    }

    $datos = array_values($porPeriodo);

    echo json_encode([
        'exito'         => true,
        'datos'         => $datos,
        'condonados'    => $condonadosRaw,
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
