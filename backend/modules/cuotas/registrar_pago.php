<?php
// modules/cuotas/registrar_pago.php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

const ID_CONTADO_ANUAL = 7;
const PERIODOS_BIMESTRALES = [1,2,3,4,5,6];
const MESES_ANIO = 6;

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  echo json_encode(['exito'=>false,'mensaje'=>'Método no permitido']); exit;
}

/* === Config PDO seguro === */
try {
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (Throwable $e) {}

/* === Normalizador decimal robusto === */
function dec_str($val) {
  if ($val === null) return null;
  $s = preg_replace('/[^0-9,\.\-]/', '', (string)$val);
  if ($s === '' || $s === '-' || $s === '.' || $s === '-.') return null;
  if (strpos($s, ',') !== false && strpos($s, '.') !== false) {
    $s = str_replace(',', '', $s);     // "1.234,56" -> "1234,56"  (raro)
    $s = str_replace(',', '.', $s);    // por si quedó
  } else {
    $s = str_replace(',', '.', $s);    // "1234,56" -> "1234.56"
  }
  return number_format((float)$s, 2, '.', '');
}

/* === Obtención “oficial” de montos desde la DB por socio ===
   Ajustá nombres de tabla/columnas si difieren en tu esquema. */
function obtener_montos_por_socio(PDO $pdo, int $id_socio): array {
  // Intenta via id_cat_monto (esquema nuevo)
  $sql = "
    SELECT cm.monto_mensual AS mensual, cm.monto_anual AS anual
    FROM socios s
    LEFT JOIN categoria_monto cm ON cm.id_cat_monto = s.id_cat_monto
    WHERE s.id_socio = ?
    LIMIT 1
  ";
  $st = $pdo->prepare($sql);
  $st->execute([$id_socio]);
  $row = $st->fetch(PDO::FETCH_ASSOC);

  // Fallback: tabla categorias con precio/monto (por compatibilidad)
  if (!$row || ($row['mensual'] === null && $row['anual'] === null)) {
    $sql2 = "
      SELECT c.monto AS mensual, c.monto_anual AS anual
      FROM socios s
      LEFT JOIN categorias c ON c.idCategorias = s.idCategoria
      WHERE s.id_socio = ?
      LIMIT 1
    ";
    $st2 = $pdo->prepare($sql2);
    $st2->execute([$id_socio]);
    $row = $st2->fetch(PDO::FETCH_ASSOC) ?: ['mensual'=>null,'anual'=>null];
  }

  $mensual = $row && $row['mensual'] !== null ? dec_str($row['mensual']) : null;
  $anual   = $row && $row['anual']   !== null ? dec_str($row['anual'])   : null;
  return ['mensual'=>$mensual, 'anual'=>$anual];
}

/* === INPUT === */
$in        = json_decode(file_get_contents("php://input"), true) ?? [];
$id_socio  = (int)($in['id_socio'] ?? 0);
$periodos  = array_map('intval', $in['periodos'] ?? []);
$condonar  = !empty($in['condonar']);

$monto           = $in['monto'] ?? null;             // total (anual o barras)
$montoPorPeriodo = $in['monto_por_periodo'] ?? null; // unitario (bimestres)

$anioSel   = isset($in['anio']) ? (int)$in['anio'] : (int)date('Y');
if ($anioSel < 2000 || $anioSel > 2100) { $anioSel = (int)date('Y'); }

$fechaPago = sprintf('%04d-%02d-%02d', $anioSel, (int)date('m'), (int)date('d'));

if ($id_socio <= 0 || empty($periodos)) {
  echo json_encode(['exito'=>false,'mensaje'=>'Datos incompletos']); exit;
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

/* ===== Si NO es condonación, NUNCA aceptar 0 o null:
         calculamos del lado servidor según categoría ===== */
if (!$condonar) {
  $montos = obtener_montos_por_socio($pdo, $id_socio);

  if ($incluyeAnual || $soloBimestresDelAnio) {
    // Si no vino total válido, intentar anual o 6 * mensual
    if ($monto === null || (float)$monto <= 0) {
      if ($montos['anual'] !== null && (float)$montos['anual'] > 0) {
        $monto = $montos['anual'];
      } elseif ($montos['mensual'] !== null && (float)$montos['mensual'] > 0) {
        $monto = dec_str((float)$montos['mensual'] * MESES_ANIO);
      }
    }
    if ($monto === null || (float)$monto <= 0) {
      echo json_encode(['exito'=>false,'mensaje'=>'No se pudo determinar el monto anual.']); exit;
    }
  } else {
    // Bimestres: si no vino unitario válido, usar mensual; si tampoco, error
    if ($montoPorPeriodo === null || (float)$montoPorPeriodo <= 0) {
      if ($montos['mensual'] !== null && (float)$montos['mensual'] > 0) {
        $montoPorPeriodo = $montos['mensual'];
      }
    }
    if ($montoPorPeriodo === null || (float)$montoPorPeriodo <= 0) {
      echo json_encode(['exito'=>false,'mensaje'=>'No se pudo determinar el monto por período.']); exit;
    }
  }
}

/* Si condona, montos = 0 */
if ($condonar) {
  $monto = dec_str(0);
  $montoPorPeriodo = dec_str(0);
}

try {
  $pdo->beginTransaction();

  $stTieneAnual = $pdo->prepare("
    SELECT id_pago, estado
    FROM pagos
    WHERE id_socio = ? AND id_periodo = ? AND YEAR(fecha_pago) = ?
    LIMIT 1
  ");
  $stTieneAnual->execute([$id_socio, ID_CONTADO_ANUAL, $anioSel]);
  $rowAnual = $stTieneAnual->fetch(PDO::FETCH_ASSOC);

  /* ===== ANUAL ===== */
  if ($incluyeAnual || $soloBimestresDelAnio) {
    $delBims = $pdo->prepare("
      DELETE FROM pagos
      WHERE id_socio = ? AND id_periodo IN (1,2,3,4,5,6) AND YEAR(fecha_pago) = ?
    ");
    $delBims->execute([$id_socio, $anioSel]);

    // Garantía extra
    if ($monto === null || (float)$monto <= 0) { $monto = dec_str(0); }

    if ($rowAnual) {
      $upd = $pdo->prepare("UPDATE pagos SET estado=?, fecha_pago=?, monto=? WHERE id_pago=?");
      $upd->execute([$estadoNuevo, $fechaPago, $monto, (int)$rowAnual['id_pago']]);
    } else {
      $ins = $pdo->prepare("INSERT INTO pagos (id_socio, id_periodo, fecha_pago, estado, monto)
                            VALUES (?,?,?,?,?)");
      $ins->execute([$id_socio, ID_CONTADO_ANUAL, $fechaPago, $estadoNuevo, $monto]);
    }

    $pdo->commit();
    echo json_encode(['exito'=>true, 'mensaje'=>"Pago anual ($anioSel) registrado correctamente."]);
    exit;
  }

  /* ===== BIMESTRES ===== */
  if ($rowAnual) {
    $pdo->rollBack();
    echo json_encode([
      'exito'=>false,
      'mensaje'=>"Ya existe pago anual en $anioSel. Quitalo para registrar bimestres."
    ]);
    exit;
  }

  if ($montoPorPeriodo === null || (float)$montoPorPeriodo <= 0) {
    $montoPorPeriodo = dec_str(0); // (defensa; ya no debería ocurrir)
  }

  $ins = $pdo->prepare("INSERT INTO pagos (id_socio, id_periodo, fecha_pago, estado, monto)
                        VALUES (?,?,?,?,?)");
  $sel = $pdo->prepare("
    SELECT id_pago FROM pagos
    WHERE id_socio=? AND id_periodo=? AND YEAR(fecha_pago)=? LIMIT 1
  ");

  $insertados = []; $ya = []; $errores = [];

  foreach ($set as $p) {
    if (!in_array($p, PERIODOS_BIMESTRALES, true)) continue;

    $sel->execute([$id_socio, $p, $anioSel]);
    if ($sel->fetch()) { $ya[] = $p; continue; }

    try {
      $ins->execute([$id_socio, $p, $fechaPago, $estadoNuevo, $montoPorPeriodo]);
      $insertados[] = $p;
    } catch (Throwable $e) {
      $errores[] = ['periodo'=>$p,'mensaje'=>$e->getMessage()];
    }
  }

  $pdo->commit();
  $ok = !empty($insertados) && empty($errores);
  echo json_encode([
    'exito'=>$ok,
    'mensaje'=>$ok ? "Pago(s) registrados para $anioSel." : "Hubo problemas en algunos períodos.",
    'insertados'=>$insertados, 'ya_registrados'=>$ya, 'errores'=>$errores
  ]);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  echo json_encode(['exito'=>false,'mensaje'=>'Error al registrar: '.$e->getMessage()]);
}
