<?php
// modules/cuotas/eliminar_pago.php
declare(strict_types=1);

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
  echo json_encode([
    'exito' => false,
    'mensaje' => 'Método no permitido'
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

function respond_json(int $code, array $arr): void
{
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

$in = json_decode(file_get_contents("php://input"), true) ?? [];

$id_socio   = (int)($in['id_socio'] ?? 0);
$id_periodo = (int)($in['id_periodo'] ?? 0);
$anio       = (int)($in['anio'] ?? 0);

if ($id_socio <= 0 || $id_periodo <= 0 || $anio <= 0) {
  respond_json(400, [
    'exito' => false,
    'mensaje' => 'Datos incompletos (id_socio, id_periodo, anio)'
  ]);
}

try {
  $pdo->exec("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
  $pdo->beginTransaction();

  /**
   * Busca un pago exacto:
   * - primero por anio_aplicado (estructura nueva)
   * - fallback por YEAR(fecha_pago) si anio_aplicado viene 0 o null (compatibilidad vieja)
   */
  $sqlBuscarPago = "
    SELECT
      id_pago,
      id_socio,
      id_periodo,
      anio_aplicado,
      fecha_pago,
      estado
    FROM pagos
    WHERE id_socio = :id_socio
      AND id_periodo = :id_periodo
      AND (
        anio_aplicado = :anio
        OR (
          (anio_aplicado IS NULL OR anio_aplicado = 0)
          AND fecha_pago IS NOT NULL
          AND YEAR(fecha_pago) = :anio_fecha
        )
      )
    ORDER BY id_pago DESC
    LIMIT 1
    FOR UPDATE
  ";

  // 1) Intentar eliminar pago directo del período seleccionado
  $selDirecto = $pdo->prepare($sqlBuscarPago);
  $selDirecto->execute([
    ':id_socio'   => $id_socio,
    ':id_periodo' => $id_periodo,
    ':anio'       => $anio,
    ':anio_fecha' => $anio,
  ]);
  $rowDirecto = $selDirecto->fetch(PDO::FETCH_ASSOC);

  if ($rowDirecto && isset($rowDirecto['id_pago'])) {
    $idPago = (int)$rowDirecto['id_pago'];

    $del = $pdo->prepare("DELETE FROM pagos WHERE id_pago = :id_pago LIMIT 1");
    $del->execute([':id_pago' => $idPago]);

    if ($del->rowCount() > 0) {
      $pdo->commit();

      respond_json(200, [
        'exito' => true,
        'mensaje' => 'Se eliminó el pago del período seleccionado.',
        'deleted_from' => 'directo',
        'affected_periods' => [$id_periodo],
        'anio' => $anio,
        'id_pago_eliminado' => $idPago,
      ]);
    }

    $pdo->rollBack();
    respond_json(409, [
      'exito' => false,
      'mensaje' => 'El pago directo ya no existe.'
    ]);
  }

  // 2) Si no existe directo, intentar eliminar anual del mismo año
  $selAnual = $pdo->prepare($sqlBuscarPago);
  $selAnual->execute([
    ':id_socio'   => $id_socio,
    ':id_periodo' => ID_CONTADO_ANUAL,
    ':anio'       => $anio,
    ':anio_fecha' => $anio,
  ]);
  $rowAnual = $selAnual->fetch(PDO::FETCH_ASSOC);

  if ($rowAnual && isset($rowAnual['id_pago'])) {
    $idPagoAnual = (int)$rowAnual['id_pago'];

    $delAnual = $pdo->prepare("DELETE FROM pagos WHERE id_pago = :id_pago LIMIT 1");
    $delAnual->execute([':id_pago' => $idPagoAnual]);

    if ($delAnual->rowCount() > 0) {
      $pdo->commit();

      respond_json(200, [
        'exito' => true,
        'mensaje' => 'Se eliminó el pago ANUAL del socio. Impacta en todos los períodos del año.',
        'deleted_from' => 'anual',
        'affected_periods' => [ID_CONTADO_ANUAL, 1, 2, 3, 4, 5, 6],
        'anio' => $anio,
        'id_pago_eliminado' => $idPagoAnual,
      ]);
    }

    $pdo->rollBack();
    respond_json(409, [
      'exito' => false,
      'mensaje' => 'No se pudo eliminar el pago anual (ya no existe).'
    ]);
  }

  $pdo->rollBack();

  respond_json(404, [
    'exito' => false,
    'mensaje' => 'No existe un pago registrado para el período/año indicado ni un pago anual en ese año.',
    'debug' => [
      'id_socio' => $id_socio,
      'id_periodo' => $id_periodo,
      'id_periodo_anual' => ID_CONTADO_ANUAL,
      'anio' => $anio
    ]
  ]);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }

  respond_json(500, [
    'exito' => false,
    'mensaje' => 'Error al eliminar: ' . $e->getMessage()
  ]);
}