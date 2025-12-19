<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

const ID_CONTADO_ANUAL = 7;

/* =========================================================
   Endpoint: listar años con pagos
========================================================= */
if (isset($_GET['listar_anios'])) {
    try {
        $stmt = $pdo->query("
            SELECT DISTINCT YEAR(fecha_pago) AS anio
              FROM pagos
             WHERE fecha_pago IS NOT NULL
             ORDER BY anio DESC
        ");
        $rows  = $stmt->fetchAll(PDO::FETCH_COLUMN);
        $anios = array_values(array_map('intval', $rows ?: []));
        if (empty($anios)) $anios = [(int)date('Y')];

        echo json_encode(['exito' => true, 'anios' => $anios], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Throwable $e) {
        echo json_encode(['exito' => false, 'mensaje' => 'No se pudieron obtener los años'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

/* =========================================================
   Helpers: períodos -> fecha de referencia
   - Periodo 1..6 = bimestres (fin mes: 2,4,6,8,10,12)
   - Anual = 31/12
========================================================= */
function fechaReferenciaPorPeriodo(int $anio, int $idPeriodo): string {
    if ($idPeriodo === ID_CONTADO_ANUAL || $idPeriodo <= 0) {
        return sprintf('%04d-12-31', $anio);
    }
    $mapMesFin = [1=>2, 2=>4, 3=>6, 4=>8, 5=>10, 6=>12];
    $mesFin = $mapMesFin[$idPeriodo] ?? 12;

    $d = DateTime::createFromFormat('Y-n-j', $anio . '-' . $mesFin . '-1');
    if (!$d) return sprintf('%04d-12-31', $anio);
    $d->modify('last day of this month');
    return $d->format('Y-m-d');
}

/* =========================================================
   Helpers de elegibilidad por ingreso (lo tuyo, igual)
========================================================= */
function obtenerMesNumero($nombreMes) {
    static $meses = [
        'ENERO'=>1,'FEBRERO'=>2,'MARZO'=>3,'ABRIL'=>4,'MAYO'=>5,'JUNIO'=>6,
        'JULIO'=>7,'AGOSTO'=>8,'SEPTIEMBRE'=>9,'OCTUBRE'=>10,'NOVIEMBRE'=>11,'DICIEMBRE'=>12
    ];
    $k = strtoupper(trim($nombreMes));
    return $meses[$k] ?? null;
}

function obtenerRangoMeses($textoMeses, $idPeriodo = null) {
    $texto = strtoupper($textoMeses ?? '');
    $encontrados = [];
    foreach (['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'] as $mes) {
        if (strpos($texto, $mes) !== false) $encontrados[] = $mes;
    }
    if (!empty($encontrados)) {
        $nums = array_map('obtenerMesNumero', $encontrados);
        return [min($nums), max($nums)];
    }
    if ($idPeriodo !== null) {
        $map = [1=>[1,2],2=>[3,4],3=>[5,6],4=>[7,8],5=>[9,10],6=>[11,12]];
        if (isset($map[$idPeriodo])) return $map[$idPeriodo];
    }
    return [1,12];
}

function socioElegibleEnPeriodo($fechaIngreso, $mesFin, $anioPeriodo) {
    if (!$fechaIngreso) return true;
    try { $ingreso = new DateTime($fechaIngreso); } catch (Exception $e) { return true; }
    $finPeriodo = DateTime::createFromFormat('Y-n-j', $anioPeriodo . '-' . $mesFin . '-1');
    if ($finPeriodo === false) return true;
    $finPeriodo->modify('last day of this month');
    return $ingreso <= $finPeriodo;
}

/* =========================================================
   ✅ PRECIOS HISTÓRICOS
========================================================= */
function cargarHistorialPrecios(PDO $pdo, array $idsCatMonto): array {
    $idsCatMonto = array_values(array_unique(array_filter(array_map('intval', $idsCatMonto))));
    if (empty($idsCatMonto)) return [];

    $in = implode(',', array_fill(0, count($idsCatMonto), '?'));

    $sql = "
        SELECT id_cat_monto, tipo, precio_viejo, precio_nuevo, fecha_cambio
          FROM precios_historicos
         WHERE id_cat_monto IN ($in)
         ORDER BY id_cat_monto ASC, tipo ASC, fecha_cambio ASC
    ";
    $st = $pdo->prepare($sql);
    foreach ($idsCatMonto as $i => $v) {
        $st->bindValue($i+1, $v, PDO::PARAM_INT);
    }
    $st->execute();
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    $map = [];
    foreach ($rows as $r) {
        $id = (int)$r['id_cat_monto'];
        $tipo = (string)$r['tipo']; // mensual|anual
        $map[$id][$tipo][] = [
            'fecha' => (string)$r['fecha_cambio'],
            'viejo' => (int)$r['precio_viejo'],
            'nuevo' => (int)$r['precio_nuevo'],
        ];
    }
    return $map;
}

function precioVigenteEnFecha(?int $idCatMonto, string $tipo, string $fechaRef, int $precioActual, array $historialMap): int {
    if (!$idCatMonto) return $precioActual;

    $lista = $historialMap[$idCatMonto][$tipo] ?? [];
    if (empty($lista)) return $precioActual;

    $primer = $lista[0];
    if ($fechaRef < $primer['fecha']) {
        return (int)$primer['viejo'];
    }

    $vigente = null;
    foreach ($lista as $c) {
        if ($c['fecha'] <= $fechaRef) {
            $vigente = (int)$c['nuevo'];
        } else {
            break;
        }
    }
    return $vigente !== null ? $vigente : $precioActual;
}

/* =========================================================
   Lógica principal
========================================================= */
try {
    $anioFiltro      = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)date('Y');
    $idPeriodoFilter = isset($_GET['id_periodo']) ? (int)$_GET['id_periodo'] : 0;

    // ✅ MODO CORRECTO (arregla el bug de duplicación)
    // - si viene pagados=1 => solo pagados
    // - si viene condonados=1 => solo condonados
    // - si no viene ninguno => solo deudores
    $verPagados    = isset($_GET['pagados']);
    $verCondonados = isset($_GET['condonados']);
    $modo = $verPagados ? 'pagado' : ($verCondonados ? 'condonado' : 'deudor');

    // incluir inactivos solo cuando estás mirando pagados/condonados
    $incluirInactivos = ($modo !== 'deudor');

    $fechaRefGlobal = fechaReferenciaPorPeriodo($anioFiltro, $idPeriodoFilter);

    /* ===== SOCIOS ===== */
    $sociosSql = "
        SELECT 
            s.id_socio,
            s.nombre,
            s.domicilio,
            s.numero,
            s.domicilio_cobro,
            s.ingreso,
            s.activo,
            s.telefono_movil,
            s.telefono_fijo,
            e.descripcion AS estado,
            c.nombre AS cobrador,
            s.id_categoria,
            cat.descripcion AS nombre_categoria,
            s.id_cat_monto,
            cm.monto_mensual AS monto_mensual_cat,
            cm.monto_anual AS monto_anual_cat
        FROM socios s
        LEFT JOIN cobrador c ON s.id_cobrador = c.id_cobrador
        LEFT JOIN estado e ON s.id_estado = e.id_estado
        LEFT JOIN categoria cat ON s.id_categoria = cat.id_categoria
        LEFT JOIN categoria_monto cm ON s.id_cat_monto = cm.id_cat_monto
    ";

    if ($incluirInactivos) {
        if ($idPeriodoFilter > 0) {
            $sociosSql .= "
                WHERE s.activo = 1
                   OR EXISTS (
                        SELECT 1
                          FROM pagos p
                         WHERE p.id_socio = s.id_socio
                           AND p.id_periodo IN (:pp2, :anual2)
                           AND YEAR(p.fecha_pago) = :anio2
                   )
            ";
        } else {
            $sociosSql .= " WHERE s.activo = 1 ";
        }
    } else {
        $sociosSql .= " WHERE s.activo = 1 ";
    }

    $sociosSql .= " ORDER BY s.nombre ASC ";
    $stmt = $pdo->prepare($sociosSql);

    if ($incluirInactivos && $idPeriodoFilter > 0) {
        $stmt->bindValue(':pp2',    $idPeriodoFilter,  PDO::PARAM_INT);
        $stmt->bindValue(':anual2', ID_CONTADO_ANUAL,  PDO::PARAM_INT);
        $stmt->bindValue(':anio2',  $anioFiltro,       PDO::PARAM_INT);
    }

    $stmt->execute();
    $socios = $stmt->fetchAll(PDO::FETCH_ASSOC);

    /* ===== PERIODOS ===== */
    $periodosStmt = $pdo->query("SELECT id_periodo, nombre, meses FROM periodo ORDER BY id_periodo ASC");
    $periodos = $periodosStmt->fetchAll(PDO::FETCH_ASSOC);

    /* ===== PAGOS ===== */
    if ($idPeriodoFilter > 0 && $idPeriodoFilter !== ID_CONTADO_ANUAL) {
        $pagosStmt = $pdo->prepare("
            SELECT id_socio, id_periodo, estado, fecha_pago
              FROM pagos
             WHERE id_periodo IN (:pp, :anual)
               AND YEAR(fecha_pago) = :anio
        ");
        $pagosStmt->bindValue(':pp', $idPeriodoFilter, PDO::PARAM_INT);
        $pagosStmt->bindValue(':anual', ID_CONTADO_ANUAL, PDO::PARAM_INT);
        $pagosStmt->bindValue(':anio', $anioFiltro, PDO::PARAM_INT);
        $pagosStmt->execute();
    } else {
        $pagosStmt = $pdo->prepare("
            SELECT id_socio, id_periodo, estado, fecha_pago
              FROM pagos
             WHERE YEAR(fecha_pago) = :anio
        ");
        $pagosStmt->bindValue(':anio', $anioFiltro, PDO::PARAM_INT);
        $pagosStmt->execute();
    }

    $pagos = $pagosStmt->fetchAll(PDO::FETCH_ASSOC);

    $pagoDirecto = [];
    $pagoAnual   = [];
    foreach ($pagos as $p) {
        $sid = (int)$p['id_socio'];
        $pid = (int)$p['id_periodo'];
        $est = $p['estado'] ?: 'pagado';
        if ($pid === ID_CONTADO_ANUAL) {
            $pagoAnual[$sid] = $est;
        } else {
            $pagoDirecto[$sid][$pid] = $est;
        }
    }

    /* ===== ✅ Cargar historial precios (1 sola vez) ===== */
    $idsCatMonto = [];
    foreach ($socios as $s) {
        if (!empty($s['id_cat_monto'])) $idsCatMonto[] = (int)$s['id_cat_monto'];
    }
    $historialMap = cargarHistorialPrecios($pdo, $idsCatMonto);

    /* ===== ARMADO DE CUOTAS ===== */
    $cuotas = [];

    // —— CONTADO ANUAL
    if ($idPeriodoFilter === ID_CONTADO_ANUAL) {
        $nombreAnual = 'CONTADO ANUAL';
        foreach ($periodos as $pp) {
            if ((int)$pp['id_periodo'] === ID_CONTADO_ANUAL) {
                $nombreAnual = $pp['nombre'] ?: 'CONTADO ANUAL';
                break;
            }
        }

        foreach ($socios as $socio) {
            $idSocio = (int)$socio['id_socio'];
            if (!socioElegibleEnPeriodo($socio['ingreso'] ?? null, 12, $anioFiltro)) continue;

            $estadoPago = 'deudor';
            $origenAnual = false;

            if (isset($pagoAnual[$idSocio])) {
                $estadoPago = ($pagoAnual[$idSocio] === 'condonado') ? 'condonado' : 'pagado';
                $origenAnual = true;
            }

            // ✅ FILTRO POR MODO (FIX)
            if ($modo === 'pagado' && $estadoPago !== 'pagado') continue;
            if ($modo === 'condonado' && $estadoPago !== 'condonado') continue;
            if ($modo === 'deudor' && $estadoPago !== 'deudor') continue;

            $domicilio = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));
            $domicilioCobro = trim($socio['domicilio_cobro'] ?? '');

            $idCatMonto = !empty($socio['id_cat_monto']) ? (int)$socio['id_cat_monto'] : null;
            $actualMensual = (int)($socio['monto_mensual_cat'] ?? 0);
            $actualAnual   = (int)($socio['monto_anual_cat'] ?? 0);

            $mMensual = precioVigenteEnFecha($idCatMonto, 'mensual', $fechaRefGlobal, $actualMensual, $historialMap);
            $mAnual   = precioVigenteEnFecha($idCatMonto, 'anual',   $fechaRefGlobal, $actualAnual,   $historialMap);

            $cuotas[] = [
                'id_socio'         => $idSocio,
                'nombre'           => $socio['nombre'],
                'domicilio'        => $domicilio,
                'domicilio_cobro'  => $domicilioCobro,
                'estado'           => $socio['estado'] ?? 'No definido',
                'medio_pago'       => $socio['cobrador'] ?? 'No definido',
                'telefono_movil'   => $socio['telefono_movil'] ?? '',
                'telefono_fijo'    => $socio['telefono_fijo'] ?? '',
                'mes'              => $nombreAnual,
                'id_periodo'       => ID_CONTADO_ANUAL,
                'estado_pago'      => $estadoPago,
                'origen_anual'     => $origenAnual,
                'id_categoria'     => $socio['id_categoria'] !== null ? (int)$socio['id_categoria'] : null,
                'nombre_categoria' => $socio['nombre_categoria'] ?? '',
                'id_cat_monto'     => $idCatMonto,
                'monto_mensual'    => $mMensual,
                'monto_anual'      => $mAnual,
                'precio_ref_fecha' => $fechaRefGlobal,
            ];
        }

        echo json_encode(['exito' => true, 'cuotas' => $cuotas], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // —— PERÍODOS 1..6
    $periodos16 = array_values(array_filter(
        $periodos,
        fn($p) => (int)$p['id_periodo'] !== ID_CONTADO_ANUAL
    ));

    foreach ($socios as $socio) {
        $idSocio    = (int)$socio['id_socio'];
        $tieneAnual = isset($pagoAnual[$idSocio]);

        foreach ($periodos16 as $periodo) {
            $idPeriodo     = (int)$periodo['id_periodo'];
            $nombrePeriodo = $periodo['nombre'];

            if ($idPeriodoFilter > 0 && $idPeriodo !== $idPeriodoFilter) continue;

            [, $mesFin] = obtenerRangoMeses($periodo['meses'] ?? '', $idPeriodo);
            if (!socioElegibleEnPeriodo($socio['ingreso'] ?? null, $mesFin, $anioFiltro)) continue;

            $estadoPago  = 'deudor';
            $origenAnual = false;

            if (isset($pagoDirecto[$idSocio][$idPeriodo])) {
                $estadoPago  = ($pagoDirecto[$idSocio][$idPeriodo] === 'condonado') ? 'condonado' : 'pagado';
            } elseif ($tieneAnual) {
                $estadoPago  = ($pagoAnual[$idSocio] === 'condonado') ? 'condonado' : 'pagado';
                $origenAnual = true;
            }

            // ✅ FILTRO POR MODO (FIX)
            if ($modo === 'pagado' && $estadoPago !== 'pagado') continue;
            if ($modo === 'condonado' && $estadoPago !== 'condonado') continue;
            if ($modo === 'deudor' && $estadoPago !== 'deudor') continue;

            $domicilio = trim(($socio['domicilio'] ?? '') . ' ' . ($socio['numero'] ?? ''));
            $domicilioCobro = trim($socio['domicilio_cobro'] ?? '');

            $fechaRefPeriodo = fechaReferenciaPorPeriodo($anioFiltro, $idPeriodo);

            $idCatMonto = !empty($socio['id_cat_monto']) ? (int)$socio['id_cat_monto'] : null;
            $actualMensual = (int)($socio['monto_mensual_cat'] ?? 0);
            $actualAnual   = (int)($socio['monto_anual_cat'] ?? 0);

            $mMensual = precioVigenteEnFecha($idCatMonto, 'mensual', $fechaRefPeriodo, $actualMensual, $historialMap);
            $mAnual   = precioVigenteEnFecha($idCatMonto, 'anual',   $fechaRefPeriodo, $actualAnual,   $historialMap);

            $cuotas[] = [
                'id_socio'         => $idSocio,
                'nombre'           => $socio['nombre'],
                'domicilio'        => $domicilio,
                'domicilio_cobro'  => $domicilioCobro,
                'estado'           => $socio['estado'] ?? 'No definido',
                'medio_pago'       => $socio['cobrador'] ?? 'No definido',
                'telefono_movil'   => $socio['telefono_movil'] ?? '',
                'telefono_fijo'    => $socio['telefono_fijo'] ?? '',
                'mes'              => $nombrePeriodo,
                'id_periodo'       => $idPeriodo,
                'estado_pago'      => $estadoPago,
                'origen_anual'     => $origenAnual,
                'id_categoria'     => $socio['id_categoria'] !== null ? (int)$socio['id_categoria'] : null,
                'nombre_categoria' => $socio['nombre_categoria'] ?? '',
                'id_cat_monto'     => $idCatMonto,
                'monto_mensual'    => $mMensual,
                'monto_anual'      => $mAnual,
                'precio_ref_fecha' => $fechaRefPeriodo,
            ];
        }
    }

    echo json_encode(['exito' => true, 'cuotas' => $cuotas], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'exito'   => false,
        'mensaje' => 'Error al obtener cuotas: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
