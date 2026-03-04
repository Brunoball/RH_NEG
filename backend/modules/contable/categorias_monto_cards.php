<?php
// backend/modules/contable/categorias_monto_cards.php
//
// Devuelve cards de categorías de monto respetando histórico (precios_historicos)
// según filtros: anio / mes / periodo.
// FIX CLAVE: si NO hay histórico <= fecha_objetivo, usa precio_viejo del primer cambio posterior
// (así 2025 muestra 4000 aunque categoria_monto hoy tenga 5000).

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function json_out(array $payload, int $code = 200): void {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  exit;
}

function parse_months_from_periodo(string $label): array {
  preg_match_all('/\d{1,2}/', $label, $m);
  $nums = $m[0] ?? [];
  $out = [];
  foreach ($nums as $n) {
    $v = (int)$n;
    if ($v >= 1 && $v <= 12) $out[$v] = true;
  }
  $months = array_keys($out);
  sort($months);
  return $months;
}

function last_day_of_month(int $year, int $month): string {
  $dt = DateTime::createFromFormat('Y-m-d', sprintf('%04d-%02d-01', $year, $month));
  if (!$dt) return sprintf('%04d-%02d-28', $year, $month);
  $dt->modify('last day of this month');
  return $dt->format('Y-m-d');
}

try {
  require_once __DIR__ . '/../../config/db.php'; // $pdo

  $anio    = isset($_GET['anio']) ? (int)$_GET['anio'] : 0;
  $mes     = isset($_GET['mes']) ? (int)$_GET['mes'] : 0;
  $periodo = isset($_GET['periodo']) ? trim((string)$_GET['periodo']) : '';

  if ($anio <= 0) {
    json_out(['exito' => false, 'mensaje' => 'Falta parámetro anio'], 400);
  }

  // =========================
  // Calcular fecha objetivo
  // =========================
  $targetDate = sprintf('%04d-12-31', $anio);

  if ($mes >= 1 && $mes <= 12) {
    $targetDate = last_day_of_month($anio, $mes);
  } else if ($periodo !== '' && mb_strtolower($periodo, 'UTF-8') !== 'selecciona un periodo') {
    $months = parse_months_from_periodo($periodo);
    if (count($months) > 0) {
      $maxMonth = max($months);
      $targetDate = last_day_of_month($anio, $maxMonth);
    }
  }

  // =========================
  // Precio vigente a la fecha:
  // 1) último precio_nuevo con fecha_cambio <= targetDate
  // 2) si no hay, primer precio_viejo con fecha_cambio > targetDate
  // 3) si no hay, fallback categoria_monto.monto_mensual
  // =========================
  $sql = "
    SELECT
      cm.id_cat_monto,
      cm.nombre_categoria,
      cm.monto_mensual AS base_mensual,

      COALESCE(
        (
          SELECT ph.precio_nuevo
          FROM precios_historicos ph
          WHERE ph.id_cat_monto = cm.id_cat_monto
            AND ph.tipo = 'mensual'
            AND ph.fecha_cambio <= :targetDate
          ORDER BY ph.fecha_cambio DESC, ph.id_historial DESC
          LIMIT 1
        ),
        (
          SELECT ph2.precio_viejo
          FROM precios_historicos ph2
          WHERE ph2.id_cat_monto = cm.id_cat_monto
            AND ph2.tipo = 'mensual'
            AND ph2.fecha_cambio > :targetDate
          ORDER BY ph2.fecha_cambio ASC, ph2.id_historial ASC
          LIMIT 1
        ),
        cm.monto_mensual
      ) AS monto_mensual_vigente,

      COALESCE(
        (
          SELECT pa.precio_nuevo
          FROM precios_historicos pa
          WHERE pa.id_cat_monto = cm.id_cat_monto
            AND pa.tipo = 'anual'
            AND pa.fecha_cambio <= :targetDate
          ORDER BY pa.fecha_cambio DESC, pa.id_historial DESC
          LIMIT 1
        ),
        (
          SELECT pa2.precio_viejo
          FROM precios_historicos pa2
          WHERE pa2.id_cat_monto = cm.id_cat_monto
            AND pa2.tipo = 'anual'
            AND pa2.fecha_cambio > :targetDate
          ORDER BY pa2.fecha_cambio ASC, pa2.id_historial ASC
          LIMIT 1
        )
      ) AS monto_anual_vigente

    FROM categoria_monto cm
    ORDER BY cm.id_cat_monto ASC
  ";

  $stmt = $pdo->prepare($sql);
  $stmt->execute([':targetDate' => $targetDate]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  $categorias = [];

  foreach ($rows as $row) {
    $id     = (int)($row['id_cat_monto'] ?? 0);
    $nombre = trim((string)($row['nombre_categoria'] ?? ''));

    $mensual = (int)($row['monto_mensual_vigente'] ?? 0);
    $anualRaw = $row['monto_anual_vigente'];
    $anual = ($anualRaw !== null && $anualRaw !== '') ? (int)$anualRaw : null;

    $categorias[] = [
      'id_cat_monto'       => $id,
      'nombre_categoria'   => $nombre,
      'monto_mensual'      => $mensual,
      'monto_mensual_fmt'  => '$ ' . number_format($mensual, 0, ',', '.'),
      'monto_anual'        => $anual,
      'monto_anual_fmt'    => ($anual !== null) ? '$ ' . number_format($anual, 0, ',', '.') : null,
      // 'fecha_objetivo'   => $targetDate, // descomentá si querés debug
    ];
  }

  json_out([
    'exito'          => true,
    'anio'           => $anio,
    'fecha_objetivo' => $targetDate,
    'categorias'     => $categorias,
  ]);

} catch (Throwable $e) {
  json_out([
    'exito'   => false,
    'mensaje' => 'Error: ' . $e->getMessage(),
  ], 500);
}