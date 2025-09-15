<?php
require_once __DIR__ . '/_common.php';

$pdo = fam_pdo();
$id_familia = isset($_GET['id_familia']) ? (int)$_GET['id_familia'] : 0;
if ($id_familia <= 0) {
    fam_json(['exito' => false, 'mensaje' => 'id_familia inválido'], 400);
}

$sql = "SELECT s.id_socio, s.nombre, s.dni, s.domicilio, s.numero, s.activo
        FROM socios s
        WHERE s.id_familia = :id
        ORDER BY s.nombre ASC";
$st = $pdo->prepare($sql);
$st->execute([':id' => $id_familia]);
$rows = $st->fetchAll(PDO::FETCH_ASSOC);

fam_json(['exito' => true, 'miembros' => $rows]);
