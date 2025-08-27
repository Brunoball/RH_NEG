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
$hoy = date('Y-m-d');

try {
    $pdo->beginTransaction();

    // ¿Hay anual ya?
    $stTieneAnual = $pdo->prepare("SELECT id_pago, estado FROM pagos WHERE id_socio=? AND id_periodo=? LIMIT 1");
    $stTieneAnual->execute([$id_socio, ID_CONTADO_ANUAL]);
    $rowAnual = $stTieneAnual->fetch(PDO::FETCH_ASSOC);

    if ($incluyeAnual || $soloBimestresDelAnio) {
        // ---- Caso Anual: consolidar en un solo registro (7) ----

        // Borro bimestres (1..6) para evitar duplicidad de estados
        $delBims = $pdo->prepare("DELETE FROM pagos WHERE id_socio=? AND id_periodo IN (1,2,3,4,5,6)");
        $delBims->execute([$id_socio]);

        if ($rowAnual) {
            // ya había anual → actualizo estado/fecha (si querés mantener histórico, podrías no tocarlo)
            $upd = $pdo->prepare("UPDATE pagos SET estado=?, fecha_pago=? WHERE id_pago=?");
            $upd->execute([$estadoNuevo, $hoy, (int)$rowAnual['id_pago']]);
        } else {
            $ins = $pdo->prepare("INSERT INTO pagos (id_socio, id_periodo, fecha_pago, estado) VALUES (?,?,?,?)");
            $ins->execute([$id_socio, ID_CONTADO_ANUAL, $hoy, $estadoNuevo]);
        }

        $pdo->commit();
        echo json_encode([
            'exito'=>true,
            'mensaje'=>'Pago anual registrado correctamente (cubre períodos 1..6).'
        ]);
        exit;
    }

    // ---- Caso bimestres sueltos ----
    if ($rowAnual) {
        $pdo->rollBack();
        echo json_encode([
            'exito'=>false,
            'mensaje'=>'El socio ya tiene pago anual. Eliminá el anual para registrar bimestres individuales.'
        ]);
        exit;
    }

    $ins = $pdo->prepare("INSERT INTO pagos (id_socio, id_periodo, fecha_pago, estado) VALUES (?,?,?,?)");
    $sel = $pdo->prepare("SELECT id_pago FROM pagos WHERE id_socio=? AND id_periodo=? LIMIT 1");

    $insertados = [];
    $ya         = [];
    $errores    = [];

    foreach ($set as $p) {
        if (!in_array($p, PERIODOS_BIMESTRALES, true)) continue;
        $sel->execute([$id_socio, $p]);
        if ($sel->fetch()) { $ya[] = $p; continue; }
        try {
            $ins->execute([$id_socio, $p, $hoy, $estadoNuevo]);
            $insertados[] = $p;
        } catch (Throwable $e) {
            $errores[] = ['periodo'=>$p, 'mensaje'=>$e->getMessage()];
        }
    }

    $pdo->commit();
    $ok = !empty($insertados) && empty($errores);
    echo json_encode([
        'exito'=>$ok,
        'mensaje'=>$ok ? 'Pago(s) registrados correctamente.' : 'Hubo problemas en algunos períodos.',
        'insertados'=>$insertados,
        'ya_registrados'=>$ya,
        'errores'=>$errores
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['exito'=>false,'mensaje'=>'Error al registrar: '.$e->getMessage()]);
}
