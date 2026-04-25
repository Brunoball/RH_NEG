<?php
// backend/modules/socios/estado_pagos_socios.php
//
// Calcula el estado real de pago por socio usando los períodos bimestrales 1..6.
// IMPORTANTE:
// - id_periodo = 7 (contado anual) NO se considera una deuda independiente.
// - id_periodo = 7 cubre los períodos 1..6 del año aplicado.
// - El año del pago se toma desde anio_aplicado. Si no existe, se usa fecha_pago.

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

try {
    require_once __DIR__ . '/../../config/db.php';

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $anioActual    = (int) date('Y');
    $mesActual     = (int) date('n');
    $periodoActual = (int) ceil($mesActual / 2); // 1..6

    // =========================
    // 1) Obtener socios activos
    // =========================
    $stmtSocios = $pdo->query("
        SELECT id_socio, ingreso
        FROM socios
        WHERE activo = 1
        ORDER BY id_socio ASC
    ");
    $socios = $stmtSocios->fetchAll(PDO::FETCH_ASSOC);

    if (!$socios) {
        echo json_encode([
            'exito'   => true,
            'estados' => [],
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================
    // 2) Traer TODOS los pagos válidos de socios activos
    // =========================
    $stmtPagos = $pdo->query("
        SELECT
            p.id_socio,
            p.id_periodo,
            p.anio_aplicado,
            p.fecha_pago
        FROM pagos p
        INNER JOIN socios s ON s.id_socio = p.id_socio
        WHERE s.activo = 1
          AND p.estado = 'pagado'
          AND (p.fecha_pago IS NOT NULL OR p.anio_aplicado IS NOT NULL)
    ");

    $pagosPorSocio = [];
    while ($row = $stmtPagos->fetch(PDO::FETCH_ASSOC)) {
        $idSocio = (int) ($row['id_socio'] ?? 0);
        if ($idSocio <= 0) {
            continue;
        }
        $pagosPorSocio[$idSocio][] = $row;
    }

    $resultado = [];

    foreach ($socios as $socio) {
        $idSocio = (int) ($socio['id_socio'] ?? 0);

        // -------------------------
        // Fecha de ingreso / inicio
        // -------------------------
        if (!empty($socio['ingreso'])) {
            $fechaIngreso = new DateTime((string) $socio['ingreso']);
        } else {
            // Fallback conservador: 1/1 del año actual
            // (si querés más agresivo, podés volver al año anterior)
            $fechaIngreso = new DateTime($anioActual . '-01-01');
        }

        $anioIngreso    = (int) $fechaIngreso->format('Y');
        $mesIngreso     = (int) $fechaIngreso->format('n');
        $periodoIngreso = (int) ceil($mesIngreso / 2);

        // Si ingresó en el futuro, no debe nada
        if ($anioIngreso > $anioActual || ($anioIngreso === $anioActual && $periodoIngreso > $periodoActual)) {
            $resultado[] = [
                'id_socio'            => $idSocio,
                'ultimo_periodo'      => 0,
                'deuda_periodos'      => 0,
                'estado_pago'         => 'AL_DIA',
                'periodos_faltantes'  => [],
            ];
            continue;
        }

        // =====================================================
        // 3) Construir mapa de períodos pagados del socio
        // =====================================================
        // Clave: "YYYY-P" donde P = 1..6
        $periodosPagados = [];

        foreach ($pagosPorSocio[$idSocio] ?? [] as $pago) {
            $idPeriodo = (int) ($pago['id_periodo'] ?? 0);

            // Año correcto del pago: primero anio_aplicado, si no hay, fecha_pago
            $anioAplicado = isset($pago['anio_aplicado']) ? (int) $pago['anio_aplicado'] : 0;
            if ($anioAplicado <= 0) {
                $fechaPago = !empty($pago['fecha_pago']) ? new DateTime((string) $pago['fecha_pago']) : null;
                $anioAplicado = $fechaPago ? (int) $fechaPago->format('Y') : 0;
            }

            if ($anioAplicado <= 0) {
                continue;
            }

            // Ignorar pagos anteriores al ingreso o muy futuros
            if ($anioAplicado < $anioIngreso || $anioAplicado > $anioActual) {
                continue;
            }

            if ($idPeriodo === 7) {
                // Contado anual cubre 1..6 de ese año
                for ($per = 1; $per <= 6; $per++) {
                    if (
                        ($anioAplicado === $anioIngreso && $per < $periodoIngreso) ||
                        ($anioAplicado === $anioActual && $per > $periodoActual)
                    ) {
                        continue;
                    }

                    $periodosPagados[$anioAplicado . '-' . $per] = true;
                }
                continue;
            }

            if ($idPeriodo >= 1 && $idPeriodo <= 6) {
                if (
                    ($anioAplicado === $anioIngreso && $idPeriodo < $periodoIngreso) ||
                    ($anioAplicado === $anioActual && $idPeriodo > $periodoActual)
                ) {
                    continue;
                }

                $periodosPagados[$anioAplicado . '-' . $idPeriodo] = true;
            }
        }

        // =====================================================
        // 4) Calcular faltantes reales
        // =====================================================
        $faltantes = [];
        $ultimoPeriodoPagado = 0;
        $ultimoAnioPagado = 0;

        for ($anio = $anioIngreso; $anio <= $anioActual; $anio++) {
            $desde = ($anio === $anioIngreso) ? $periodoIngreso : 1;
            $hasta = ($anio === $anioActual) ? $periodoActual : 6;

            for ($per = $desde; $per <= $hasta; $per++) {
                $clave = $anio . '-' . $per;

                if (!isset($periodosPagados[$clave])) {
                    $faltantes[] = [
                        'anio'       => $anio,
                        'id_periodo' => $per,
                    ];
                    continue;
                }

                if ($anio > $ultimoAnioPagado || ($anio === $ultimoAnioPagado && $per > $ultimoPeriodoPagado)) {
                    $ultimoAnioPagado = $anio;
                    $ultimoPeriodoPagado = $per;
                }
            }
        }

        $deudaTotal = count($faltantes);

        // Si existe al menos un faltante de un año anterior => 3 o más
        $deudaAnioAnterior = false;
        foreach ($faltantes as $f) {
            if ((int) $f['anio'] < $anioActual) {
                $deudaAnioAnterior = true;
                break;
            }
        }

        if ($deudaTotal === 0) {
            $estado = 'AL_DIA';
        } elseif ($deudaAnioAnterior) {
            $estado = 'DEBE_3_MAS';
        } elseif ($deudaTotal <= 2) {
            $estado = 'DEBE_1_2';
        } else {
            $estado = 'DEBE_3_MAS';
        }

        $resultado[] = [
            'id_socio'           => $idSocio,
            'ultimo_periodo'     => $ultimoPeriodoPagado,
            'deuda_periodos'     => $deudaTotal,
            'estado_pago'        => $estado,
            'periodos_faltantes' => $faltantes,
        ];
    }

    echo json_encode([
        'exito'   => true,
        'estados' => $resultado,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al obtener estado de pagos: ' . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
