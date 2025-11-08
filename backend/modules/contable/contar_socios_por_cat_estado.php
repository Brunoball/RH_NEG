<?php
/**
 * Conteo de socios por Servicio (ACTIVO/PASIVO/SIN ESTADO) y Categoría.
 *
 * Reglas:
 *   - s.activo = 1
 *   - Elegibilidad (igual a Cuotas):
 *       s.ingreso IS NULL OR s.ingreso <= LAST_DAY( DATE(CONCAT(:anio,'-',:max_mes,'-01')) )
 *   - Servicio:
 *       ACTIVO     => s.id_estado = 2
 *       PASIVO     => UPPER(e.descripcion) = 'PASIVO'
 *       SIN ESTADO => cualquier otro/NULL
 *   - Para SIN ESTADO, la categoría se fija a '—' (una sola fila).
 *
 * GET:
 *   - anio (int, req)
 *   - mes (1..12, opc)  | periodo (texto con números) | id_periodo (1..6)
 *   - cobrador (id o nombre, opc)
 *   - estado_socio ("ACTIVO"|"PASIVO", opc)
 */

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../../config/db.php'; // Debe exponer $pdo (PDO)

    $p = fn($k,$d=null)=>isset($_GET[$k])?$_GET[$k]:$d;

    $anio = (int)$p('anio', 0);
    if ($anio <= 0) {
        http_response_code(400);
        echo json_encode(['exito'=>false,'error'=>'Parámetro "anio" es requerido'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $mesRaw     = $p('mes', null);
    $periodoRaw = $p('periodo', null);
    $idPeriodo  = (int)$p('id_periodo', 0);
    $cobrador   = $p('cobrador', null);
    $estadoSoc  = $p('estado_socio', null);

    /* ---- Resolver meses ---- */
    $meses = [];
    if ($mesRaw !== null && $mesRaw !== '' && ctype_digit((string)$mesRaw)) {
        $m = (int)$mesRaw; if ($m>=1 && $m<=12) $meses = [$m];
    }
    if (!$meses && $periodoRaw) {
        if (preg_match_all('/\d{1,2}/', (string)$periodoRaw, $mm)) {
            $set = [];
            foreach ($mm[0] as $s) { $n=(int)$s; if ($n>=1 && $n<=12) $set[$n]=true; }
            $meses = array_map('intval', array_keys($set));
        }
    }
    if (!$meses && $idPeriodo>=1 && $idPeriodo<=6) {
        $map = [1=>[1,2],2=>[3,4],3=>[5,6],4=>[7,8],5=>[9,10],6=>[11,12]];
        $meses = $map[$idPeriodo];
    }
    if (!$meses) $meses = range(1,12);
    sort($meses);
    $maxMes = (int)max($meses);

    /* ---- WHERE y params ---- */
    $where = [];
    $params = [];

    $where[] = "s.activo = 1";
    $where[] = "(s.ingreso IS NULL OR s.ingreso <= LAST_DAY(DATE(CONCAT(:anio,'-',:max_mes,'-01'))))";
    $params[':anio']    = $anio;
    $params[':max_mes'] = $maxMes;

    if ($cobrador !== null && $cobrador !== '') {
        if (ctype_digit((string)$cobrador)) {
            $where[] = "s.id_cobrador = :id_cobrador";
            $params[':id_cobrador'] = (int)$cobrador;
        } else {
            $where[] = "cb.nombre = :nom_cobrador";
            $params[':nom_cobrador'] = trim((string)$cobrador);
        }
    }

    if ($estadoSoc) {
        $e = mb_strtoupper(trim((string)$estadoSoc),'UTF-8');
        if ($e === 'ACTIVO') {
            $where[] = "s.id_estado = 2";
        } elseif ($e === 'PASIVO') {
            $where[] = "UPPER(e.descripcion) = 'PASIVO'";
        }
    }

    $whereSQL = $where ? 'WHERE '.implode(' AND ',$where) : '';

    /* ---- Consulta: colapso de "SIN ESTADO" a una fila ---- */
    $sql = "
        SELECT
            CASE
                WHEN s.id_estado = 2 THEN 'ACTIVO'
                WHEN UPPER(e.descripcion) = 'PASIVO' THEN 'PASIVO'
                ELSE 'SIN ESTADO'
            END AS servicio,
            CASE
                WHEN s.id_estado = 2 OR UPPER(e.descripcion) = 'PASIVO'
                    THEN UPPER(COALESCE(cat.descripcion, 'SIN CAT'))
                ELSE '—'
            END AS categoria,
            COUNT(*) AS cantidad
        FROM rh_neg.socios s
        LEFT JOIN rh_neg.estado    e   ON e.id_estado      = s.id_estado
        LEFT JOIN rh_neg.categoria cat ON cat.id_categoria = s.id_categoria
        LEFT JOIN rh_neg.cobrador  cb  ON cb.id_cobrador   = s.id_cobrador
        $whereSQL
        GROUP BY servicio, categoria
        ORDER BY FIELD(servicio,'ACTIVO','PASIVO','SIN ESTADO'), categoria
    ";

    $st = $pdo->prepare($sql);
    foreach ($params as $k=>$v) $st->bindValue($k,$v);
    $st->execute();
    $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $filas = [];
    foreach ($rows as $r) {
        $filas[] = [
            'servicio'  => $r['servicio'],
            'categoria' => $r['categoria'],
            'cantidad'  => (int)$r['cantidad'],
        ];
    }

    echo json_encode([
        'exito' => true,
        'anio'  => $anio,
        'meses' => $meses,
        'filas' => $filas,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'  => false,
        'error'  => 'Error al contar socios por categoría y estado',
        'detail' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
