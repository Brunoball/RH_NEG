<?php
// backend/modules/pagos/estado_pagos_socios.php
//
// CÁLCULO REAL DEL ESTADO DE PAGO POR SOCIO
//
// Estados devueltos:
//   - AL_DIA      → no debe períodos
//   - DEBE_1_2    → debe 1 o 2 períodos
//   - DEBE_3_MAS  → debe 3 o más períodos
//
// Reglas:
//   * Se consideran períodos bimestrales 1..6 por año.
//   * El período actual = CEIL(MONTH(CURDATE()) / 2).
//   * Se cuenta la deuda DESDE la fecha de ingreso del socio.
//   * Si ingreso es NULL, se asume 1/1 del año anterior.
//   * Pagos:
//        - id_periodo 1..6  → 1 período pago.
//        - id_periodo 7     → paga los 6 períodos de ese año,
//                             pero solo se cuentan los que estén
//                             entre ingreso y hoy.
//   * Si tiene deuda en años anteriores al actual → siempre DEBE_3_MAS (rojo).
//

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../../config/db.php'; // $pdo (PDO)

    $anioActual    = (int)date('Y');
    $mesActual     = (int)date('n');
    $periodoActual = (int)ceil($mesActual / 2); // 1..6

    // ==========================
    // 1) Obtener socios activos
    // ==========================
    $socStmt = $pdo->query("
        SELECT id_socio, ingreso
        FROM socios
        WHERE activo = 1
    ");
    $socios = $socStmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$socios) {
        echo json_encode(['exito' => true, 'estados' => []], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // ==========================
    // 2) Preparar query de pagos
    // ==========================
    $pagosStmt = $pdo->prepare("
        SELECT id_periodo, fecha_pago
        FROM pagos
        WHERE id_socio = :id_socio
          AND estado = 'pagado'
          AND fecha_pago IS NOT NULL
    ");

    $resultado = [];

    foreach ($socios as $socio) {
        $idSocio = (int)$socio['id_socio'];

        // ------------------------------
        // Determinar fecha de inicio real
        // ------------------------------
        if (!empty($socio['ingreso'])) {
            $fechaIngreso = new DateTime($socio['ingreso']);
        } else {
            // Si no hay fecha de ingreso, asumimos 1/1 del año anterior
            $fechaIngreso = new DateTime(($anioActual - 1) . '-01-01');
        }

        $anioIngreso    = (int)$fechaIngreso->format('Y');
        $mesIngreso     = (int)$fechaIngreso->format('n');
        $periodoIngreso = (int)ceil($mesIngreso / 2); // 1..6

        // Si por alguna razón la fecha de ingreso es a futuro → no debe nada
        if ($anioIngreso > $anioActual ||
            ($anioIngreso === $anioActual && $periodoIngreso > $periodoActual)) {

            $resultado[] = [
                'id_socio'       => $idSocio,
                'ultimo_periodo' => 0,
                'deuda_periodos' => 0,
                'estado_pago'    => 'AL_DIA',
            ];
            continue;
        }

        // Índices de períodos (año*6 + periodo) para poder recorrer continuo
        $indiceIngreso = $anioIngreso * 6 + $periodoIngreso;
        $indiceActual  = $anioActual * 6 + $periodoActual;

        // Cantidad total de períodos esperados entre ingreso y hoy (inclusive)
        $totalEsperado = max(0, $indiceActual - $indiceIngreso + 1);

        // ==========================
        // 3) Obtener pagos del socio
        // ==========================
        $pagosStmt->execute([':id_socio' => $idSocio]);
        $pagosSocio = $pagosStmt->fetchAll(PDO::FETCH_ASSOC);

        // Mapa de períodos pagados: índice => true
        $periodosPagados = [];

        foreach ($pagosSocio as $p) {
            $idPeriodo = (int)$p['id_periodo'];
            $fechaPago = new DateTime($p['fecha_pago']);
            $anioPago  = (int)$fechaPago->format('Y');

            // Ignorar pagos fuera del rango de años relevante
            if ($anioPago < $anioIngreso || $anioPago > $anioActual) {
                continue;
            }

            if ($idPeriodo === 7) {
                // PAGO ANUAL: marca los 6 períodos de ese año como pagos
                for ($per = 1; $per <= 6; $per++) {
                    $indice = $anioPago * 6 + $per;
                    if ($indice >= $indiceIngreso && $indice <= $indiceActual) {
                        $periodosPagados[$indice] = true;
                    }
                }
            } elseif ($idPeriodo >= 1 && $idPeriodo <= 6) {
                $indice = $anioPago * 6 + $idPeriodo;
                if ($indice >= $indiceIngreso && $indice <= $indiceActual) {
                    $periodosPagados[$indice] = true;
                }
            }
        }

        $totalPagados = count($periodosPagados);
        $deudaTotal   = max(0, $totalEsperado - $totalPagados);

        // ----------------------------------------
        // 4) Detectar si hay deuda de años anteriores
        // ----------------------------------------
        $deudaAnioAnterior = 0;

        if ($anioIngreso < $anioActual) {
            // Índice del último período del año anterior
            $indiceFinAnioAnterior = ($anioActual - 1) * 6 + 6;

            // Rango anterior: desde ingreso hasta fin del año pasado
            $inicioRangoAnt = $indiceIngreso;
            $finRangoAnt    = min($indiceFinAnioAnterior, $indiceActual);

            if ($finRangoAnt >= $inicioRangoAnt) {
                $esperadoAnterior = $finRangoAnt - $inicioRangoAnt + 1;
                $pagadosAnterior  = 0;

                foreach ($periodosPagados as $idx => $_) {
                    if ($idx >= $inicioRangoAnt && $idx <= $finRangoAnt) {
                        $pagadosAnterior++;
                    }
                }

                $deudaAnioAnterior = max(0, $esperadoAnterior - $pagadosAnterior);
            }
        }

        // ----------------------------------------
        // 5) Determinar último período pagado (para info)
        // ----------------------------------------
        $ultimoPeriodo = 0;
        if (!empty($periodosPagados)) {
            $maxIndice = max(array_keys($periodosPagados));
            // Convertir índice a "periodo" dentro del año
            $ultimoPeriodo = $maxIndice % 6;
            if ($ultimoPeriodo === 0) {
                $ultimoPeriodo = 6;
            }
        }

        // ----------------------------------------
        // 6) Clasificar estado
        // ----------------------------------------
        if ($deudaTotal === 0) {
            $estado = 'AL_DIA';
        } elseif ($deudaAnioAnterior > 0) {
            // Cualquier deuda de años anteriores → siempre rojo
            $estado = 'DEBE_3_MAS';
        } elseif ($deudaTotal <= 2) {
            $estado = 'DEBE_1_2';
        } else {
            $estado = 'DEBE_3_MAS';
        }

        $resultado[] = [
            'id_socio'       => $idSocio,
            'ultimo_periodo' => $ultimoPeriodo,
            'deuda_periodos' => $deudaTotal,
            'estado_pago'    => $estado,
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
