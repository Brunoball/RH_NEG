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

/**
 * Responder y terminar.
 */
function respond($ok, $mensaje, $deletedFrom = null, $affected = []) {
  echo json_encode([
    'exito'            => (bool)$ok,
    'mensaje'          => (string)$mensaje,
    'deleted_from'     => $deletedFrom,   // 'directo' | 'anual' | null
    'affected_periods' => array_values(array_unique(array_map('intval', $affected))),
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

try {
  // 1) ¿Existe pago DIRECTO para el período solicitado?
  $selDirecto = $pdo->prepare("SELECT id_pago FROM pagos WHERE id_socio = ? AND id_periodo = ? LIMIT 1");
  $selDirecto->execute([$id_socio, $id_periodo]);
  $rowDirecto = $selDirecto->fetch(PDO::FETCH_ASSOC);

  if ($rowDirecto) {
    // Elimino el pago directo del período solicitado
    $del = $pdo->prepare("DELETE FROM pagos WHERE id_socio = ? AND id_periodo = ? LIMIT 1");
    $del->execute([$id_socio, $id_periodo]);

    if ($del->rowCount() > 0) {
      // Solo afecta al período puntual
      respond(true, 'Se eliminó el pago del período seleccionado.', 'directo', [$id_periodo]);
    } else {
      respond(false, 'No se pudo eliminar el pago del período (ya no existe).', null, []);
    }
  }

  // 2) Si NO hay directo, ¿existe pago ANUAL?
  $selAnual = $pdo->prepare("SELECT id_pago FROM pagos WHERE id_socio = ? AND id_periodo = ? LIMIT 1");
  $selAnual->execute([$id_socio, ID_CONTADO_ANUAL]);
  $rowAnual = $selAnual->fetch(PDO::FETCH_ASSOC);

  if ($rowAnual) {
    // Elimino el pago anual — afecta a todo el año (1..6) por propagación
    $delAnual = $pdo->prepare("DELETE FROM pagos WHERE id_socio = ? AND id_periodo = ? LIMIT 1");
    $delAnual->execute([$id_socio, ID_CONTADO_ANUAL]);

    if ($delAnual->rowCount() > 0) {
      respond(
        true,
        'Se eliminó el pago ANUAL del socio. Esto impacta en todos los períodos del año.',
        'anual',
        [ID_CONTADO_ANUAL, 1, 2, 3, 4, 5, 6]
      );
    } else {
      respond(false, 'No se pudo eliminar el pago anual (ya no existe).', null, []);
    }
  }

  // 3) No había ni directo ni anual
  respond(false, 'No existe un pago registrado para el período indicado ni un pago anual.', null, []);

} catch (Throwable $e) {
  http_response_code(500);
  respond(false, 'Error al eliminar: ' . $e->getMessage(), null, []);
}
