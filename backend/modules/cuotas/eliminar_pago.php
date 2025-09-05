<?php
// modules/cuotas/eliminar_pago.php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json; charset=utf-8');

const ID_CONTADO_ANUAL = 7;

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['exito' => false, 'mensaje' => 'Método no permitido']);
  exit;
}

$in         = json_decode(file_get_contents("php://input"), true) ?? [];
$id_socio   = (int)($in['id_socio']   ?? 0);
$id_periodo = (int)($in['id_periodo'] ?? 0);
$anio       = (int)($in['anio']       ?? 0);

if ($id_socio <= 0 || $id_periodo <= 0 || $anio <= 0) {
  http_response_code(400);
  echo json_encode(['exito' => false, 'mensaje' => 'Datos incompletos (id_socio, id_periodo, anio)']);
  exit;
}

function respond_json($code, $arr) {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

try {
  // Aísla la transacción y evita carreras entre lecturas/borrados
  $pdo->exec("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
  $pdo->beginTransaction();

  // 1) Intento de pago DIRECTO (lock FOR UPDATE)
  $selDirecto = $pdo->prepare("
    SELECT id_pago
      FROM pagos
     WHERE id_socio = ?
       AND id_periodo = ?
       AND YEAR(fecha_pago) = ?
     LIMIT 1
     FOR UPDATE
  ");
  $selDirecto->execute([$id_socio, $id_periodo, $anio]);
  $rowDirecto = $selDirecto->fetch(PDO::FETCH_ASSOC);

  if ($rowDirecto && isset($rowDirecto['id_pago'])) {
    $idp = (int)$rowDirecto['id_pago'];
    $del = $pdo->prepare("DELETE FROM pagos WHERE id_pago = ? LIMIT 1");
    $del->execute([$idp]);

    if ($del->rowCount() > 0) {
      $pdo->commit();
      respond_json(200, [
        'exito'            => true,
        'mensaje'          => 'Se eliminó el pago del período seleccionado.',
        'deleted_from'     => 'directo',
        'affected_periods' => [$id_periodo],
        'anio'             => $anio,
      ]);
    } else {
      // Si otro proceso lo borró entre SELECT y DELETE
      $pdo->rollBack();
      respond_json(409, ['exito' => false, 'mensaje' => 'El pago directo ya no existe.']);
    }
  }

  // 2) Intento de pago ANUAL de ese año (lock FOR UPDATE)
  $selAnual = $pdo->prepare("
    SELECT id_pago
      FROM pagos
     WHERE id_socio = ?
       AND id_periodo = ?
       AND YEAR(fecha_pago) = ?
     LIMIT 1
     FOR UPDATE
  ");
  $selAnual->execute([$id_socio, ID_CONTADO_ANUAL, $anio]);
  $rowAnual = $selAnual->fetch(PDO::FETCH_ASSOC);

  if ($rowAnual && isset($rowAnual['id_pago'])) {
    $idp = (int)$rowAnual['id_pago'];
    $delAnual = $pdo->prepare("DELETE FROM pagos WHERE id_pago = ? LIMIT 1");
    $delAnual->execute([$idp]);

    if ($delAnual->rowCount() > 0) {
      $pdo->commit();
      respond_json(200, [
        'exito'            => true,
        'mensaje'          => 'Se eliminó el pago ANUAL del socio. Impacta en todos los períodos del año.',
        'deleted_from'     => 'anual',
        'affected_periods' => [ID_CONTADO_ANUAL, 1, 2, 3, 4, 5, 6],
        'anio'             => $anio,
      ]);
    } else {
      $pdo->rollBack();
      respond_json(409, ['exito' => false, 'mensaje' => 'No se pudo eliminar el pago anual (ya no existe).']);
    }
  }

  // 3) Nada que borrar en ese año
  $pdo->rollBack();
  respond_json(404, [
    'exito'   => false,
    'mensaje' => 'No existe un pago registrado para el período/año indicado ni un pago anual en ese año.',
  ]);

} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  respond_json(500, ['exito' => false, 'mensaje' => 'Error al eliminar: ' . $e->getMessage()]);
}
