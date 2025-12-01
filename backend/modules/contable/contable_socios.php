<?php
// backend/modules/contable/contable.php
require_once __DIR__ . '/../../config/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES utf8mb4");

    // ===================== META LIGERA: SOLO AÑOS =====================
    // Llamar con: action=contable&meta=years
    if (isset($_GET['meta']) && $_GET['meta'] === 'years') {
        // Recomendado: índice (estado, fecha_pago)
        // CREATE INDEX IF NOT EXISTS idx_pagos_estado_fecha ON pagos (estado, fecha_pago);

        $yearsStmt = $pdo->query("
            SELECT DISTINCT YEAR(fecha_pago) AS y
            FROM pagos
            WHERE estado = 'pagado'
            ORDER BY y ASC
        ");
        $aniosDisponibles = array_map('intval', $yearsStmt->fetchAll(PDO::FETCH_COLUMN));

        $stmtTot     = $pdo->query("SELECT COUNT(*) AS c FROM socios WHERE activo = 1");
        $rowTot      = $stmtTot->fetch(PDO::FETCH_ASSOC);
        $totalSocios = (int)($rowTot['c'] ?? 0);

        echo json_encode([
            'exito'         => true,
            'anios'         => $aniosDisponibles,
            'total_socios'  => $totalSocios,
            'anio_aplicado' => 0, // no aplica en meta
            'datos'         => [], // sin datos pesados
            'condonados'    => [],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ===================== AÑOS (para combos cuando se pida pagos) =====================
    $yearsStmt = $pdo->query("
        SELECT DISTINCT YEAR(fecha_pago) AS y
        FROM pagos
        WHERE estado = 'pagado'
        ORDER BY y ASC
    ");
    $aniosDisponibles = array_map('intval', $yearsStmt->fetchAll(PDO::FETCH_COLUMN));

    // ===================== AÑO aplicado =====================
    $anioParam    = isset($_GET['anio']) ? (int)$_GET['anio'] : 0;
    $anioAplicado = $anioParam > 0 ? $anioParam : (!empty($aniosDisponibles) ? max($aniosDisponibles) : 0);

    // ===================== Total de socios (activos) =====================
    $stmtTot     = $pdo->query("SELECT COUNT(*) AS c FROM socios WHERE activo = 1");
    $rowTot      = $stmtTot->fetch(PDO::FETCH_ASSOC);
    $totalSocios = (int)($rowTot['c'] ?? 0);

    // Si no hay pagos todavía, devolver estructura vacía
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

    // ===================== Pagos 'pagado' del año (usa p.monto) =====================
    $sqlPagados = "
        SELECT
            p.id_pago,
            p.id_socio,
            p.id_periodo,
            p.fecha_pago,
            p.estado,
            p.monto,
            p.id_medio_pago,
            mp.nombre              AS medio_pago_nombre,
            s.nombre               AS socio_nombre,
            s.id_cobrador          AS socio_id_cobrador,
            s.id_cat_monto         AS socio_id_cat_monto,
            s.id_estado            AS socio_estado_id,
            e.descripcion          AS socio_estado_desc,
            cb.nombre              AS cobrador_nombre,
            per.nombre             AS periodo_nombre,
            cm.nombre_categoria    AS nombre_categoria,
            cm.monto_mensual       AS monto_base_m,
            cm.monto_anual         AS monto_base_a
        FROM pagos p
        INNER JOIN socios           s   ON s.id_socio     = p.id_socio
        INNER JOIN periodo          per ON per.id_periodo = p.id_periodo
        LEFT  JOIN cobrador         cb  ON cb.id_cobrador = s.id_cobrador
        LEFT  JOIN categoria_monto  cm  ON cm.id_cat_monto = s.id_cat_monto
        LEFT  JOIN estado           e   ON e.id_estado     = s.id_estado
        LEFT  JOIN medios_pago      mp  ON mp.id_medio_pago = p.id_medio_pago
        WHERE p.estado = 'pagado'
          AND YEAR(p.fecha_pago) = :anio
        ORDER BY p.fecha_pago ASC, p.id_pago ASC
    ";
    $stPag = $pdo->prepare($sqlPagados);
    $stPag->bindValue(':anio', $anioAplicado, PDO::PARAM_INT);
    $stPag->execute();
    $pagos = $stPag->fetchAll(PDO::FETCH_ASSOC);

    // ===================== Pagos 'condonados' (compat UI) =====================
    $sqlCond = "
        SELECT
            p.id_pago,
            p.id_socio,
            p.id_periodo,
            p.fecha_pago,
            p.estado,
            p.monto,
            p.id_medio_pago,
            mp.nombre              AS medio_pago_nombre,
            s.nombre               AS socio_nombre,
            s.id_cobrador          AS socio_id_cobrador,
            s.id_cat_monto         AS socio_id_cat_monto,
            s.id_estado            AS socio_estado_id,
            e.descripcion          AS socio_estado_desc,
            cb.nombre              AS cobrador_nombre,
            per.nombre             AS periodo_nombre,
            cm.nombre_categoria    AS nombre_categoria,
            cm.monto_mensual       AS monto_base_m,
            cm.monto_anual         AS monto_base_a
        FROM pagos p
        INNER JOIN socios           s   ON s.id_socio     = p.id_socio
        INNER JOIN periodo          per ON per.id_periodo = p.id_periodo
        LEFT  JOIN cobrador         cb  ON cb.id_cobrador = s.id_cobrador
        LEFT  JOIN categoria_monto  cm  ON cm.id_cat_monto = s.id_cat_monto
        LEFT  JOIN estado           e   ON e.id_estado     = s.id_estado
        LEFT  JOIN medios_pago      mp  ON mp.id_medio_pago = p.id_medio_pago
        WHERE p.estado = 'condonado'
          AND YEAR(p.fecha_pago) = :anio
        ORDER BY p.fecha_pago ASC, p.id_pago ASC
    ";
    $stCond = $pdo->prepare($sqlCond);
    $stCond->bindValue(':anio', $anioAplicado, PDO::PARAM_INT);
    $stCond->execute();
    $condonadosRaw = $stCond->fetchAll(PDO::FETCH_ASSOC);

    // ===================== Armar 'datos' por período =====================
    $porPeriodo = [];

    foreach ($pagos as $r) {
        $periodoNombre = (string)$r['periodo_nombre'];

        if (!isset($porPeriodo[$periodoNombre])) {
            $porPeriodo[$periodoNombre] = [
                'nombre' => $periodoNombre,
                'pagos'  => [],
            ];
        }

        $porPeriodo[$periodoNombre]['pagos'][] = [
            'ID_Socio'           => (int)$r['id_socio'],
            'Socio'              => (string)$r['socio_nombre'],
            'Precio'             => (float)($r['monto'] ?? 0),               // usa pagos.monto
            'Tipo_Precio'        => ((int)$r['id_periodo'] === 7 ? 'A' : 'M'),
            'Categoria_Id'       => (int)($r['socio_id_cat_monto'] ?? 0),
            'Nombre_Categoria'   => (string)($r['nombre_categoria'] ?? ''),
            'Monto_Base_M'       => (float)($r['monto_base_m'] ?? 0),
            'Monto_Base_A'       => (float)($r['monto_base_a'] ?? 0),
            'Cobrador'           => (string)($r['cobrador_nombre'] ?? ''),
            'fechaPago'          => (string)($r['fecha_pago'] ?? ''),
            'Mes_Pagado'         => $periodoNombre,
            'Estado'             => (string)$r['estado'],
            // NUEVO: estado del socio para poder desglosar ACTIVO / PASIVO en el frontend
            'Estado_Socio'       => (string)($r['socio_estado_desc'] ?? ''),
            'Estado_Socio_Id'    => (int)($r['socio_estado_id'] ?? 0),
            // NUEVO: medio de pago (para desglosar OFICINA -> transf / efectivo)
            'Medio_Pago_Id'      => (int)($r['id_medio_pago'] ?? 0),
            'Medio_Pago'         => (string)($r['medio_pago_nombre'] ?? ''),
        ];
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
