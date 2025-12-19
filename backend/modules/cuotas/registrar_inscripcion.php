<?php
// backend/modules/cuotas/registrar_inscripcion.php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/db.php'; // <-- ajustá si tu ruta real es distinta

// ================= Helpers =================

function json_input(): array {
  $raw = file_get_contents('php://input');
  if (!$raw) return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function respond(bool $exito, string $mensaje = '', array $extra = []): void {
  echo json_encode(array_merge(['exito' => $exito, 'mensaje' => $mensaje], $extra), JSON_UNESCAPED_UNICODE);
  exit;
}

function as_int($v): int {
  if ($v === null) return 0;
  if (is_int($v)) return $v;
  $s = trim((string)$v);
  if ($s === '') return 0;
  // solo dígitos (evita cosas raras)
  if (!preg_match('/^\d+$/', $s)) return 0;
  return (int)$s;
}

function socio_existe(PDO $pdo, int $idSocio): bool {
  $st = $pdo->prepare("SELECT 1 FROM socios WHERE id_socio = ? LIMIT 1");
  $st->execute([$idSocio]);
  return (bool)$st->fetchColumn();
}

function medio_pago_existe(PDO $pdo, int $idMedio): bool {
  $st = $pdo->prepare("SELECT 1 FROM medios_pago WHERE id_medio_pago = ? LIMIT 1");
  $st->execute([$idMedio]);
  return (bool)$st->fetchColumn();
}

// ================= Main =================

try {
  // $pdo debe venir del db.php (PDO)
  if (!isset($pdo) || !($pdo instanceof PDO)) {
    // si tu db.php exporta $conn o $mysqli, adaptalo
    respond(false, 'No se encontró la conexión PDO ($pdo). Revisá backend/config/db.php');
  }

  if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Método no permitido. Usá POST.');
  }

  $in = json_input();

  $idSocio = as_int($in['id_socio'] ?? null);
  $monto = as_int($in['monto'] ?? null);
  $idMedioPago = as_int($in['id_medio_pago'] ?? null);

  if ($idSocio <= 0) respond(false, 'id_socio inválido');
  if ($monto <= 0) respond(false, 'monto inválido');
  if ($idMedioPago <= 0) respond(false, 'id_medio_pago inválido');

  // Validaciones FK (para errores claros)
  if (!socio_existe($pdo, $idSocio)) {
    respond(false, 'El socio no existe (id_socio).');
  }
  if (!medio_pago_existe($pdo, $idMedioPago)) {
    respond(false, 'El medio de pago no existe (id_medio_pago).');
  }

  // Opcional: evitar doble inscripción (1 por socio)
  $stDup = $pdo->prepare("SELECT id_inscripcion, fecha_pago, monto FROM pagos_inscripcion WHERE id_socio = ? LIMIT 1");
  $stDup->execute([$idSocio]);
  $dup = $stDup->fetch(PDO::FETCH_ASSOC);
  if ($dup) {
    respond(false, 'Este socio ya tiene una inscripción registrada.', [
      'ya_existe' => true,
      'inscripcion' => $dup
    ]);
  }

  // Insert
  $pdo->beginTransaction();

  $sql = "INSERT INTO pagos_inscripcion (id_socio, monto, id_medio_pago)
          VALUES (:id_socio, :monto, :id_medio_pago)";
  $st = $pdo->prepare($sql);
  $st->execute([
    ':id_socio' => $idSocio,
    ':monto' => $monto,
    ':id_medio_pago' => $idMedioPago,
  ]);

  $idInscripcion = (int)$pdo->lastInsertId();

  // Leer lo insertado (incluye fecha default)
  $stRead = $pdo->prepare("SELECT id_inscripcion, id_socio, monto, fecha_pago, id_medio_pago
                           FROM pagos_inscripcion
                           WHERE id_inscripcion = ?");
  $stRead->execute([$idInscripcion]);
  $row = $stRead->fetch(PDO::FETCH_ASSOC);

  $pdo->commit();

  respond(true, 'Inscripción registrada.', [
    'id_inscripcion' => $idInscripcion,
    'data' => $row
  ]);

} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  respond(false, 'Error al registrar inscripción: ' . $e->getMessage());
}
