<?php
require_once __DIR__ . '/../../config/db.php';
header('Content-Type: application/json; charset=utf-8');

const ID_CONTADO_ANUAL = 7;

function fechaReferenciaPorPeriodo(int $anio, int $idPeriodo): string {
    if ($idPeriodo === ID_CONTADO_ANUAL || $idPeriodo <= 0) return sprintf('%04d-12-31', $anio);
    $mapMesFin = [1=>2, 2=>4, 3=>6, 4=>8, 5=>10, 6=>12];
    $mesFin = $mapMesFin[$idPeriodo] ?? 12;
    $d = DateTime::createFromFormat('Y-n-j', $anio . '-' . $mesFin . '-1');
    if (!$d) return sprintf('%04d-12-31', $anio);
    $d->modify('last day of this month');
    return $d->format('Y-m-d');
}

function cargarHistorialPrecios(PDO $pdo, int $idCatMonto): array {
    $st = $pdo->prepare("
        SELECT tipo, precio_viejo, precio_nuevo, fecha_cambio
          FROM precios_historicos
         WHERE id_cat_monto = :id
         ORDER BY tipo ASC, fecha_cambio ASC
    ");
    $st->bindValue(':id', $idCatMonto, PDO::PARAM_INT);
    $st->execute();
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    $map = [];
    foreach ($rows as $r) {
        $tipo = (string)$r['tipo'];
        $map[$tipo][] = [
            'fecha' => (string)$r['fecha_cambio'],
            'viejo' => (int)$r['precio_viejo'],
            'nuevo' => (int)$r['precio_nuevo'],
        ];
    }
    return $map;
}

function precioVigenteEnFecha(int $idCatMonto, string $tipo, string $fechaRef, int $precioActual, array $hist): int {
    $lista = $hist[$tipo] ?? [];
    if (!$lista) return $precioActual;

    $primer = $lista[0];
    if ($fechaRef < $primer['fecha']) return (int)$primer['viejo'];

    $vigente = null;
    foreach ($lista as $c) {
        if ($c['fecha'] <= $fechaRef) $vigente = (int)$c['nuevo'];
        else break;
    }
    return $vigente !== null ? $vigente : $precioActual;
}

try {
    $idSocio = isset($_GET['id_socio']) ? (int)$_GET['id_socio'] : 0;
    if ($idSocio <= 0) {
        echo json_encode(['exito' => false, 'mensaje' => 'Falta id_socio'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $anio = isset($_GET['anio']) ? (int)$_GET['anio'] : (int)date('Y');
    $idPeriodo = isset($_GET['id_periodo']) ? (int)$_GET['id_periodo'] : 0;

    $fechaRef = fechaReferenciaPorPeriodo($anio, $idPeriodo);

    $st = $pdo->prepare("
        SELECT 
            s.id_socio,
            s.nombre,
            s.domicilio,
            s.numero,
            s.domicilio_cobro,
            s.id_categoria,
            cat.descripcion AS nombre_categoria,
            s.id_cat_monto,
            cm.monto_mensual AS monto_mensual_cat,
            cm.monto_anual AS monto_anual_cat
        FROM socios s
        LEFT JOIN categoria cat ON s.id_categoria = cat.id_categoria
        LEFT JOIN categoria_monto cm ON s.id_cat_monto = cm.id_cat_monto
        WHERE s.id_socio = :id
        LIMIT 1
    ");
    $st->bindValue(':id', $idSocio, PDO::PARAM_INT);
    $st->execute();
    $s = $st->fetch(PDO::FETCH_ASSOC);

    if (!$s) {
        echo json_encode(['exito' => false, 'mensaje' => 'Socio no encontrado'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $idCatMonto = !empty($s['id_cat_monto']) ? (int)$s['id_cat_monto'] : 0;
    $actualMensual = (int)($s['monto_mensual_cat'] ?? 0);
    $actualAnual   = (int)($s['monto_anual_cat'] ?? 0);

    $hist = $idCatMonto ? cargarHistorialPrecios($pdo, $idCatMonto) : [];

    $mMensual = $idCatMonto ? precioVigenteEnFecha($idCatMonto, 'mensual', $fechaRef, $actualMensual, $hist) : $actualMensual;
    $mAnual   = $idCatMonto ? precioVigenteEnFecha($idCatMonto, 'anual',   $fechaRef, $actualAnual,   $hist) : $actualAnual;

    echo json_encode([
        'exito' => true,
        'socio' => [
            'id_socio'         => (int)$s['id_socio'],
            'nombre'           => $s['nombre'] ?? '',
            'domicilio'        => trim(($s['domicilio'] ?? '') . ' ' . ($s['numero'] ?? '')),
            'domicilio_cobro'  => $s['domicilio_cobro'] ?? '',
            'id_categoria'     => $s['id_categoria'] !== null ? (int)$s['id_categoria'] : null,
            'nombre_categoria' => $s['nombre_categoria'] ?? '',
            'id_cat_monto'     => $idCatMonto ?: null,
            'monto_mensual'    => $mMensual,
            'monto_anual'      => $mAnual,
            'precio_ref_fecha' => $fechaRef,
        ],
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['exito' => false, 'mensaje' => 'Error: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
