<?php
require_once(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json');

$id_socio   = isset($_GET['id_socio'])   ? (int)$_GET['id_socio']   : 0;
$id_periodo = isset($_GET['id_periodo']) ? (int)$_GET['id_periodo'] : 0;

if ($id_socio <= 0 || $id_periodo <= 0) {
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Faltan datos del código (socio o período)'
    ]);
    exit;
}

/** 1..6 = bimestrales, 7 = CONTADO ANUAL (todo el año) */
function obtenerUltimoMesDePeriodo(int $id_periodo): int {
    $mapa = [1=>2, 2=>4, 3=>6, 4=>8, 5=>10, 6=>12, 7=>12];
    return $mapa[$id_periodo] ?? 0;
}

try {
    // Socio activo
    $stmt = $pdo->prepare("
        SELECT 
            s.id_socio,
            s.nombre,
            s.domicilio,
            s.numero,
            s.telefono_movil,
            s.telefono_fijo,
            s.domicilio_cobro,
            s.dni,
            s.id_categoria,
            s.ingreso,
            cat.descripcion AS categoria
        FROM socios s
        JOIN categoria cat ON s.id_categoria = cat.id_categoria
        WHERE s.id_socio = :id_socio
          AND s.activo = 1
        LIMIT 1
    ");
    $stmt->bindValue(':id_socio', $id_socio, PDO::PARAM_INT);
    $stmt->execute();
    $socio = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$socio) {
        echo json_encode(['exito' => false, 'mensaje' => 'No se encontró ningún socio activo con ese ID']);
        exit;
    }

    // Elegibilidad por ingreso (hasta fin del período en año actual)
    $fechaIngreso        = $socio['ingreso'];
    $ultimoMesDelPeriodo = obtenerUltimoMesDePeriodo($id_periodo);
    $anioActual          = (int)date('Y');
    if ($fechaIngreso && $fechaIngreso !== '0000-00-00') {
        $anioIngreso = (int)date('Y', strtotime($fechaIngreso));
        $mesIngreso  = (int)date('n', strtotime($fechaIngreso));
        if ($anioIngreso === $anioActual && $mesIngreso > $ultimoMesDelPeriodo) {
            echo json_encode([
                'exito'   => false,
                'mensaje' => "El socio {$socio['nombre']} aún no estaba registrado en ese período"
            ]);
            exit;
        }
    }

    // Reglas: 7 vs 1..6 (pero sin cortar: devolvemos bloqueado)
    $stmtPagos = $pdo->prepare("SELECT id_periodo FROM pagos WHERE id_socio = ?");
    $stmtPagos->execute([$id_socio]);
    $periodosPagados = array_map('intval', $stmtPagos->fetchAll(PDO::FETCH_COLUMN));

    $tieneAnual     = in_array(7, $periodosPagados, true);
    $tieneBimestral = false;
    foreach ($periodosPagados as $p) { if ($p >= 1 && $p <= 6) { $tieneBimestral = true; break; } }

    $bloquea_anual     = $tieneBimestral;
    $bloquea_bimestral = $tieneAnual;

    $bloqueado = false;
    $motivo    = null;
    if ($id_periodo === 7 && $bloquea_anual) {
        $bloqueado = true;
        $motivo = 'No se puede pagar Contado Anual: ya existen períodos bimestrales pagados/condonados.';
    } elseif ($id_periodo >= 1 && $id_periodo <= 6 && $bloquea_bimestral) {
        $bloqueado = true;
        $motivo = 'No se puede pagar períodos bimestrales: el Contado Anual ya fue pagado/condonado.';
    }

    // Enriquecer socio
    $socio['domicilio_completo'] = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));
    $socio['telefono']           = $socio['telefono_movil'] ?: ($socio['telefono_fijo'] ?? '');
    $socio['monto']              = ($id_periodo === 7) ? 21000 : 4000;

    echo json_encode([
        'exito'             => true,
        'socio'             => $socio,
        'bloqueado'         => $bloqueado,
        'motivo_bloqueo'    => $motivo,
        'bloquea_anual'     => $bloquea_anual,
        'bloquea_bimestral' => $bloquea_bimestral,
        'periodos_pagados'  => $periodosPagados
    ]);

} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error SQL: ' . $e->getMessage()]);
}
