<?php
// modules/cuotas/buscar_socio_codigo.php
require_once(__DIR__ . '/../../config/db.php');
header('Content-Type: application/json; charset=utf-8');

/**
 * 1..6 = bimestrales, 7 = CONTADO ANUAL
 */
function obtenerUltimoMesDePeriodo($id_periodo) {
  $mapa = array(1=>2, 2=>4, 3=>6, 4=>8, 5=>10, 6=>12, 7=>12);
  return isset($mapa[$id_periodo]) ? (int)$mapa[$id_periodo] : 0;
}

/**
 * Formatos aceptados:
 *  - ?codigo=1251393   → 1 = período, 25 = año (2025), 1393 = ID socio
 *  - ?id_periodo=1&id_socio=251393  → toma 25 como año (2025) y 1393 como ID
 *  - ?id_periodo=1&id_socio=1393&anio=2025  → explícito
 */
function parsearEntrada() {
  // 1) Código completo
  if (isset($_GET['codigo']) && $_GET['codigo'] !== '') {
    $digits = preg_replace('/\D+/', '', (string)$_GET['codigo']);

    if (strlen($digits) < 4) {
      return array(false, 'Código demasiado corto. Formato: [P][AA][ID] (ej: 1251393)');
    }

    $periodo = (int)substr($digits, 0, 1);
    $anio2d  = (int)substr($digits, 1, 2);
    $id_str  = substr($digits, 3);

    if ($periodo < 1 || $periodo > 7 || $id_str === '') {
      return array(false, 'Código inválido.');
    }

    return array(true, array(
      'id_periodo' => $periodo,
      'anio'       => 2000 + $anio2d,
      'id_socio'   => (int)$id_str
    ));
  }

  // 2) Parámetros separados (compat)
  $id_periodo   = isset($_GET['id_periodo']) ? (int)$_GET['id_periodo'] : 0;
  $anio_param   = isset($_GET['anio']) ? (int)$_GET['anio'] : 0;
  $id_socio_raw = isset($_GET['id_socio']) ? (string)$_GET['id_socio'] : '';

  if ($id_periodo < 1 || $id_periodo > 7) {
    return array(false, 'Período inválido.');
  }

  $id_socio_digits = preg_replace('/\D+/', '', $id_socio_raw);
  if ($id_socio_digits === '') {
    return array(false, 'Falta el ID de socio.');
  }

  // Año explícito
  if ($anio_param > 0) {
    return array(true, array(
      'id_periodo' => $id_periodo,
      'anio'       => $anio_param,
      'id_socio'   => (int)$id_socio_digits
    ));
  }

  // Nuevo esquema: AA + ID dentro de id_socio
  if (strlen($id_socio_digits) >= 3) {
    $aa = (int)substr($id_socio_digits, 0, 2);
    $resto = substr($id_socio_digits, 2);
    if ($resto !== '') {
      return array(true, array(
        'id_periodo' => $id_periodo,
        'anio'       => 2000 + $aa,
        'id_socio'   => (int)$resto
      ));
    }
  }

  // Fallback: año actual
  return array(true, array(
    'id_periodo' => $id_periodo,
    'anio'       => (int)date('Y'),
    'id_socio'   => (int)$id_socio_digits
  ));
}

// === Parseo ===
list($ok, $vals) = parsearEntrada();
if (!$ok) {
  echo json_encode(array('exito' => false, 'mensaje' => $vals), JSON_UNESCAPED_UNICODE);
  exit;
}

$id_socio     = (int)$vals['id_socio'];
$id_periodo   = (int)$vals['id_periodo'];
$anioObjetivo = (int)$vals['anio'];

if ($id_socio <= 0) {
  echo json_encode(array('exito' => false, 'mensaje' => 'ID de socio inválido.'), JSON_UNESCAPED_UNICODE);
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
    echo json_encode(array('exito' => false, 'mensaje' => 'No se encontró ningún socio activo con ese ID'), JSON_UNESCAPED_UNICODE);
    exit;
  }

  // Elegibilidad por ingreso contra el AÑO objetivo
  $fechaIngreso        = $socio['ingreso'];
  $ultimoMesDelPeriodo = obtenerUltimoMesDePeriodo($id_periodo);

  if ($fechaIngreso && $fechaIngreso !== '0000-00-00') {
    $anioIngreso = (int)date('Y', strtotime($fechaIngreso));
    $mesIngreso  = (int)date('n', strtotime($fechaIngreso));
    if ($anioIngreso === $anioObjetivo && $mesIngreso > $ultimoMesDelPeriodo) {
      echo json_encode(array(
        'exito'   => false,
        'mensaje' => "El socio {$socio['nombre']} aún no estaba registrado en ese período del año {$anioObjetivo}."
      ), JSON_UNESCAPED_UNICODE);
      exit;
    }
  }

  /**
   * ✅ CLAVE: usar anio_aplicado (fallback a YEAR(fecha_pago) si anio_aplicado=0)
   */
  $stmtPagos = $pdo->prepare("
    SELECT id_periodo
    FROM pagos
    WHERE id_socio = ?
      AND (
        anio_aplicado = ?
        OR (anio_aplicado = 0 AND fecha_pago IS NOT NULL AND YEAR(fecha_pago) = ?)
      )
  ");
  $stmtPagos->execute(array($id_socio, $anioObjetivo, $anioObjetivo));
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

  // Enriquecer datos (sin fijar monto acá, el frontend lo obtiene de /montos)
  $socio['domicilio_completo'] = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));
  $socio['telefono']           = $socio['telefono_movil'] ? $socio['telefono_movil'] : ($socio['telefono_fijo'] ?? '');

  echo json_encode(array(
    'exito'             => true,
    'socio'             => $socio,
    'anio'              => $anioObjetivo,
    'id_periodo'        => $id_periodo,
    'bloqueado'         => $bloqueado,
    'motivo_bloqueo'    => $motivo,
    'bloquea_anual'     => $bloquea_anual,
    'bloquea_bimestral' => $bloquea_bimestral,
    'periodos_pagados'  => $periodosPagados
  ), JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
  echo json_encode(array('exito' => false, 'mensaje' => 'Error SQL: ' . $e->getMessage()), JSON_UNESCAPED_UNICODE);
}