<?php
// modules/cuotas/registrar_pago.php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json; charset=utf-8');

const ID_CONTADO_ANUAL     = 7;
const PERIODOS_BIMESTRALES = [1,2,3,4,5,6];
const MESES_ANIO           = 6;

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  echo json_encode(['exito'=>false,'mensaje'=>'Método no permitido'], JSON_UNESCAPED_UNICODE);
  exit;
}

/* === Config PDO seguro === */
try { $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION); } catch (Throwable $e) {}

/* === Normalizador decimal robusto === */
function dec_str($val) {
  if ($val === null) return null;
  $s = preg_replace('/[^0-9,\.\-]/', '', (string)$val);
  if ($s === '' || $s === '-' || $s === '.' || $s === '-.') return null;

  // "1.234,56" -> "1234,56" -> "1234.56"
  if (strpos($s, ',') !== false && strpos($s, '.') !== false) {
    $s = str_replace('.', '', $s);
    $s = str_replace(',', '.', $s);
  } else {
    $s = str_replace(',', '.', $s);
  }
  return number_format((float)$s, 2, '.', '');
}

/* === Períodos -> fecha de referencia histórica === */
function fecha_referencia_por_periodo(int $anio, int $id_periodo): string {
  // Para que un cambio hecho dentro del bimestre impacte desde ese mismo bimestre,
  // comparamos contra el ÚLTIMO día del período.
  if ($id_periodo === ID_CONTADO_ANUAL || $id_periodo <= 0) {
    return sprintf('%04d-12-31', $anio);
  }

  $mapFinMes = [1 => 2, 2 => 4, 3 => 6, 4 => 8, 5 => 10, 6 => 12];
  $mesFin = $mapFinMes[$id_periodo] ?? 12;
  $ultimoDia = (int)date('t', strtotime(sprintf('%04d-%02d-01', $anio, $mesFin)));
  return sprintf('%04d-%02d-%02d', $anio, $mesFin, $ultimoDia);
}

/* === Precio histórico por categoría / tipo / período === */
function precio_historico_por_tipo(PDO $pdo, int $id_cat_monto, string $tipo, string $fecha_ref, $fallback) {
  $fallback = dec_str($fallback ?? 0);

  // 1) Último cambio que ya aplica para ese período.
  $st = $pdo->prepare("
    SELECT precio_viejo, precio_nuevo, fecha_cambio
    FROM precios_historicos
    WHERE id_cat_monto = ?
      AND tipo = ?
      AND fecha_cambio <= ?
    ORDER BY fecha_cambio DESC, id_historial DESC
    LIMIT 1
  ");
  $st->execute([$id_cat_monto, $tipo, $fecha_ref]);
  $row = $st->fetch(PDO::FETCH_ASSOC);
  if ($row) return dec_str($row['precio_nuevo']);

  // 2) Si todavía no había cambios para ese período, usar el precio viejo del primer cambio.
  $st = $pdo->prepare("
    SELECT precio_viejo, precio_nuevo, fecha_cambio
    FROM precios_historicos
    WHERE id_cat_monto = ?
      AND tipo = ?
    ORDER BY fecha_cambio ASC, id_historial ASC
    LIMIT 1
  ");
  $st->execute([$id_cat_monto, $tipo]);
  $first = $st->fetch(PDO::FETCH_ASSOC);
  if ($first && $fecha_ref < $first['fecha_cambio']) return dec_str($first['precio_viejo']);
  if ($first) return dec_str($first['precio_nuevo']);

  // 3) Sin historial: monto actual de categoria_monto.
  return $fallback;
}

/* === Obtención de montos históricos desde la DB por socio + año + período === */
function obtener_montos_por_socio(PDO $pdo, int $id_socio, int $anio, int $id_periodo): array {
  $fechaRef = fecha_referencia_por_periodo($anio, $id_periodo);

  // Esquema nuevo: categoria_monto + precios_historicos
  $sql = "
    SELECT
      cm.id_cat_monto,
      cm.monto_mensual AS mensual_actual,
      cm.monto_anual AS anual_actual
    FROM socios s
    LEFT JOIN categoria_monto cm ON cm.id_cat_monto = s.id_cat_monto
    WHERE s.id_socio = ?
    LIMIT 1
  ";
  $st = $pdo->prepare($sql);
  $st->execute([$id_socio]);
  $row = $st->fetch(PDO::FETCH_ASSOC);

  if ($row && !empty($row['id_cat_monto'])) {
    $idCatMonto = (int)$row['id_cat_monto'];
    $mensualActual = $row['mensual_actual'] ?? 0;
    $anualActual   = $row['anual_actual'] ?? 0;

    return [
      'mensual' => precio_historico_por_tipo($pdo, $idCatMonto, 'mensual', $fechaRef, $mensualActual),
      'anual'   => precio_historico_por_tipo($pdo, $idCatMonto, 'anual',   $fechaRef, $anualActual),
      'fecha_ref' => $fechaRef,
      'id_cat_monto' => $idCatMonto,
    ];
  }

  // Fallback viejo: tabla categorias, solo si existe en otra instalación.
  try {
    $sql2 = "
      SELECT c.monto AS mensual, c.monto_anual AS anual
      FROM socios s
      LEFT JOIN categorias c ON c.idCategorias = s.idCategoria
      WHERE s.id_socio = ?
      LIMIT 1
    ";
    $st2 = $pdo->prepare($sql2);
    $st2->execute([$id_socio]);
    $old = $st2->fetch(PDO::FETCH_ASSOC) ?: ['mensual'=>null,'anual'=>null];
  } catch (Throwable $e) {
    $old = ['mensual'=>null,'anual'=>null];
  }

  return [
    'mensual' => ($old['mensual'] !== null) ? dec_str($old['mensual']) : null,
    'anual'   => ($old['anual']   !== null) ? dec_str($old['anual'])   : null,
    'fecha_ref' => $fechaRef,
    'id_cat_monto' => null,
  ];
}

/* === INPUT === */
$in        = json_decode(file_get_contents("php://input"), true) ?? [];
$id_socio  = (int)($in['id_socio'] ?? 0);
$periodos  = array_map('intval', $in['periodos'] ?? []);
$condonar  = !empty($in['condonar']);

$monto           = $in['monto'] ?? null;             // total (anual o barras)
$montoPorPeriodo = $in['monto_por_periodo'] ?? null; // unitario (bimestres)

/* medio_pago puede llegar como ID o como TEXTO (TRANSFERENCIA, EFECTIVO, etc.) */
$idMedioPagoInput = isset($in['id_medio_pago']) ? (int)$in['id_medio_pago'] : 0;
$medioPagoNombre  = isset($in['medio_pago']) ? trim((string)$in['medio_pago']) : '';

/* ✅ En condonación NO corresponde medio de pago: no hubo cobro real. */
if ($condonar) {
  $idMedioPagoInput = 0;
  $medioPagoNombre  = '';
}

/**
 * anioSel = año "lógico" al que se aplica el pago (para reglas/bloqueos/consultas).
 * PERO la fecha guardada SIEMPRE es la fecha real de hoy.
 * ✅ Se guarda en pagos.anio_aplicado
 */
$anioSel   = isset($in['anio']) ? (int)$in['anio'] : (int)date('Y');
if ($anioSel < 2000 || $anioSel > 2100) { $anioSel = (int)date('Y'); }

/* ✅ FECHA REAL (hoy) SIEMPRE */
$fechaPago = date('Y-m-d');

if ($id_socio <= 0 || empty($periodos)) {
  echo json_encode(['exito'=>false,'mensaje'=>'Datos incompletos'], JSON_UNESCAPED_UNICODE);
  exit;
}

$set = array_values(array_unique($periodos));
sort($set, SORT_NUMERIC);

$incluyeAnual = in_array(ID_CONTADO_ANUAL, $set, true);
$soloBimestresDelAnio =
  empty(array_diff($set, PERIODOS_BIMESTRALES)) &&
  count(array_intersect($set, PERIODOS_BIMESTRALES)) === count(PERIODOS_BIMESTRALES);

$estadoNuevo = $condonar ? 'condonado' : 'pagado';

/* ===== Normalizar decimales ===== */
$monto           = dec_str($monto);
$montoPorPeriodo = dec_str($montoPorPeriodo);

/* ===== Resolver id_medio_pago (solo si no es condonación) ===== */
$id_medio_pago = null;

if (!$condonar) {
  if ($idMedioPagoInput > 0) {
    $id_medio_pago = $idMedioPagoInput;
  } elseif ($medioPagoNombre !== '') {
    $sqlMP = "SELECT id_medio_pago FROM medios_pago WHERE nombre = ? LIMIT 1";
    $stMP  = $pdo->prepare($sqlMP);
    $stMP->execute([$medioPagoNombre]);
    $rowMP = $stMP->fetch(PDO::FETCH_ASSOC);
    if ($rowMP) $id_medio_pago = (int)$rowMP['id_medio_pago'];
  }
}

/* ===== Si NO es condonación, calcular montos del lado servidor ===== */
if (!$condonar) {
  if ($incluyeAnual || $soloBimestresDelAnio) {
    // Anual histórico para el año aplicado. No dependemos del monto enviado por el frontend.
    $montosAnual = obtener_montos_por_socio($pdo, $id_socio, $anioSel, ID_CONTADO_ANUAL);

    if ($montosAnual['anual'] !== null && (float)$montosAnual['anual'] > 0) {
      $monto = $montosAnual['anual'];
    } elseif ($montosAnual['mensual'] !== null && (float)$montosAnual['mensual'] > 0) {
      $monto = dec_str((float)$montosAnual['mensual'] * MESES_ANIO);
    }

    if ($monto === null || (float)$monto <= 0) {
      echo json_encode(['exito'=>false,'mensaje'=>'No se pudo determinar el monto anual histórico.'], JSON_UNESCAPED_UNICODE);
      exit;
    }
  }
  // Para bimestres, el monto se calcula dentro del foreach porque puede cambiar entre períodos.
}

/* Si condona, montos = 0 e id_medio_pago en NULL */
if ($condonar) {
  $monto           = dec_str(0);
  $montoPorPeriodo = dec_str(0);
  $id_medio_pago   = null;
}

try {
  $pdo->beginTransaction();

  // ✅ mirar anual por anio_aplicado, no por YEAR(fecha_pago)
  $stTieneAnual = $pdo->prepare("
    SELECT id_pago, estado
    FROM pagos
    WHERE id_socio = ? AND id_periodo = ? AND anio_aplicado = ?
    LIMIT 1
  ");
  $stTieneAnual->execute([$id_socio, ID_CONTADO_ANUAL, $anioSel]);
  $rowAnual = $stTieneAnual->fetch(PDO::FETCH_ASSOC);

  /* ===== ANUAL ===== */
  if ($incluyeAnual || $soloBimestresDelAnio) {
    // borrar bimestres del mismo año aplicado
    $delBims = $pdo->prepare("
      DELETE FROM pagos
      WHERE id_socio = ? AND id_periodo IN (1,2,3,4,5,6) AND anio_aplicado = ?
    ");
    $delBims->execute([$id_socio, $anioSel]);

    if ($monto === null || (float)$monto <= 0) { $monto = dec_str(0); }

    if ($rowAnual) {
      $upd = $pdo->prepare("
        UPDATE pagos
        SET estado = ?, fecha_pago = ?, monto = ?, id_medio_pago = ?, anio_aplicado = ?
        WHERE id_pago = ?
      ");
      $upd->execute([$estadoNuevo, $fechaPago, $monto, $id_medio_pago, $anioSel, (int)$rowAnual['id_pago']]);
    } else {
      $ins = $pdo->prepare("
        INSERT INTO pagos (id_socio, id_periodo, anio_aplicado, fecha_pago, estado, monto, id_medio_pago)
        VALUES (?,?,?,?,?,?,?)
      ");
      $ins->execute([$id_socio, ID_CONTADO_ANUAL, $anioSel, $fechaPago, $estadoNuevo, $monto, $id_medio_pago]);
    }

    $pdo->commit();
    $mensajeOk = $condonar
      ? "Condonación anual ($anioSel) registrada correctamente."
      : "Pago anual ($anioSel) registrado correctamente.";

    echo json_encode(['exito'=>true, 'mensaje'=>$mensajeOk, 'monto_aplicado'=>$monto], JSON_UNESCAPED_UNICODE);
    exit;
  }

  /* ===== BIMESTRES ===== */
  if ($rowAnual) {
    $pdo->rollBack();
    echo json_encode([
      'exito'=>false,
      'mensaje'=>"Ya existe pago anual en $anioSel. Quitalo para registrar bimestres."
    ], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($montoPorPeriodo === null || (float)$montoPorPeriodo <= 0) {
    $montoPorPeriodo = dec_str(0);
  }

  $ins = $pdo->prepare("
    INSERT INTO pagos (id_socio, id_periodo, anio_aplicado, fecha_pago, estado, monto, id_medio_pago)
    VALUES (?,?,?,?,?,?,?)
  ");
  $sel = $pdo->prepare("
    SELECT id_pago FROM pagos
    WHERE id_socio = ? AND id_periodo = ? AND anio_aplicado = ?
    LIMIT 1
  ");

  $insertados = [];
  $ya         = [];
  $errores    = [];
  $montosAplicados = [];

  foreach ($set as $p) {
    if (!in_array($p, PERIODOS_BIMESTRALES, true)) continue;

    $sel->execute([$id_socio, $p, $anioSel]);
    if ($sel->fetch()) { $ya[] = $p; continue; }

    $montoPeriodo = dec_str(0);
    if (!$condonar) {
      $montosPeriodo = obtener_montos_por_socio($pdo, $id_socio, $anioSel, $p);
      if ($montosPeriodo['mensual'] !== null && (float)$montosPeriodo['mensual'] > 0) {
        $montoPeriodo = $montosPeriodo['mensual'];
      } elseif ($montoPorPeriodo !== null && (float)$montoPorPeriodo > 0) {
        // Fallback defensivo si la instalación no tiene historial/categoria_monto.
        $montoPeriodo = $montoPorPeriodo;
      }

      if ($montoPeriodo === null || (float)$montoPeriodo <= 0) {
        $errores[] = ['periodo'=>$p, 'mensaje'=>'No se pudo determinar el monto histórico del período.'];
        continue;
      }
    }

    try {
      $ins->execute([$id_socio, $p, $anioSel, $fechaPago, $estadoNuevo, $montoPeriodo, $id_medio_pago]);
      $insertados[] = $p;
      $montosAplicados[$p] = $montoPeriodo;
    } catch (Throwable $e) {
      $errores[] = ['periodo'=>$p, 'mensaje'=>$e->getMessage()];
    }
  }

  $pdo->commit();
  $ok = !empty($insertados) && empty($errores);

  echo json_encode([
    'exito'          => $ok,
    'mensaje'        => $ok
      ? ($condonar ? "Condonación(es) registrada(s) para $anioSel." : "Pago(s) registrados para $anioSel.")
      : "Hubo problemas en algunos períodos.",
    'insertados'     => $insertados,
    'ya_registrados' => $ya,
    'montos_aplicados' => $montosAplicados,
    'errores'        => $errores
  ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  echo json_encode(['exito'=>false,'mensaje'=>'Error al registrar: '.$e->getMessage()], JSON_UNESCAPED_UNICODE);
}