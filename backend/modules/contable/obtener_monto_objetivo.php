<?php
/**
 * obtener_monto_objetivo.php  —  CÁLCULO CORRECTO POR MES/PERIODO (sin prefijo de base)
 *
 * Reglas clave que pediste:
 *  - categoria_monto.monto_mensual = IMPORTE POR PERÍODO (bimestre).
 *  - Si se pide un **mes** puntual, ese mes vale **1/2** de un período.
 *  - Si se piden 2 meses del mismo período, juntos valen **1** período (no 2).
 *  - Para todo el año (12 meses) el factor total es 6 períodos.
 *
 * Elegibilidad (igual que el contador de socios):
 *  - s.activo = 1
 *  - s.ingreso IS NULL OR s.ingreso <= LAST_DAY(DATE(CONCAT(:anio, '-', :max_mes, '-01')))
 *  - Filtros opcionales: cobrador (id/nombre) y estado_socio ("ACTIVO"/"PASIVO").
 *
 * GET:
 *   - anio (int, requerido)
 *   - mes (1..12, opcional)               // domina sobre 'periodo' e 'id_periodo'
 *   - periodo (string, opcional)          // extrae números 1..12 (p.ej. "PERÍODO 1 y 2")
 *   - id_periodo (1..6, opcional)         // 1:[1,2], 2:[3,4],..., 6:[11,12]
 *   - cobrador (id o nombre, opcional)
 *   - estado_socio ("ACTIVO"|"PASIVO", opcional)
 *   - debug=1 (opcional)                  // devuelve detalle por socio
 *   - todos_cobradores=1 (opcional)       // incluye esperado agregado por cobrador
 *
 * NUEVO:
 *   - esperado_por_cobrador_por_mes: { id_cobrador | nombre => {mes -> esperado}}  (respeta 0.5 por mes y tope 1 por período/socio)
 */

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../../config/db.php'; // Debe exponer $pdo (PDO)

    $g = fn($k,$d=null)=>isset($_GET[$k])?$_GET[$k]:$d;

    /* ====== Parámetros ====== */
    $anio = (int)$g('anio', 0);
    if ($anio <= 0) {
        http_response_code(400);
        echo json_encode(['exito'=>false,'error'=>'Parámetro "anio" es requerido'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $mesRaw     = $g('mes', null);
    $periodoRaw = $g('periodo', null);
    $idPeriodo  = (int)$g('id_periodo', 0);
    $cobrador   = $g('cobrador', null);
    $estadoSoc  = $g('estado_socio', null);
    $wantDebug  = $g('debug','0') === '1';
    $todosCobradores = $g('todos_cobradores','0') === '1';

    /* ====== Resolver MESES seleccionados ====== */
    $mesesSel = [];

    // 1) mes puntual
    if ($mesRaw !== null && $mesRaw !== '' && ctype_digit((string)$mesRaw)) {
        $m = (int)$mesRaw;
        if ($m >= 1 && $m <= 12) $mesesSel = [$m];
    }

    // 2) etiqueta "PERÍODO 1 y 2" (extrae números)
    if (!$mesesSel && $periodoRaw) {
        if (preg_match_all('/\d{1,2}/u', (string)$periodoRaw, $mm)) {
            $set = [];
            foreach ($mm[0] as $s) {
                $n = (int)$s;
                if ($n >= 1 && $n <= 12) $set[$n] = true;
            }
            $mesesSel = array_map('intval', array_keys($set));
        }
    }

    // 3) id_periodo
    if (!$mesesSel && $idPeriodo >= 1 && $idPeriodo <= 6) {
        $map = [
            1=>[1,2], 2=>[3,4],
            3=>[5,6], 4=>[7,8],
            5=>[9,10],6=>[11,12],
        ];
        $mesesSel = $map[$idPeriodo];
    }

    // 4) sin filtros → todo el año
    if (!$mesesSel) $mesesSel = range(1, 12);

    sort($mesesSel);
    $maxMes = (int)max($mesesSel);

    // helper: devuelve período 1..6 para un mes 1..12
    $mesToPeriodo = static function(int $m): int { return intdiv($m-1, 2) + 1; };

    /* ====== OBTENER TODOS LOS COBRADORES ====== */
    $sqlCobradores = "SELECT id_cobrador, nombre FROM cobrador ORDER BY nombre";
    $stCobradores = $pdo->query($sqlCobradores);
    $todosLosCobradores = $stCobradores->fetchAll(PDO::FETCH_ASSOC) ?: [];

    // map id->nombre para conveniencia
    $cobrId2Nombre = [];
    foreach ($todosLosCobradores as $c) {
        $cobrId2Nombre[(int)$c['id_cobrador']] = $c['nombre'];
    }

    /* ====== WHERE (elegibilidad = contador) ====== */
    $where  = [];
    $params = [];

    $where[] = "s.activo = 1";
    $where[] = "(s.ingreso IS NULL OR s.ingreso <= LAST_DAY(DATE(CONCAT(:anio,'-',:max_mes,'-01'))))";
    $params[':anio']    = $anio;
    $params[':max_mes'] = $maxMes;

    $cobradorAplicado = null;
    if ($cobrador !== null && $cobrador !== '' && !$todosCobradores) {
        if (ctype_digit((string)$cobrador)) {
            $where[] = "s.id_cobrador = :id_cobrador";
            $params[':id_cobrador'] = (int)$cobrador;
            $cobradorAplicado = (int)$cobrador;
        } else {
            $where[] = "cb.nombre = :nom_cobrador";
            $params[':nom_cobrador'] = trim((string)$cobrador);
            $cobradorAplicado = trim((string)$cobrador);
        }
    }

    $estadoAplicado = null;
    if ($estadoSoc) {
        $e = mb_strtoupper(trim((string)$estadoSoc),'UTF-8');
        if ($e === 'ACTIVO') {
            $where[] = "s.id_estado = 2";
            $estadoAplicado = 'ACTIVO';
        } elseif ($e === 'PASIVO') {
            $where[] = "UPPER(e.descripcion) = 'PASIVO'";
            $estadoAplicado = 'PASIVO';
        }
    }

    $whereSQL = $where ? ('WHERE '.implode(' AND ', $where)) : '';

    /* ====== Traer socios + monto POR PERÍODO (sin prefijo de base) ====== */
    $sql = "
        SELECT
            s.id_socio,
            s.nombre                              AS socio_nombre,
            s.ingreso                             AS ingreso,
            s.id_cobrador,
            cb.nombre                             AS cobrador_nombre,
            s.id_cat_monto,
            COALESCE(cm.monto_mensual, 0)         AS monto_por_periodo, -- ¡es bimestral!
            s.activo
        FROM `socios` s
        LEFT JOIN `categoria_monto` cm ON cm.id_cat_monto = s.id_cat_monto
        LEFT JOIN `cobrador`       cb ON cb.id_cobrador   = s.id_cobrador
        LEFT JOIN `estado`         e  ON e.id_estado      = s.id_estado
        $whereSQL
    ";

    $st = $pdo->prepare($sql);
    foreach ($params as $k=>$v) $st->bindValue($k,$v);
    $st->execute();
    $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];

    /* ====== Cálculo: sumar FRACCIONES por mes (0.5 por mes, tope 1 por período/socio) ====== */
    $totalEsperado  = 0;
    $sociosContados = 0;
    $detalle        = [];

    $esperadoPorCobrador = [];             // totales por cobrador (todos los meses combinados)
    $esperadoPorCobradorPorMes = [];       // NUEVO: id_cobrador => { mes => esperado }

    // Inicializar mapas de agregación
    $initCob = function($id, $nombre) use (&$esperadoPorCobrador, &$esperadoPorCobradorPorMes) {
        if (!isset($esperadoPorCobrador[$id])) {
            $esperadoPorCobrador[$id] = [
                'id_cobrador'     => $id,
                'nombre'          => $nombre,
                'total_esperado'  => 0,
                'socios_contados' => 0
            ];
        }
        if (!isset($esperadoPorCobradorPorMes[$id])) {
            $esperadoPorCobradorPorMes[$id] = []; // mes => esperado
        }
    };

    foreach ($rows as $r) {
        if ((int)$r['activo'] !== 1) continue;

        $impPeriodo = (int)$r['monto_por_periodo'];
        $idCobrador = (int)$r['id_cobrador'];
        $cobradorNombre = $r['cobrador_nombre'] ?? ($cobrId2Nombre[$idCobrador] ?? (string)$idCobrador);

        // Parse ingreso
        $yIng = 0; $mIng = 1;
        if (!empty($r['ingreso'])) {
            $d = date_create_from_format('Y-m-d', $r['ingreso']);
            if ($d) {
                $yIng = (int)$d->format('Y');
                $mIng = (int)$d->format('n');
            } else {
                $ts = strtotime($r['ingreso']);
                if ($ts) { $yIng = (int)date('Y',$ts); $mIng = (int)date('n',$ts); }
            }
        }

        // 1) Meses válidos para el socio (según ingreso)
        $mesesValidos = [];
        if ($yIng === 0 || $yIng < $anio) {
            $mesesValidos = $mesesSel;                // todos los seleccionados
        } elseif ($yIng > $anio) {
            $mesesValidos = [];                       // ninguno
        } else { // yIng == anio
            foreach ($mesesSel as $m) {
                if ($m >= $mIng) $mesesValidos[] = $m;
            }
        }
        if (!$mesesValidos) {
            if ($wantDebug) {
                $detalle[] = [
                    'id_socio'      => (int)$r['id_socio'],
                    'socio_nombre'  => $r['socio_nombre'],
                    'ingreso'       => $r['ingreso'],
                    'monto_periodo' => $impPeriodo,
                    'factor'        => 0.0,
                    'parcial'       => 0,
                    'razon'         => 'sin meses válidos por ingreso'
                ];
            }
            continue;
        }

        // 2) Para distribuir por MES: 0.5 * monto_por_periodo por cada mes del período (tope 2 meses = 1 período)
        //    Agrupamos meses válidos del socio por período
        $mesesPorPeriodo = []; // p => [meses...]
        foreach ($mesesValidos as $m) {
            $p = $mesToPeriodo($m);
            $mesesPorPeriodo[$p][] = $m;
        }

        $parcialTotalSocio = 0;
        $mesesParciales = []; // mes => parcial asignado

        foreach ($mesesPorPeriodo as $p => $mesesDelP) {
            sort($mesesDelP);
            // Solo hasta 2 meses por período:
            $asignables = array_slice($mesesDelP, 0, 2);
            foreach ($asignables as $m) {
                $parcialMes = (int) round($impPeriodo / 2); // 0.5 del período
                $parcialTotalSocio += $parcialMes;
                $mesesParciales[$m] = ($mesesParciales[$m] ?? 0) + $parcialMes;
            }
        }

        if ($parcialTotalSocio <= 0) {
            if ($wantDebug) {
                $detalle[] = [
                    'id_socio'      => (int)$r['id_socio'],
                    'socio_nombre'  => $r['socio_nombre'],
                    'ingreso'       => $r['ingreso'],
                    'monto_periodo' => $impPeriodo,
                    'factor'        => 0.0,
                    'parcial'       => 0,
                    'razon'         => 'factor=0'
                ];
            }
            continue;
        }

        // Acumuladores globales
        $totalEsperado  += $parcialTotalSocio;
        $sociosContados++;

        // Inicializar agregadores del cobrador
        $initCob($idCobrador, $cobradorNombre);

        // Sumar totales por cobrador
        $esperadoPorCobrador[$idCobrador]['total_esperado'] += $parcialTotalSocio;
        $esperadoPorCobrador[$idCobrador]['socios_contados']++;

        // NUEVO: sumar por MES del cobrador
        foreach ($mesesParciales as $mes => $parcial) {
            $esperadoPorCobradorPorMes[$idCobrador][$mes] = ($esperadoPorCobradorPorMes[$idCobrador][$mes] ?? 0) + $parcial;
        }

        if ($wantDebug) {
            $detalle[] = [
                'id_socio'      => (int)$r['id_socio'],
                'socio_nombre'  => $r['socio_nombre'],
                'cobrador'      => $cobradorNombre,
                'ingreso'       => $r['ingreso'],
                'monto_periodo' => $impPeriodo,
                'parcial_total' => $parcialTotalSocio,
                'meses_parciales' => $mesesParciales, // { mes => parcialMes }
            ];
        }
    }

    $response = [
        'exito'             => true,
        'anio'              => $anio,
        'meses'             => $mesesSel,
        'periodos'          => array_values(array_unique(array_map($mesToPeriodo, $mesesSel))),
        'cobrador_aplicado' => $cobradorAplicado,
        'estado_aplicado'   => $estadoAplicado,
        'total_esperado'    => (int)$totalEsperado,
        'total_socios'      => (int)$sociosContados,
    ];

    if ($todosCobradores) {
        // Totales por cobrador (global) + NUEVO: por mes
        $response['esperado_por_cobrador'] = array_values($esperadoPorCobrador);

        // Normalizamos el formato por mes para que sea: [{id_cobrador, nombre, por_mes:{mes:valor}}]
        $pm = [];
        foreach ($esperadoPorCobradorPorMes as $id => $mapMes) {
            $pm[] = [
                'id_cobrador' => $id,
                'nombre'      => $cobrId2Nombre[$id] ?? (string)$id,
                'por_mes'     => array_change_key_case(array_combine(array_map('intval', array_keys($mapMes)), array_values($mapMes)), CASE_LOWER)
            ];
        }
        $response['esperado_por_cobrador_por_mes'] = $pm;
    }

    if ($wantDebug) {
        $response['detalle'] = $detalle;
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'  => false,
        'error'  => 'Error en obtener_monto_objetivo (fracciones por período)',
        'detail' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
