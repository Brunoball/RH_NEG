<?php
require_once __DIR__ . '/_common.php';

$pdo   = fam_pdo();
$input = json_decode(file_get_contents('php://input'), true) ?: [];

$id_familia = fam_int_or_null($input['id_familia'] ?? null);
$ids        = $input['ids_socio'] ?? [];

if (!$id_familia || !is_array($ids) || count($ids) === 0) {
    fam_json(['exito' => false, 'mensaje' => 'id_familia e ids_socio son requeridos'], 400);
}

$pdo->beginTransaction();
try {
    $st = $pdo->prepare("UPDATE socios SET id_familia = :f WHERE id_socio = :s");
    foreach ($ids as $id) {
        $st->execute([':f' => $id_familia, ':s' => (int)$id]);
    }
    $pdo->commit();
    fam_json(['exito' => true, 'mensaje' => 'Miembros agregados']);
} catch (Throwable $e) {
    $pdo->rollBack();
    fam_json(['exito' => false, 'mensaje' => 'No se pudieron agregar miembros'], 500);
}
