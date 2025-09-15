<?php
require_once __DIR__ . '/_common.php';

$pdo   = fam_pdo();
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$id_socio = fam_int_or_null($input['id_socio'] ?? null);

if (!$id_socio) {
    fam_json(['exito' => false, 'mensaje' => 'id_socio requerido'], 400);
}

$ok = $pdo->prepare("UPDATE socios SET id_familia = NULL WHERE id_socio = :s")
          ->execute([':s' => $id_socio]);

fam_json(['exito' => $ok, 'mensaje' => $ok ? 'Miembro quitado' : 'No se pudo quitar']);
