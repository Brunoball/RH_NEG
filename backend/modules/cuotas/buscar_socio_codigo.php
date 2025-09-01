<?php
// modules/cuotas/buscar_socio_codigo.php
require_once(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json');

/**
 * 1..6 = bimestrales, 7 = CONTADO ANUAL
 */
function obtenerUltimoMesDePeriodo(int $id_periodo): int {
    $mapa = [1=>2, 2=>4, 3=>6, 4=>8, 5=>10, 6=>12, 7=>12];
    return $mapa[$id_periodo] ?? 0;
}

/**
 * Formatos aceptados (nuevo esquema):
 *  - ?codigo=1251393   → 1 = período, 25 = año (2025), 1393 = ID socio
 *  - ?id_periodo=1&id_socio=251393  → toma 25 como año (2025) y 1393 como ID
 *  - ?id_periodo=1&id_socio=1393&anio=2025  → explícito
 */
function parsearEntrada(): array {
    // 1) Código completo en un solo parámetro
    if (isset($_GET['codigo']) && $_GET['codigo'] !== '') {
        $digits = preg_replace('/\D+/', '', (string)$_GET['codigo']);
        // Mínimo: 1 (período) + 2 (año) + 1 (id)
        if (strlen($digits) < 4) {
            return [false, 'Código demasiado corto. Formato: [P][AA][ID] (ej: 1251393)'];
        }
        $periodo = (int)substr($digits, 0, 1);
        $anio2d  = (int)substr($digits, 1, 2);
        $id_str  = substr($digits, 3);

        if ($periodo < 1 || $periodo > 7 || $id_str === '') {
            return [false, 'Código inválido.'];
        }
        return [true, [
            'id_periodo' => $periodo,
            'anio'       => 2000 + $anio2d,
            'id_socio'   => (int)$id_str
        ]];
    }

    // 2) Parámetros separados (legacy / compatibles)
    $id_periodo = isset($_GET['id_periodo']) ? (int)$_GET['id_periodo'] : 0;
    $anio_param = isset($_GET['anio']) ? (int)$_GET['anio'] : 0;
    $id_socio_raw = isset($_GET['id_socio']) ? (string)$_GET['id_socio'] : '';

    if ($id_periodo < 1 || $id_periodo > 7) {
        return [false, 'Período inválido.'];
    }

    $id_socio_digits = preg_replace('/\D+/', '', $id_socio_raw);
    if ($id_socio_digits === '') {
        return [false, 'Falta el ID de socio.'];
    }

    // Si viene año explícito, lo usamos
    if ($anio_param > 0) {
        return [true, [
            'id_periodo' => $id_periodo,
            'anio'       => $anio_param,
            'id_socio'   => (int)$id_socio_digits
        ]];
    }

    // Nuevo esquema: los 2 primeros dígitos de id_socio son el AÑO (AA)
    // Ej: "251393" → 2025 y 1393
    if (strlen($id_socio_digits) >= 3) {
        $aa = (int)substr($id_socio_digits, 0, 2);
        $resto = substr($id_socio_digits, 2);
        if ($resto !== '') {
            return [true, [
                'id_periodo' => $id_periodo,
                'anio'       => 2000 + $aa,
                'id_socio'   => (int)$resto
            ]];
        }
    }

    // Fallback (muy legacy): tomar todo como ID y usar año actual
    return [true, [
        'id_periodo' => $id_periodo,
        'anio'       => (int)date('Y'),
        'id_socio'   => (int)$id_socio_digits
    ]];
}

// === Parseo ===
list($ok, $vals) = parsearEntrada();
if (!$ok) {
    echo json_encode(['exito' => false, 'mensaje' => $vals]);
    exit;
}

$id_socio     = (int)$vals['id_socio'];
$id_periodo   = (int)$vals['id_periodo'];
$anioObjetivo = (int)$vals['anio'];

if ($id_socio <= 0) {
    echo json_encode(['exito' => false, 'mensaje' => 'ID de socio inválido.']);
    exit;
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

    // Elegibilidad por ingreso contra el AÑO objetivo
    $fechaIngreso        = $socio['ingreso'];
    $ultimoMesDelPeriodo = obtenerUltimoMesDePeriodo($id_periodo);
    if ($fechaIngreso && $fechaIngreso !== '0000-00-00') {
        $anioIngreso = (int)date('Y', strtotime($fechaIngreso));
        $mesIngreso  = (int)date('n', strtotime($fechaIngreso));
        if ($anioIngreso === $anioObjetivo && $mesIngreso > $ultimoMesDelPeriodo) {
            echo json_encode([
                'exito'   => false,
                'mensaje' => "El socio {$socio['nombre']} aún no estaba registrado en ese período del año {$anioObjetivo}."
            ]);
            exit;
        }
    }

    // Traer pagos/condonaciones del AÑO objetivo
    $stmtPagos = $pdo->prepare("
        SELECT id_periodo
        FROM pagos
        WHERE id_socio = ?
          AND YEAR(fecha_pago) = ?
    ");
    $stmtPagos->execute([$id_socio, $anioObjetivo]);
    $periodosPagados = array_map('intval', $stmtPagos->fetchAll(PDO::FETCH_COLUMN));

    $tieneAnual     = in_array(7, $periodosPagados, true);
    $tieneBimestral = false;
    foreach ($periodosPagados as $p) {
        if ($p >= 1 && $p <= 6) { $tieneBimestral = true; break; }
    }

    $bloquea_anual     = $tieneBimestral;
    $bloquea_bimestral = $tieneAnual;

    $bloqueado = false;
    $motivo    = null;
    if ($id_periodo === 7 && $bloquea_anual) {
        $bloqueado = true;
        $motivo = 'No se puede pagar Contado Anual: ya existen períodos bimestrales pagados/condonados este año.';
    } elseif ($id_periodo >= 1 && $id_periodo <= 6 && $bloquea_bimestral) {
        $bloqueado = true;
        $motivo = 'No se puede pagar períodos bimestrales: el Contado Anual ya fue pagado/condonado este año.';
    }

    // Enriquecer datos
    $socio['domicilio_completo'] = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));
    $socio['telefono']           = $socio['telefono_movil'] ?: ($socio['telefono_fijo'] ?? '');
    $socio['monto']              = ($id_periodo === 7) ? 21000 : 4000;

    echo json_encode([
        'exito'             => true,
        'socio'             => $socio,
        'anio'              => $anioObjetivo,
        'id_periodo'        => $id_periodo,
        'bloqueado'         => $bloqueado,
        'motivo_bloqueo'    => $motivo,
        'bloquea_anual'     => $bloquea_anual,
        'bloquea_bimestral' => $bloquea_bimestral,
        'periodos_pagados'  => $periodosPagados
    ]);

} catch (PDOException $e) {
    echo json_encode(['exito' => false, 'mensaje' => 'Error SQL: ' . $e->getMessage()]);
}
