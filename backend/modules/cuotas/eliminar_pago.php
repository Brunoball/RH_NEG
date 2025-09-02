<?php
// modules/cuotas/eliminar_pago.php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json; charset=utf-8');

const ID_CONTADO_ANUAL = 7;

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
  exit;
}

$in         = json_decode(file_get_contents("php://input"), true) ?? [];
$id_socio   = (int)($in['id_socio']   ?? 0);
$id_periodo = (int)($in['id_periodo'] ?? 0);

if ($id_socio <= 0 || $id_periodo <= 0) {
  http_response_code(400);
  echo json_encode(['exito' => false, 'mensaje' => 'Datos incompletos']);
  exit;
}

function respond_json($code, $arr) {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

try {
  $pdo->beginTransaction();

  // 1) ¿Existe pago DIRECTO para el período solicitado?
  $selDirecto = $pdo->prepare("SELECT id_pago FROM pagos WHERE id_socio = ? AND id_periodo = ? LIMIT 1");
  $selDirecto->execute([$id_socio, $id_periodo]);
  $rowDirecto = $selDirecto->fetch(PDO::FETCH_ASSOC);

  if ($rowDirecto) {
    $del = $pdo->prepare("DELETE FROM pagos WHERE id_socio = ? AND id_periodo = ? LIMIT 1");
    $del->execute([$id_socio, $id_periodo]);

    if ($del->rowCount() > 0) {
      $pdo->commit();
      respond_json(200, [
        'exito'            => true,
        'mensaje'          => 'Se eliminó el pago del período seleccionado.',
        'deleted_from'     => 'directo',
        'affected_periods' => [$id_periodo],
      ]);
    } else {
      $pdo->rollBack();
      respond_json(409, [
        'exito'   => false,
        'mensaje' => 'El pago directo ya no existe.',
      ]);
    }
  }

  // 2) Si NO hay directo, ver pago ANUAL
  $selAnual = $pdo->prepare("SELECT id_pago FROM pagos WHERE id_socio = ? AND id_periodo = ? LIMIT 1");
  $selAnual->execute([$id_socio, ID_CONTADO_ANUAL]);
  $rowAnual = $selAnual->fetch(PDO::FETCH_ASSOC);

  if ($rowAnual) {
    $delAnual = $pdo->prepare("DELETE FROM pagos WHERE id_socio = ? AND id_periodo = ? LIMIT 1");
    $delAnual->execute([$id_socio, ID_CONTADO_ANUAL]);

    if ($delAnual->rowCount() > 0) {
      $pdo->commit();
      // Por propagación, impacta en todos los meses del año
      respond_json(200, [
        'exito'            => true,
        'mensaje'          => 'Se eliminó el pago ANUAL del socio. Impacta en todos los períodos del año.',
        'deleted_from'     => 'anual',
        'affected_periods' => [ID_CONTADO_ANUAL, 1, 2, 3, 4, 5, 6],
      ]);
    } else {
      $pdo->rollBack();
      respond_json(409, [
        'exito'   => false,
        'mensaje' => 'No se pudo eliminar el pago anual (ya no existe).',
      ]);
    }
  }

  // 3) No existe ni directo ni anual
  $pdo->rollBack();
  respond_json(404, [
    'exito'   => false,
    'mensaje' => 'No existe un pago registrado para el período indicado ni un pago anual.',
  ]);

} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  respond_json(500, [
    'exito'   => false,
    'mensaje' => 'Error al eliminar: ' . $e->getMessage(),
  ]);
}
