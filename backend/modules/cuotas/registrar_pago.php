<?php
// modules/cuotas/registrar_pago.php
require_once __DIR__ . '/../../config/db.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

const ID_CONTADO_ANUAL = 7;
const PERIODOS_BIMESTRALES = [1,2,3,4,5,6];

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['exito'=>false,'mensaje'=>'Método no permitido']); exit;
}

$in        = json_decode(file_get_contents("php://input"), true) ?? [];
$id_socio  = (int)($in['id_socio'] ?? 0);
$periodos  = array_map('intval', $in['periodos'] ?? []);
$condonar  = !empty($in['condonar']);

// Año seleccionado desde el modal (por ej. 2026). Si no llega, usamos el actual.
$anioSel   = isset($in['anio']) ? (int)$in['anio'] : (int)date('Y');
if ($anioSel < 2000 || $anioSel > 2100) { $anioSel = (int)date('Y'); }

// Fecha de pago = año seleccionado + mes y día actuales
$fechaPago = sprintf('%04d-%02d-%02d', $anioSel, (int)date('m'), (int)date('d'));

if ($id_socio <= 0 || empty($periodos)) {
    echo json_encode(['exito'=>false,'mensaje'=>'Datos incompletos']); exit;
}

$set = array_values(array_unique($periodos));
sort($set, SORT_NUMERIC);

$incluyeAnual = in_array(ID_CONTADO_ANUAL, $set, true);
$soloBimestresDelAnio =
    empty(array_diff($set, PERIODOS_BIMESTRALES)) &&
    count(array_intersect($set, PERIODOS_BIMESTRALES)) === count(PERIODOS_BIMESTRALES);

$estadoNuevo = $condonar ? 'condonado' : 'pagado';

try {
    $pdo->beginTransaction();

    // ¿Hay anual ya para ese mismo AÑO?
    $stTieneAnual = $pdo->prepare("
        SELECT id_pago, estado
          FROM pagos
         WHERE id_socio = ?
           AND id_periodo = ?
           AND YEAR(fecha_pago) = ?
         LIMIT 1
    ");
    $stTieneAnual->execute([$id_socio, ID_CONTADO_ANUAL, $anioSel]);
    $rowAnual = $stTieneAnual->fetch(PDO::FETCH_ASSOC);

    if ($incluyeAnual || $soloBimestresDelAnio) {
        // ---- Caso Anual: consolidar en un solo registro (7) SOLO para el año seleccionado ----

        // Borro bimestres (1..6) del MISMO año para evitar duplicidad
        $delBims = $pdo->prepare("
            DELETE FROM pagos
             WHERE id_socio = ?
               AND id_periodo IN (1,2,3,4,5,6)
               AND YEAR(fecha_pago) = ?
        ");
        $delBims->execute([$id_socio, $anioSel]);

        if ($rowAnual) {
            // ya había anual ese año → actualizo estado/fecha
            $upd = $pdo->prepare("UPDATE pagos SET estado = ?, fecha_pago = ? WHERE id_pago = ?");
            $upd->execute([$estadoNuevo, $fechaPago, (int)$rowAnual['id_pago']]);
        } else {
            $ins = $pdo->prepare("INSERT INTO pagos (id_socio, id_periodo, fecha_pago, estado) VALUES (?,?,?,?)");
            $ins->execute([$id_socio, ID_CONTADO_ANUAL, $fechaPago, $estadoNuevo]);
        }

        $pdo->commit();
        echo json_encode([
            'exito'=>true,
            'mensaje'=>"Pago anual ($anioSel) registrado correctamente (cubre períodos 1..6).",
        ]);
        exit;
    }

    // ---- Caso bimestres sueltos ----
    // Si existe un ANUAL en el mismo año, no permitir bimestres individuales.
    if ($rowAnual) {
        $pdo->rollBack();
        echo json_encode([
            'exito'=>false,
            'mensaje'=>"El socio ya tiene pago anual registrado en $anioSel. Eliminá el anual para registrar bimestres individuales."
        ]);
        exit;
    }

    $ins = $pdo->prepare("INSERT INTO pagos (id_socio, id_periodo, fecha_pago, estado) VALUES (?,?,?,?)");
    $sel = $pdo->prepare("
        SELECT id_pago
          FROM pagos
         WHERE id_socio = ?
           AND id_periodo = ?
           AND YEAR(fecha_pago) = ?
         LIMIT 1
    ");

    $insertados = [];
    $ya         = [];
    $errores    = [];

    foreach ($set as $p) {
        if (!in_array($p, PERIODOS_BIMESTRALES, true)) continue;

        // ¿Ya existe ese período para ese AÑO?
        $sel->execute([$id_socio, $p, $anioSel]);
        if ($sel->fetch()) { $ya[] = $p; continue; }

        try {
            $ins->execute([$id_socio, $p, $fechaPago, $estadoNuevo]);
            $insertados[] = $p;
        } catch (Throwable $e) {
            $errores[] = ['periodo'=>$p, 'mensaje'=>$e->getMessage()];
        }
    }

    $pdo->commit();
    $ok = !empty($insertados) && empty($errores);
    echo json_encode([
        'exito'=>$ok,
        'mensaje'=>$ok
            ? "Pago(s) registrados correctamente para el año $anioSel."
            : "Hubo problemas en algunos períodos para el año $anioSel.",
        'insertados'=>$insertados,
        'ya_registrados'=>$ya,
        'errores'=>$errores
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['exito'=>false,'mensaje'=>'Error al registrar: '.$e->getMessage()]);
}
